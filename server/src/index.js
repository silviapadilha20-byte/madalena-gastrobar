const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não configurada. Crie server/.env.');
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
});

app.use(cors());
app.use(express.json());

const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function pedidoCompleto(id) {
  const pedidos = await query(
    `select p.*, m.numero as mesa_numero,
      coalesce(sum(pi.quantidade * pi.preco_unitario), 0)::numeric(10,2) as total
     from pedidos p
     left join mesas m on m.id = p.mesa_id
     left join pedido_itens pi on pi.pedido_id = p.id
     where p.id = $1
     group by p.id, m.numero`,
    [id]
  );
  if (!pedidos[0]) return null;
  pedidos[0].itens = await query(
    `select pi.*, pr.categoria
     from pedido_itens pi
     left join produtos pr on pr.id = pi.produto_id
     where pi.pedido_id = $1
     order by pi.id`,
    [id]
  );
  pedidos[0].pagamentos = await query('select * from pagamentos where pedido_id = $1 order by criado_em', [id]);
  return pedidos[0];
}

async function listarPedidos(status) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'where p.status = $1';
  }
  const pedidos = await query(
    `select p.*, m.numero as mesa_numero,
      coalesce(sum(pi.quantidade * pi.preco_unitario), 0)::numeric(10,2) as total
     from pedidos p
     left join mesas m on m.id = p.mesa_id
     left join pedido_itens pi on pi.pedido_id = p.id
     ${where}
     group by p.id, m.numero
     order by p.criado_em desc`,
    params
  );
  const itens = await query(
    `select pi.*, pr.categoria
     from pedido_itens pi
     left join produtos pr on pr.id = pi.produto_id
     order by pi.id`
  );
  return pedidos.map((pedido) => ({
    ...pedido,
    itens: itens.filter((item) => Number(item.pedido_id) === Number(pedido.id))
  }));
}

app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'Bar Digital API' });
});

app.get('/produtos', asyncRoute(async (req, res) => {
  const todos = req.query.todos === '1';
  const produtos = await query(
    `select * from produtos ${todos ? '' : 'where disponivel = true'} order by categoria, nome`
  );
  res.json(produtos);
}));

app.get('/mesas', asyncRoute(async (req, res) => {
  const mesas = await query('select * from mesas order by numero');
  res.json(mesas);
}));

app.post('/mesas', asyncRoute(async (req, res) => {
  const { numero } = req.body;
  const mesas = await query(
    'insert into mesas (numero, status) values ($1, $2) returning *',
    [numero, 'livre']
  );
  res.status(201).json(mesas[0]);
}));

app.patch('/mesas/:id', asyncRoute(async (req, res) => {
  const mesas = await query(
    'update mesas set status = coalesce($1, status) where id = $2 returning *',
    [req.body.status, req.params.id]
  );
  if (!mesas[0]) return res.status(404).json({ error: 'Mesa não encontrada.' });
  res.json(mesas[0]);
}));

app.post('/pedidos', asyncRoute(async (req, res) => {
  const { mesa_id, cliente_nome, itens = [] } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um item.' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    let pedido = null;
    if (mesa_id) {
      const aberto = await client.query(
        `select * from pedidos
         where mesa_id = $1 and status <> 'finalizado'
         order by criado_em desc limit 1`,
        [mesa_id]
      );
      pedido = aberto.rows[0] || null;
    }

    if (!pedido) {
      const criado = await client.query(
        `insert into pedidos (mesa_id, cliente_nome, status)
         values ($1, $2, 'novo') returning *`,
        [mesa_id || null, cliente_nome || null]
      );
      pedido = criado.rows[0];
    }

    for (const item of itens) {
      const produto = await client.query(
        'select * from produtos where id = $1 and disponivel = true',
        [item.produto_id]
      );
      if (!produto.rows[0]) {
        throw new Error(`Produto indisponível ou inexistente: ${item.produto_id}`);
      }
      await client.query(
        `insert into pedido_itens (pedido_id, produto_id, nome, quantidade, preco_unitario, observacao)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          pedido.id,
          produto.rows[0].id,
          produto.rows[0].nome,
          Number(item.quantidade || 1),
          produto.rows[0].preco,
          item.observacao || null
        ]
      );
    }

    if (mesa_id) {
      await client.query("update mesas set status = 'ocupada' where id = $1", [mesa_id]);
    }
    await client.query('update pedidos set atualizado_em = now() where id = $1', [pedido.id]);
    await client.query('commit');
    res.status(201).json(await pedidoCompleto(pedido.id));
  } catch (error) {
    await client.query('rollback');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
}));

app.get('/pedidos', asyncRoute(async (req, res) => {
  res.json(await listarPedidos(req.query.status));
}));

app.patch('/pedidos/:id', asyncRoute(async (req, res) => {
  const status = req.body.status;
  const prontoEm = status === 'pronto' ? ', pronto_em = coalesce(pronto_em, now())' : '';
  const pedidos = await query(
    `update pedidos set status = $1, atualizado_em = now() ${prontoEm} where id = $2 returning *`,
    [status, req.params.id]
  );
  if (!pedidos[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (['entregue', 'finalizado'].includes(status) && pedidos[0].mesa_id) {
    const abertos = await query(
      "select id from pedidos where mesa_id = $1 and status <> 'finalizado' and id <> $2",
      [pedidos[0].mesa_id, pedidos[0].id]
    );
    if (status === 'finalizado' && abertos.length === 0) {
      await query("update mesas set status = 'livre' where id = $1", [pedidos[0].mesa_id]);
    }
  }
  res.json(await pedidoCompleto(req.params.id));
}));

app.post('/pagamentos', asyncRoute(async (req, res) => {
  const { pedido_id, metodo, valor } = req.body;
  const pagamentos = await query(
    `insert into pagamentos (pedido_id, metodo, valor)
     values ($1, $2, $3) returning *`,
    [pedido_id, metodo, valor]
  );
  res.status(201).json(pagamentos[0]);
}));

app.get('/relatorios', asyncRoute(async (req, res) => {
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
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Erro interno da API.' });
});

app.listen(port, () => {
  console.log(`Bar Digital API em http://localhost:${port}`);
});
