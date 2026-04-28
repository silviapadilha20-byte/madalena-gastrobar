const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { listarProdutos } = require('../controllers/produtoController');

router.get('/', asyncRoute(listarProdutos));

module.exports = router;
