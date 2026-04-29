const { query, transaction } = require('../db');

async function criarPagamento(req, res) {
  const { pedido_id, metodo, valor, status = 'aprovado', gateway_nome, gateway_referencia } = req.body;
  if (!pedido_id || !metodo || valor === undefined) {
    return res.status(400).json({ error: 'Informe pedido_id, metodo e valor.' });
  }

  const pagamento = await transaction(async (client) => {
    const config = await client.query('select * from configuracoes_pagamento where id = 1');
    const pixCopiaCola = metodo === 'pix'
      ? gerarPixCopiaCola(config.rows[0]?.chave_pix, valor, pedido_id)
      : null;

    const criado = await client.query(
      `insert into pagamentos (
        pedido_id, metodo, valor, status, pix_copia_cola, qr_code_url, gateway_nome, gateway_referencia
       ) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [
        pedido_id,
        metodo,
        valor,
        status,
        pixCopiaCola,
        pixCopiaCola ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pixCopiaCola)}` : null,
        gateway_nome || config.rows[0]?.gateway_nome || 'manual',
        gateway_referencia || null
      ]
    );

    const caixa = await client.query("select * from caixas where status = 'aberto' order by aberto_em desc limit 1");
    if (caixa.rows[0] && status === 'aprovado') {
      await client.query(
        `insert into caixa_movimentos (caixa_id, tipo, metodo, valor, descricao, pedido_id)
         values ($1, 'venda', $2, $3, $4, $5)`,
        [caixa.rows[0].id, metodo, valor, `Pagamento do pedido #${pedido_id}`, pedido_id]
      );
    }

    return criado.rows[0];
  });

  res.status(201).json(pagamento);
}

async function webhookPagamento(req, res) {
  res.json({ status: 'recebido', gateway: req.params.gateway, body: req.body });
}

function gerarPixCopiaCola(chavePix, valor, pedidoId) {
  const chave = chavePix || 'pix@bardigital.local';
  return `PIX|BAR DIGITAL|CHAVE:${chave}|VALOR:${Number(valor).toFixed(2)}|PEDIDO:${pedidoId}`;
}

module.exports = { criarPagamento, webhookPagamento };
