const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { obterConfiguracoes, salvarConfiguracoes } = require('../controllers/configuracaoController');

router.get('/pagamento', asyncRoute(obterConfiguracoes));
router.put('/pagamento', asyncRoute(salvarConfiguracoes));

module.exports = router;
