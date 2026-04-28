const jwt = require('jsonwebtoken');

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nivel: usuario.nivel
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token não enviado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

module.exports = { gerarToken, verificarToken };