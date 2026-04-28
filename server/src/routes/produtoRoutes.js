const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { listarProdutos, criarProduto, atualizarProduto, removerProduto } = require('../controllers/produtoController');

router.get('/', asyncRoute(listarProdutos));
router.post('/', asyncRoute(criarProduto));
router.patch('/:id', asyncRoute(atualizarProduto));
router.delete('/:id', asyncRoute(removerProduto));

module.exports = router;
