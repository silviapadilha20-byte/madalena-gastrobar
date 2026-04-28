const { query } = require('../db');

async function listarProdutos(req, res) {
  const todos = req.query.todos === '1';
  const produtos = await query(
    `select id, nome, descricao, preco, categoria, disponivel, criado_em
     from produtos
     ${todos ? '' : 'where disponivel = true'}
     order by categoria, nome`
  );
  res.json(produtos);
}

module.exports = { listarProdutos };
