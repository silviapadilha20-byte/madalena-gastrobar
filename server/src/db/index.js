const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const normalizedConnectionString = connectionString?.replace(/[?&]sslmode=require/g, '');

const pool = new Pool({
  connectionString: normalizedConnectionString,
  ssl: connectionString && (connectionString.includes('supabase.co') || connectionString.includes('sslmode=require'))
    ? { rejectUnauthorized: false }
    : undefined
});

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await callback(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
