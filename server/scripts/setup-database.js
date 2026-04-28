const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não configurada em server/.env.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase.co') || process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

async function run(file) {
  const sql = fs.readFileSync(path.join(root, 'database', file), 'utf8');
  await pool.query(sql);
  console.log(`${file} executado.`);
}

async function main() {
  try {
    await run('schema.sql');
    await run('seed.sql');
    console.log('Banco pronto para o Bar Digital.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
