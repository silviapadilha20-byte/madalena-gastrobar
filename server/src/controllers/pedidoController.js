const { query, transaction } = require('../db');

async function pedidoCompleto(id) {
  const pedidos = await query(
    `select p.*, m.numero as mesa_numero,
      coalesce(sum(pi.quantidade * pi.preco_unitario), 0)::numeric(10,2) as total
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
      coalesce(sum(pi.quantidade * pi.preco_unitario), 0)::numeric(10,2) as total
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
  const { mesa_id, cliente_nome, itens = [] } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um item.' });
  }

  const pedido = await transaction(async (client) => {
    let pedidoAberto = null;

    if (mesa_id) {
      const aberto = await client.query(
        `select * from pedidos
         where mesa_id = $1 and status <> 'finalizado'
         order by criado_em desc limit 1`,
        [mesa_id]
      );
      pedidoAberto = aberto.rows[0] || null;
    }

    if (!pedidoAberto) {
      const criado = await client.query(
        `insert into pedidos (mesa_id, cliente_nome, status)
         values ($1, $2, 'novo') returning *`,
        [mesa_id || null, cliente_nome || null]
      );
      pedidoAberto = criado.rows[0];
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
  const status = req.body.status;
  const prontoEm = status === 'pronto' ? ', pronto_em = coalesce(pronto_em, now())' : '';
  const pedidos = await query(
    `update pedidos set status = $1, atualizado_em = now() ${prontoEm} where id = $2 returning *`,
    [status, req.params.id]
  );

  if (!pedidos[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });

  if (status === 'finalizado' && pedidos[0].mesa_id) {
    const abertos = await query(
      "select id from pedidos where mesa_id = $1 and status <> 'finalizado' and id <> $2",
      [pedidos[0].mesa_id, pedidos[0].id]
    );
    if (abertos.length === 0) {
      await query("update mesas set status = 'livre' where id = $1", [pedidos[0].mesa_id]);
    }
  }

  res.json(await pedidoCompleto(req.params.id));
}

module.exports = { listarPedidos, criarPedido, atualizarPedido };
