const { query } = require('../db');

async function obterRelatorios(req, res) {
  const { inicio, fim } = periodo(req.query);
  const filtrosPagamento = [inicio, fim];
  const filtrosPedido = [inicio, fim];

  const [resumo] = await query(
    `select
      coalesce(sum(pg.valor), 0)::numeric(10,2) as faturamento_total,
      coalesce(avg(t.total), 0)::numeric(10,2) as ticket_medio
     from pedidos p
     left join pagamentos pg on pg.pedido_id = p.id
     left join (
       select pedido_id, sum(quantidade * preco_unitario) as total
       from pedido_itens group by pedido_id
     ) t on t.pedido_id = p.id
     where ($1::timestamptz is null or p.criado_em >= $1)
       and ($2::timestamptz is null or p.criado_em < $2)`,
    filtrosPedido
  );
  const produtos = await query(
    `select pi.nome, sum(pi.quantidade) as quantidade, sum(pi.quantidade * pi.preco_unitario)::numeric(10,2) as total
     from pedido_itens pi
     join pedidos p on p.id = pi.pedido_id
     where ($1::timestamptz is null or p.criado_em >= $1)
       and ($2::timestamptz is null or p.criado_em < $2)
     group by pi.nome
     order by quantidade desc
     limit 8`,
    filtrosPedido
  );
  const [tempo] = await query(
    `select
      coalesce(avg(extract(epoch from (pronto_em - criado_em)) / 60), 0)::numeric(10,1) as tempo_medio_preparo,
      coalesce(avg(extract(epoch from (entregue_em - pronto_em)) / 60), 0)::numeric(10,1) as tempo_medio_entrega,
      coalesce(avg(extract(epoch from (finalizado_em - criado_em)) / 60), 0)::numeric(10,1) as tempo_medio_atendimento
     from pedidos
     where ($1::timestamptz is null or criado_em >= $1)
       and ($2::timestamptz is null or criado_em < $2)`,
    filtrosPedido
  );
  const porDia = await query(
    `select date_trunc('day', pg.criado_em)::date as dia, sum(pg.valor)::numeric(10,2) as faturamento
     from pagamentos pg
     where ($1::timestamptz is null or pg.criado_em >= $1)
       and ($2::timestamptz is null or pg.criado_em < $2)
     group by dia
     order by dia asc`,
    filtrosPagamento
  );
  const volumePorStatus = await query(
    `select status, count(*)::integer as total
     from pedidos
     where ($1::timestamptz is null or criado_em >= $1)
       and ($2::timestamptz is null or criado_em < $2)
     group by status
     order by status`,
    filtrosPedido
  );
  res.json({
    ...resumo,
    periodo: { inicio, fim },
    tempo_medio_preparo: tempo.tempo_medio_preparo,
    tempo_medio_entrega: tempo.tempo_medio_entrega,
    tempo_medio_atendimento: tempo.tempo_medio_atendimento,
    produtos_mais_vendidos: produtos,
    faturamento_por_dia: porDia,
    volume_por_status: volumePorStatus
  });
}

function periodo(query) {
  const inicio = query.inicio ? new Date(`${query.inicio}T00:00:00`) : null;
  const fim = query.fim ? new Date(`${query.fim}T00:00:00`) : null;
  if (fim) fim.setDate(fim.getDate() + 1);
  return {
    inicio: inicio && !Number.isNaN(inicio.getTime()) ? inicio.toISOString() : null,
    fim: fim && !Number.isNaN(fim.getTime()) ? fim.toISOString() : null
  };
}

module.exports = { obterRelatorios };
