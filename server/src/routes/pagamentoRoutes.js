const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { criarPagamento } = require('../controllers/pagamentoController');

router.post('/', asyncRoute(criarPagamento));

module.exports = router;
