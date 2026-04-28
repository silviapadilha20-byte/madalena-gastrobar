const cors = require('cors');
const express = require('express');

const healthRoutes = require('./routes/healthRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const mesaRoutes = require('./routes/mesaRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const pagamentoRoutes = require('./routes/pagamentoRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004'
]);

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  }
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bar Digital</title>
    <style>
      :root { font-family: Inter, Arial, sans-serif; color: #10231d; background: #f4f7f5; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
      main { width: min(920px, calc(100% - 32px)); }
      .brand { background: #123d32; color: #fff; padding: 28px; border-radius: 8px 8px 0 0; }
      .brand h1 { margin: 0 0 8px; font-size: clamp(30px, 6vw, 56px); }
      .brand p { margin: 0; color: #d9e8df; font-weight: 700; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; background: white; padding: 18px; border: 1px solid #dbe4de; border-top: 0; border-radius: 0 0 8px 8px; }
      a { display: grid; gap: 8px; min-height: 108px; padding: 16px; border: 1px solid #dbe4de; border-radius: 8px; color: #10231d; text-decoration: none; background: #fbfdfc; }
      a strong { font-size: 20px; }
      a span { color: #5d6c63; font-weight: 700; }
      .api { margin-top: 14px; color: #5d6c63; font-weight: 800; }
      code { background: #e7eee9; padding: 3px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main>
      <section class="brand">
        <h1>Bar Digital</h1>
        <p>Backend API ativo. Escolha uma aplicação para abrir.</p>
      </section>
      <section class="grid">
        <a href="http://localhost:3001/?mesa=1"><strong>Cliente QR</strong><span>Cardápio e pedido por mesa</span></a>
        <a href="http://localhost:3002/"><strong>Admin</strong><span>Backoffice e comandas</span></a>
        <a href="http://localhost:3003/"><strong>KDS</strong><span>Cozinha e preparo</span></a>
        <a href="http://localhost:3004/"><strong>BI</strong><span>Indicadores e relatórios</span></a>
      </section>
      <p class="api">Teste da API: <a href="/health"><code>/health</code></a></p>
    </main>
  </body>
</html>`);
});

app.use('/health', healthRoutes);
app.use('/produtos', produtoRoutes);
app.use('/mesas', mesaRoutes);
app.use('/pedidos', pedidoRoutes);
app.use('/pagamentos', pagamentoRoutes);
app.use('/relatorios', relatorioRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Erro interno da API.' });
});

module.exports = app;
