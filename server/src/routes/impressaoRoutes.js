const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { requireAuth } = require('../middlewares/authMiddleware');
const { listarImpressoes, reimprimirPedido, atualizarImpressao } = require('../controllers/impressaoController');

router.get('/', requireAuth(['admin', 'garcom', 'cozinha', 'caixa', 'gerente']), asyncRoute(listarImpressoes));
router.post('/pedidos/:id', requireAuth(['admin', 'garcom', 'cozinha', 'caixa', 'gerente']), asyncRoute(reimprimirPedido));
router.patch('/:id', requireAuth(['admin', 'cozinha', 'caixa', 'gerente']), asyncRoute(atualizarImpressao));

module.exports = router;
