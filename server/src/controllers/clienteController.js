const { query } = require('../db');

async function historicoPorTelefone(req, res) {
  const telefone = String(req.query.telefone || '').replace(/\D/g, '');
  if (telefone.length < 8) return res.status(400).json({ error: 'Informe um telefone válido.' });
  const pedidos = await query(
    `select p.*, m.numero as mesa_numero,
      coalesce(sum(pi.quantidade * pi.preco_unitario), 0)::numeric(10,2) as total
     from pedidos p
     left join mesas m on m.id = p.mesa_id
     left join pedido_itens pi on pi.pedido_id = p.id
     where regexp_replace(coalesce(p.cliente_telefone, ''), '\\D', '', 'g') = $1
     group by p.id, m.numero
     order by p.criado_em desc
     limit 10`,
    [telefone]
  );
  res.json(pedidos);
}

async function criarChamado(req, res) {
  const { pedido_id, mesa_id, tipo = 'garcom', mensagem } = req.body;
  if (!pedido_id && !mesa_id) return res.status(400).json({ error: 'Informe pedido_id ou mesa_id.' });
  const [chamado] = await query(
    `insert into chamados_cliente (pedido_id, mesa_id, tipo, mensagem)
     values ($1, $2, $3, $4) returning *`,
    [pedido_id || null, mesa_id || null, tipo, mensagem || null]
  );
  res.status(201).json(chamado);
}

async function listarChamados(req, res) {
  const chamados = await query(
    `select c.*, p.status as pedido_status, m.numero as mesa_numero
     from chamados_cliente c
     left join pedidos p on p.id = c.pedido_id
     left join mesas m on m.id = coalesce(c.mesa_id, p.mesa_id)
     order by c.criado_em desc`
  );
  res.json(chamados);
}

async function atualizarChamado(req, res) {
  const { status } = req.body;
  const [chamado] = await query(
    `update chamados_cliente
     set status = $1, resolvido_em = case when $1 = 'resolvido' then now() else resolvido_em end
     where id = $2 returning *`,
    [status, req.params.id]
  );
  if (!chamado) return res.status(404).json({ error: 'Chamado não encontrado.' });
  res.json(chamado);
}

async function avaliarPedido(req, res) {
  const { nota, comentario } = req.body;
  const [pedido] = await query(
    `update pedidos set avaliacao_nota = $1, avaliacao_comentario = $2, atualizado_em = now()
     where id = $3 returning *`,
    [nota, comentario || null, req.params.id]
  );
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json(pedido);
}

async function pedirConta(req, res) {
  const [pedido] = await query(
    `update pedidos set conta_solicitada_em = now(), atualizado_em = now()
     where id = $1 returning *`,
    [req.params.id]
  );
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
  await query(
    `insert into chamados_cliente (pedido_id, mesa_id, tipo, mensagem)
     values ($1, $2, 'conta', 'Cliente pediu a conta')`,
    [pedido.id, pedido.mesa_id]
  );
  res.json(pedido);
}

module.exports = {
  historicoPorTelefone,
  criarChamado,
  listarChamados,
  atualizarChamado,
  avaliarPedido,
  pedirConta
};
