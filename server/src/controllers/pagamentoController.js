const { query } = require('../db');

async function criarPagamento(req, res) {
  const { pedido_id, metodo, valor } = req.body;
  if (!pedido_id || !metodo || valor === undefined) {
    return res.status(400).json({ error: 'Informe pedido_id, metodo e valor.' });
  }
  const pagamentos = await query(
    `insert into pagamentos (pedido_id, metodo, valor)
     values ($1, $2, $3) returning *`,
    [pedido_id, metodo, valor]
  );
  res.status(201).json(pagamentos[0]);
}

module.exports = { criarPagamento };
