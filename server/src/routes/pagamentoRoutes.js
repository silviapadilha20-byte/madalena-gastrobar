const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { criarPagamento, webhookPagamento } = require('../controllers/pagamentoController');

router.post('/', asyncRoute(criarPagamento));
router.post('/webhook/:gateway', asyncRoute(webhookPagamento));

module.exports = router;
