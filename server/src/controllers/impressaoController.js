const { query } = require('../db');

async function listarImpressoes(req, res) {
  const impressoes = await query(
    `select i.*, p.status as pedido_status, m.numero as mesa_numero
     from impressoes i
     join pedidos p on p.id = i.pedido_id
     left join mesas m on m.id = p.mesa_id
     where ($1::text is null or i.status = $1)
     order by i.criado_em desc`,
    [req.query.status || null]
  );
  res.json(impressoes);
}

async function reimprimirPedido(req, res) {
  const { setor = 'comanda', tipo = 'reimpressao' } = req.body;
  const [pedido] = await query('select * from pedidos where id = $1', [req.params.id]);
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
  const itens = await query('select * from pedido_itens where pedido_id = $1 order by id', [pedido.id]);
  const conteudo = `Pedido #${pedido.id}\n${itens.map((item) => `${item.quantidade}x ${item.nome}${item.observacao ? ` - ${item.observacao}` : ''}`).join('\n')}`;
  const [impressao] = await query(
    `insert into impressoes (pedido_id, setor, tipo, conteudo)
     values ($1, $2, $3, $4) returning *`,
    [pedido.id, setor, tipo, conteudo]
  );
  res.status(201).json(impressao);
}

async function atualizarImpressao(req, res) {
  const { status, erro } = req.body;
  const [impressao] = await query(
    `update impressoes
     set status = $1, erro = $2, impresso_em = case when $1 = 'impresso' then now() else impresso_em end
     where id = $3 returning *`,
    [status, erro || null, req.params.id]
  );
  if (!impressao) return res.status(404).json({ error: 'Impressão não encontrada.' });
  res.json(impressao);
}

module.exports = { listarImpressoes, reimprimirPedido, atualizarImpressao };
