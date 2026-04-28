const { query } = require('../db');

async function obterConfiguracoes(req, res) {
  const configs = await query('select * from configuracoes_pagamento where id = 1');
  if (configs[0]) return res.json(configs[0]);

  const criadas = await query(
    `insert into configuracoes_pagamento (id)
     values (1)
     returning *`
  );
  res.json(criadas[0]);
}

async function salvarConfiguracoes(req, res) {
  const {
    pix_ativo,
    cartao_ativo,
    dinheiro_ativo,
    chave_pix,
    gateway_nome,
    gateway_ativo,
    gateway_public_key,
    gateway_secret_key
  } = req.body;

  const configs = await query(
    `insert into configuracoes_pagamento (
      id, pix_ativo, cartao_ativo, dinheiro_ativo, chave_pix,
      gateway_nome, gateway_ativo, gateway_public_key, gateway_secret_key, atualizado_em
    )
    values (1, $1, $2, $3, $4, $5, $6, $7, $8, now())
    on conflict (id) do update set
      pix_ativo = excluded.pix_ativo,
      cartao_ativo = excluded.cartao_ativo,
      dinheiro_ativo = excluded.dinheiro_ativo,
      chave_pix = excluded.chave_pix,
      gateway_nome = excluded.gateway_nome,
      gateway_ativo = excluded.gateway_ativo,
      gateway_public_key = excluded.gateway_public_key,
      gateway_secret_key = excluded.gateway_secret_key,
      atualizado_em = now()
    returning *`,
    [
      pix_ativo !== false,
      cartao_ativo !== false,
      dinheiro_ativo !== false,
      chave_pix || null,
      gateway_nome || 'manual',
      Boolean(gateway_ativo),
      gateway_public_key || null,
      gateway_secret_key || null
    ]
  );
  res.json(configs[0]);
}

module.exports = { obterConfiguracoes, salvarConfiguracoes };
