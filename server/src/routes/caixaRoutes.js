const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { requireAuth } = require('../middlewares/authMiddleware');
const { caixaAtual, abrirCaixa, criarMovimento, fecharCaixa } = require('../controllers/caixaController');

router.get('/atual', requireAuth(['admin', 'caixa', 'gerente']), asyncRoute(caixaAtual));
router.post('/abrir', requireAuth(['admin', 'caixa', 'gerente']), asyncRoute(abrirCaixa));
router.post('/movimentos', requireAuth(['admin', 'caixa', 'gerente']), asyncRoute(criarMovimento));
router.post('/fechar', requireAuth(['admin', 'caixa', 'gerente']), asyncRoute(fecharCaixa));

module.exports = router;
