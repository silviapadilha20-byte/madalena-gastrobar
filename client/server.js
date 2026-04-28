const fs = require('fs');
const http = require('http');
const path = require('path');

const port = Number(process.env.PORT || 3001);
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const target = path.normalize(path.join(root, file));
  if (!target.startsWith(root) || !fs.existsSync(target)) {
    res.writeHead(404);
    return res.end('Não encontrado');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'text/plain' });
  res.end(fs.readFileSync(target));
}).listen(port, () => console.log(`Cliente QR em http://localhost:${port}`));
