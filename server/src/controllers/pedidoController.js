const { query, transaction } = require('../db');

async function pedidoCompleto(id) {
  const pedidos = await query(
    `select p.*, m.numero as mesa_numero,
      greatest(coalesce(sum(pi.quantidade * pi.preco_unitario), 0) - coalesce(p.desconto, 0), 0)::numeric(10,2) as total
     from pedidos p
     left join mesas m on m.id = p.mesa_id
     left join pedido_itens pi on pi.pedido_id = p.id
     where p.id = $1
     group by p.id, m.numero`,
    [id]
  );
  if (!pedidos[0]) return null;

  pedidos[0].itens = await query(
    `select pi.*, pr.categoria
     from pedido_itens pi
     left join produtos pr on pr.id = pi.produto_id
     where pi.pedido_id = $1
     order by pi.id`,
    [id]
  );
  pedidos[0].pagamentos = await query('select * from pagamentos where pedido_id = $1 order by criado_em', [id]);
  pedidos[0].historico = await query('select * from pedido_historico where pedido_id = $1 order by criado_em', [id]);
  return pedidos[0];
}

async function listarPedidos(req, res) {
  const params = [];
  let where = '';
  if (req.query.status) {
    params.push(req.query.status);
    where = 'where p.status = $1';
  }

  const pedidos = await query(
    `select p.*, m.numero as mesa_numero,
      greatest(coalesce(sum(pi.quantidade * pi.preco_unitario), 0) - coalesce(p.desconto, 0), 0)::numeric(10,2) as total
     from pedidos p
     left join mesas m on m.id = p.mesa_id
     left join pedido_itens pi on pi.pedido_id = p.id
     ${where}
     group by p.id, m.numero
     order by p.criado_em desc`,
    params
  );

  const itens = await query(
    `select pi.*, pr.categoria
     from pedido_itens pi
     left join produtos pr on pr.id = pi.produto_id
     order by pi.id`
  );

  res.json(pedidos.map((pedido) => ({
    ...pedido,
    itens: itens.filter((item) => Number(item.pedido_id) === Number(pedido.id))
  })));
}

