const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', '.env');
const content = [
  'PORT=3000',
  'DATABASE_URL=postgresql://bar_digital:bar_digital_123@localhost:5432/bar_digital'
].join('\n');

fs.writeFileSync(target, `${content}\n`);
console.log('server/.env configurado para PostgreSQL local.');
