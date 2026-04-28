const { query } = require('../db');

async function listarProdutos(req, res) {
  const todos = req.query.todos === '1';
  const produtos = await query(
    `select id, nome, descricao, preco, preco_promocional, categoria, imagem_url, disponivel, criado_em
     from produtos
     ${todos ? '' : 'where disponivel = true'}
     order by categoria, nome`
  );
  res.json(produtos);
}

async function criarProduto(req, res) {
  const { nome, descricao, preco, preco_promocional, categoria, imagem_url, disponivel = true } = req.body;
  if (!nome || preco === undefined || !categoria) {
    return res.status(400).json({ error: 'Informe nome, preço e categoria.' });
  }
  const produtos = await query(
    `insert into produtos (nome, descricao, preco, preco_promocional, categoria, imagem_url, disponivel)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [nome, descricao || null, preco, preco_promocional || null, categoria, imagem_url || null, disponivel]
  );
  res.status(201).json(produtos[0]);
}

async function atualizarProduto(req, res) {
  const { nome, descricao, preco, preco_promocional, categoria, imagem_url, disponivel } = req.body;
  const produtos = await query(
    `update produtos set
      nome = coalesce($1, nome),
      descricao = coalesce($2, descricao),
      preco = coalesce($3, preco),
      preco_promocional = $4,
      categoria = coalesce($5, categoria),
      imagem_url = coalesce($6, imagem_url),
      disponivel = coalesce($7, disponivel)
     where id = $8
     returning *`,
    [nome, descricao, preco, preco_promocional || null, categoria, imagem_url, disponivel, req.params.id]
  );
  if (!produtos[0]) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json(produtos[0]);
}

async function removerProduto(req, res) {
  const produtos = await query('delete from produtos where id = $1 returning id', [req.params.id]);
  if (!produtos[0]) return res.status(404).json({ error: 'Produto não encontrado.' });
  res.json({ ok: true });
}

module.exports = { listarProdutos, criarProduto, atualizarProduto, removerProduto };
