const { query } = require('../db');
const { verifyPassword } = require('../auth/password');
const { signToken } = require('../auth/token');

async function login(req, res) {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const [usuario] = await query('select * from usuarios where lower(email) = lower($1) and ativo = true', [email]);
  if (!usuario || !verifyPassword(senha, usuario.senha_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  const user = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  res.json({ token: signToken(user), usuario: user });
}

async function me(req, res) {
  res.json({ usuario: req.user });
}

module.exports = { login, me };
