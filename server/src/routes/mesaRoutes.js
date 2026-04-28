const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { listarMesas, criarMesa, atualizarMesa } = require('../controllers/mesaController');

router.get('/', asyncRoute(listarMesas));
router.post('/', asyncRoute(criarMesa));
router.patch('/:id', asyncRoute(atualizarMesa));

module.exports = router;
