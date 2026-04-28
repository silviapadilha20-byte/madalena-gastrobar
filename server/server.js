const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const { pool } = require('./src/db');

const port = Number(process.env.PORT || 3000);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não configurada. Crie o arquivo server/.env.');
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`Bar Digital API rodando em http://localhost:${port}`);
});

process.on('SIGINT', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
