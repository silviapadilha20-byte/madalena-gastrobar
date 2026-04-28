const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { obterRelatorios } = require('../controllers/relatorioController');

router.get('/', asyncRoute(obterRelatorios));

module.exports = router;
