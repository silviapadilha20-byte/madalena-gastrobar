const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { requireAuth } = require('../middlewares/authMiddleware');
const {
  historicoPorTelefone,
  criarChamado,
  listarChamados,
  atualizarChamado,
  avaliarPedido,
  pedirConta
} = require('../controllers/clienteController');

router.get('/historico', asyncRoute(historicoPorTelefone));
router.post('/chamados', asyncRoute(criarChamado));
router.get('/chamados', requireAuth(['admin', 'garcom', 'caixa', 'gerente']), asyncRoute(listarChamados));
router.patch('/chamados/:id', requireAuth(['admin', 'garcom', 'caixa', 'gerente']), asyncRoute(atualizarChamado));
router.post('/pedidos/:id/avaliacao', asyncRoute(avaliarPedido));
router.post('/pedidos/:id/pedir-conta', asyncRoute(pedirConta));

module.exports = router;
