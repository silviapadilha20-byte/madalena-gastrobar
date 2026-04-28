const { query } = require('../db');

async function listarMesas(req, res) {
  const mesas = await query('select * from mesas order by numero');
  res.json(mesas);
}

async function criarMesa(req, res) {
  const { numero } = req.body;
  if (!numero) return res.status(400).json({ error: 'Informe o número da mesa.' });
  const mesas = await query(
    'insert into mesas (numero, status) values ($1, $2) returning *',
    [numero, 'livre']
  );
  res.status(201).json(mesas[0]);
}

async function atualizarMesa(req, res) {
  const mesas = await query(
    'update mesas set status = coalesce($1, status) where id = $2 returning *',
    [req.body.status, req.params.id]
  );
  if (!mesas[0]) return res.status(404).json({ error: 'Mesa não encontrada.' });
  res.json(mesas[0]);
}

module.exports = { listarMesas, criarMesa, atualizarMesa };
