const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { listarPedidos, criarPedido, atualizarPedido } = require('../controllers/pedidoController');

router.get('/', asyncRoute(listarPedidos));
router.post('/', asyncRoute(criarPedido));
router.patch('/:id', asyncRoute(atualizarPedido));

module.exports = router;
