const { query } = require('../db');

async function obterRelatorios(req, res) {
  const [resumo] = await query(
    `select
      coalesce(sum(pg.valor), 0)::numeric(10,2) as faturamento_total,
      coalesce(avg(t.total), 0)::numeric(10,2) as ticket_medio
     from pedidos p
     left join pagamentos pg on pg.pedido_id = p.id
     left join (
       select pedido_id, sum(quantidade * preco_unitario) as total
       from pedido_itens group by pedido_id
     ) t on t.pedido_id = p.id`
  );
  const produtos = await query(
    `select nome, sum(quantidade) as quantidade, sum(quantidade * preco_unitario)::numeric(10,2) as total
     from pedido_itens
     group by nome
     order by quantidade desc
     limit 5`
  );
  const [tempo] = await query(
    `select coalesce(avg(extract(epoch from (pronto_em - criado_em)) / 60), 0)::numeric(10,1) as tempo_medio_preparo
     from pedidos
     where pronto_em is not null`
  );
  const porDia = await query(
    `select date_trunc('day', pg.criado_em)::date as dia, sum(pg.valor)::numeric(10,2) as faturamento
     from pagamentos pg
     group by dia
     order by dia desc
     limit 14`
  );
  res.json({
    ...resumo,
    tempo_medio_preparo: tempo.tempo_medio_preparo,
    produtos_mais_vendidos: produtos,
    faturamento_por_dia: porDia
  });
}

module.exports = { obterRelatorios };
