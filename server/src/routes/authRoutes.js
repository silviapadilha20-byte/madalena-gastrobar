const router = require('express').Router();
const asyncRoute = require('./asyncRoute');
const { login, me } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.post('/login', asyncRoute(login));
router.get('/me', requireAuth(), asyncRoute(me));

module.exports = router;
