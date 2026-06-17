/**
 * logger.js
 * Middleware de log de ações do sistema.
 * Registra ações importantes no banco de dados e no console.
 */

const db = require('../database/db');

/**
 * Registra uma ação no banco de dados (tabela logs).
 * @param {Object} opcoes
 * @param {number|null} opcoes.usuarioId
 * @param {string}      opcoes.acao       - ex: 'LOGIN', 'CRIAR_PRODUTO'
 * @param {string}      [opcoes.detalhes] - JSON ou texto descritivo
 * @param {string}      [opcoes.ip]
 */
function registrarLog(opcoes) {
  const { usuarioId = null, acao, detalhes = null, ip = null } = opcoes;

  try {
    const stmt = db.prepare(`
      INSERT INTO logs (usuario_id, acao, detalhes, ip)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(usuarioId, acao, detalhes, ip);

    // Log no console com timestamp
    const ts = new Date().toLocaleString('pt-BR');
    console.log(`[${ts}] [LOG] ${acao} | usuário: ${usuarioId ?? 'anônimo'} | ${detalhes ?? ''}`);
  } catch (err) {
    // Falha no log não deve derrubar a aplicação
    console.error('[LOG ERROR]', err.message);
  }
}

/**
 * Extrai o IP real da requisição (considera proxies).
 * @param {IncomingMessage} req
 * @returns {string}
 */
function extrairIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'desconhecido'
  );
}

module.exports = { registrarLog, extrairIP };
