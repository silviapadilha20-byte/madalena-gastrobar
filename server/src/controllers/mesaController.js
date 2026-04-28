const { query } = require('../db');

async function listarMesas(req, res) {
  const mesas = await query('select * from mesas order by numero');
  res.json(mesas);
}

async function criarMesa(req, res) {
  const { numero, lugares = 4 } = req.body;
  if (!numero) return res.status(400).json({ error: 'Informe o número da mesa.' });
  const mesas = await query(
    'insert into mesas (numero, lugares, status) values ($1, $2, $3) returning *',
    [numero, lugares, 'livre']
  );
  res.status(201).json(mesas[0]);
}

async function atualizarMesa(req, res) {
  const mesas = await query(
    'update mesas set status = coalesce($1, status), lugares = coalesce($2, lugares) where id = $3 returning *',
    [req.body.status, req.body.lugares, req.params.id]
  );
  if (!mesas[0]) return res.status(404).json({ error: 'Mesa não encontrada.' });
  res.json(mesas[0]);
}

async function removerMesa(req, res) {
  const pedidosAbertos = await query(
    "select id from pedidos where mesa_id = $1 and status <> 'finalizado' limit 1",
    [req.params.id]
  );
  if (pedidosAbertos[0]) {
    return res.status(409).json({ error: 'Mesa com comanda aberta não pode ser removida.' });
  }
  const mesas = await query('delete from mesas where id = $1 returning id', [req.params.id]);
  if (!mesas[0]) return res.status(404).json({ error: 'Mesa não encontrada.' });
  res.json({ ok: true });
}

module.exports = { listarMesas, criarMesa, atualizarMesa, removerMesa };
