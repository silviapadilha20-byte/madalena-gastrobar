const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { listarMesas, criarMesa, atualizarMesa, removerMesa } = require('../controllers/mesaController');

router.get('/', asyncRoute(listarMesas));
router.post('/', asyncRoute(criarMesa));
router.patch('/:id', asyncRoute(atualizarMesa));
router.delete('/:id', asyncRoute(removerMesa));

module.exports = router;
