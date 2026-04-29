const { verifyToken } = require('../auth/token');

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  req.user = token ? verifyToken(token) : null;
  next();
}

function requireAuth(perfis = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const user = token ? verifyToken(token) : null;
    if (!user) return res.status(401).json({ error: 'Login necessário.' });
    if (perfis.length && !perfis.includes(user.perfil)) {
      return res.status(403).json({ error: 'Usuário sem permissão para esta ação.' });
    }
    req.user = user;
    return next();
  };
}

module.exports = { optionalAuth, requireAuth };
