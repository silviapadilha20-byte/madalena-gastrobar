const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { listarPedidos, criarPedido, atualizarPedido } = require('../controllers/pedidoController');
const { optionalAuth } = require('../middlewares/authMiddleware');

router.get('/', asyncRoute(listarPedidos));
router.post('/', optionalAuth, asyncRoute(criarPedido));
router.patch('/:id', optionalAuth, asyncRoute(atualizarPedido));

module.exports = router;
