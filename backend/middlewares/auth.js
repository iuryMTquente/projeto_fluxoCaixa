/**
 * auth.js
 * Middlewares de autenticação e autorização via JWT.
 *
 * autenticar   → verifica se o token JWT é válido
 * autorizar    → verifica se o usuário tem o tipo necessário
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'fluxo_caixa_secret_2024';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/**
 * Gera um token JWT para o usuário autenticado.
 * @param {Object} payload - { id, nome, email, tipo_usuario }
 * @returns {string} token JWT
 */
function gerarToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Middleware: verifica se a requisição possui um token JWT válido.
 * O token deve ser enviado no header: Authorization: Bearer <token>
 * Injeta req.usuario com os dados do payload.
 */
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return responderNaoAutorizado(res, 'Token de autenticação não fornecido.');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario   = payload;
    next(req, res);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return responderNaoAutorizado(res, 'Sessão expirada. Faça login novamente.');
    }
    return responderNaoAutorizado(res, 'Token inválido.');
  }
}

/**
 * Middleware factory: verifica se o usuário possui o tipo exigido.
 * Deve ser usado após autenticar().
 * @param {...string} tipos - tipos permitidos (ex: 'ADMIN', 'USUARIO_NORMAL')
 * @returns {Function} middleware
 */
function autorizar(...tipos) {
  return function(req, res, next) {
    if (!req.usuario) {
      return responderNaoAutorizado(res, 'Não autenticado.');
    }
    if (!tipos.includes(req.usuario.tipo_usuario)) {
      return responderProibido(res, 'Acesso negado. Permissão insuficiente.');
    }
    next(req, res);
  };
}

// ─── Helpers de resposta ──────────────────────────────────────────────────────

function responderNaoAutorizado(res, mensagem) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ erro: mensagem }));
}

function responderProibido(res, mensagem) {
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ erro: mensagem }));
}

module.exports = { gerarToken, autenticar, autorizar };