async function criarPedido(req, res) {
  const {
    mesa_id,
    cliente_nome,
    cliente_telefone,
    cliente_email,
    cliente_nascimento,
    cupom,
    itens = []
  } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um item.' });
  }

  const pedido = await transaction(async (client) => {
    let pedidoAberto = null;

    if (mesa_id) {
      const aberto = await client.query(
        `select * from pedidos
         where mesa_id = $1 and status not in ('finalizado', 'cancelado')
         order by criado_em desc limit 1`,
        [mesa_id]
      );
      pedidoAberto = aberto.rows[0] || null;
    }

    if (!pedidoAberto) {
      const criado = await client.query(
        `insert into pedidos (
          mesa_id, cliente_nome, cliente_telefone, cliente_email, cliente_nascimento, cupom, desconto, status
        ) values ($1, $2, $3, $4, $5, $6, $7, 'novo') returning *`,
        [
          mesa_id || null,
          cliente_nome || null,
          cliente_telefone || null,
          cliente_email || null,
          cliente_nascimento || null,
          cupom || null,
          calcularDescontoAniversario(cliente_nascimento, cupom)
        ]
      );
      pedidoAberto = criado.rows[0];
      await client.query(
        `insert into pedido_historico (pedido_id, status_novo, usuario_id, usuario_nome, motivo)
         values ($1, 'novo', $2, $3, 'Pedido criado')`,
        [pedidoAberto.id, req.user?.id || null, req.user?.nome || 'Cliente']
      );
    } else if (cliente_nome || cliente_telefone || cliente_email || cliente_nascimento) {
      await client.query(
        `update pedidos set
          cliente_nome = coalesce($2, cliente_nome),
          cliente_telefone = coalesce($3, cliente_telefone),
          cliente_email = coalesce($4, cliente_email),
          cliente_nascimento = coalesce($5, cliente_nascimento),
          atualizado_em = now()
         where id = $1`,
        [pedidoAberto.id, cliente_nome || null, cliente_telefone || null, cliente_email || null, cliente_nascimento || null]
      );
    }

    for (const item of itens) {
      const produto = await client.query(
        'select * from produtos where id = $1 and disponivel = true',
        [item.produto_id]
      );
      if (!produto.rows[0]) {
        const error = new Error(`Produto indisponível ou inexistente: ${item.produto_id}`);
        error.status = 400;
        throw error;
      }

      await client.query(
        `insert into pedido_itens (pedido_id, produto_id, nome, quantidade, preco_unitario, observacao)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          pedidoAberto.id,
          produto.rows[0].id,
          produto.rows[0].nome,
          Number(item.quantidade || 1),
          produto.rows[0].preco_promocional || produto.rows[0].preco,
          item.observacao || null
        ]
      );

      await client.query(
        `insert into impressoes (pedido_id, setor, tipo, conteudo)
         values ($1, $2, 'pedido', $3)`,
        [
          pedidoAberto.id,
          produto.rows[0].categoria,
          `${Number(item.quantidade || 1)}x ${produto.rows[0].nome}${item.observacao ? ` - ${item.observacao}` : ''}`
        ]
      );
    }

    if (mesa_id) {
      await client.query("update mesas set status = 'ocupada' where id = $1", [mesa_id]);
    }

    await client.query('update pedidos set atualizado_em = now() where id = $1', [pedidoAberto.id]);
    return pedidoAberto;
  });

  res.status(201).json(await pedidoCompleto(pedido.id));
}

async function atualizarPedido(req, res) {
  const { status, motivo } = req.body;
  const permitidos = ['novo', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado', 'cancelado'];
  if (!permitidos.includes(status)) return res.status(400).json({ error: 'Status inválido.' });

  const pedidos = await transaction(async (client) => {
    const atual = await client.query('select * from pedidos where id = $1', [req.params.id]);
    if (!atual.rows[0]) return [];

    const prontoEm = status === 'pronto' ? ', pronto_em = coalesce(pronto_em, now())' : '';
    const entregueEm = status === 'entregue' ? ', entregue_em = coalesce(entregue_em, now())' : '';
    const finalizadoEm = status === 'finalizado' ? ', finalizado_em = coalesce(finalizado_em, now())' : '';
    const canceladoEm = status === 'cancelado' ? ', cancelado_em = coalesce(cancelado_em, now()), cancelado_motivo = $3' : '';
    const params = status === 'cancelado'
      ? [status, req.params.id, motivo || 'Cancelamento sem motivo informado']
      : [status, req.params.id];

    const atualizado = await client.query(
      `update pedidos set status = $1, atualizado_em = now()
       ${prontoEm}${entregueEm}${finalizadoEm}${canceladoEm}
       where id = $2 returning *`,
      params
    );

    await client.query(
      `insert into pedido_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo)
       values ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, atual.rows[0].status, status, req.user?.id || null, req.user?.nome || 'Sistema', motivo || null]
    );

    if (['finalizado', 'cancelado'].includes(status) && atualizado.rows[0].mesa_id) {
      const abertos = await client.query(
        "select id from pedidos where mesa_id = $1 and status not in ('finalizado', 'cancelado') and id <> $2",
        [atualizado.rows[0].mesa_id, atualizado.rows[0].id]
      );
      if (abertos.rows.length === 0) {
        await client.query("update mesas set status = 'livre' where id = $1", [atualizado.rows[0].mesa_id]);
      }
    }

    return atualizado.rows;
  });

  if (!pedidos[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json(await pedidoCompleto(req.params.id));
}

function calcularDescontoAniversario(nascimento, cupom) {
  if (String(cupom || '').trim().toUpperCase() === 'ANIVERSARIO') return 10;
  if (!nascimento) return 0;
  const hoje = new Date();
  const data = new Date(`${nascimento}T00:00:00`);
  if (data.getDate() === hoje.getDate() && data.getMonth() === hoje.getMonth()) return 10;
  return 0;
}

module.exports = { listarPedidos, criarPedido, atualizarPedido, pedidoCompleto };
