const { query, transaction } = require('../db');

async function caixaAtual(req, res) {
  const [caixa] = await query("select * from caixas where status = 'aberto' order by aberto_em desc limit 1");
  if (!caixa) return res.json({ caixa: null, movimentos: [], resumo: [] });
  const movimentos = await query('select * from caixa_movimentos where caixa_id = $1 order by criado_em desc', [caixa.id]);
  const resumo = await query(
    `select metodo, sum(valor)::numeric(10,2) as total
     from caixa_movimentos
     where caixa_id = $1 and tipo = 'venda'
     group by metodo
     order by metodo`,
    [caixa.id]
  );
  res.json({ caixa, movimentos, resumo });
}

async function abrirCaixa(req, res) {
  const aberto = await query("select id from caixas where status = 'aberto' limit 1");
  if (aberto[0]) return res.status(400).json({ error: 'Já existe caixa aberto.' });
  const { saldo_inicial = 0 } = req.body;
  const caixa = await transaction(async (client) => {
    const criado = await client.query(
      `insert into caixas (usuario_id, usuario_nome, saldo_inicial)
       values ($1, $2, $3) returning *`,
      [req.user?.id || null, req.user?.nome || 'Sistema', saldo_inicial]
    );
    await client.query(
      `insert into caixa_movimentos (caixa_id, tipo, metodo, valor, descricao)
       values ($1, 'abertura', 'dinheiro', $2, 'Abertura de caixa')`,
      [criado.rows[0].id, saldo_inicial]
    );
    return criado.rows[0];
  });
  res.status(201).json(caixa);
}

async function criarMovimento(req, res) {
  const { tipo, metodo = 'dinheiro', valor, descricao } = req.body;
  if (!['suprimento', 'sangria'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });
  const [caixa] = await query("select * from caixas where status = 'aberto' order by aberto_em desc limit 1");
  if (!caixa) return res.status(400).json({ error: 'Abra o caixa antes de lançar movimento.' });
  const [movimento] = await query(
    `insert into caixa_movimentos (caixa_id, tipo, metodo, valor, descricao)
     values ($1, $2, $3, $4, $5) returning *`,
    [caixa.id, tipo, metodo, valor, descricao || null]
  );
  res.status(201).json(movimento);
}

async function fecharCaixa(req, res) {
  const { saldo_informado = 0 } = req.body;
  const [caixa] = await query("select * from caixas where status = 'aberto' order by aberto_em desc limit 1");
  if (!caixa) return res.status(400).json({ error: 'Não existe caixa aberto.' });

  const [saldo] = await query(
    `select
      ($1::numeric
       + coalesce(sum(case when tipo in ('suprimento', 'venda') then valor else 0 end), 0)
       - coalesce(sum(case when tipo = 'sangria' then valor else 0 end), 0))::numeric(10,2) as calculado
     from caixa_movimentos where caixa_id = $2 and tipo <> 'abertura'`,
    [caixa.saldo_inicial, caixa.id]
  );
  const calculado = Number(saldo.calculado || 0);
  const informado = Number(saldo_informado || 0);
  const [fechado] = await query(
    `update caixas
     set status = 'fechado', saldo_informado = $1, saldo_calculado = $2,
         divergencia = $1 - $2, fechado_em = now()
     where id = $3 returning *`,
    [informado, calculado, caixa.id]
  );
  await query(
    `insert into caixa_movimentos (caixa_id, tipo, valor, descricao)
     values ($1, 'fechamento', $2, 'Fechamento diário')`,
    [caixa.id, informado]
  );
  res.json(fechado);
}

module.exports = { caixaAtual, abrirCaixa, criarMovimento, fecharCaixa };
