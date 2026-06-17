/**
 * validacao.js
 * Funções utilitárias de validação e sanitização de dados.
 * Previne XSS e garante integridade dos dados recebidos.
 */

/**
 * Remove tags HTML e caracteres perigosos para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function sanitizar(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Valida formato de e-mail.
 * @param {string} email
 * @returns {boolean}
 */
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email).toLowerCase());
}

/**
 * Valida formato de data YYYY-MM-DD.
 * @param {string} data
 * @returns {boolean}
 */
function validarData(data) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(data)) return false;
  const d = new Date(data);
  return d instanceof Date && !isNaN(d);
}

/**
 * Valida se o valor é um número positivo.
 * @param {*} valor
 * @returns {boolean}
 */
function validarValorPositivo(valor) {
  const n = parseFloat(valor);
  return !isNaN(n) && n > 0;
}

/**
 * Lê o corpo JSON da requisição de forma segura.
 * Limita o tamanho para prevenir ataques de payload gigante.
 * @param {IncomingMessage} req
 * @param {number} [limiteBytes=1048576] - 1MB padrão
 * @returns {Promise<Object>}
 */
function lerCorpoJSON(req, limiteBytes = 1_048_576) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    let tamanho = 0;

    req.on('data', (chunk) => {
      tamanho += chunk.length;
      if (tamanho > limiteBytes) {
        reject(new Error('Payload muito grande.'));
        req.destroy();
        return;
      }
      corpo += chunk.toString();
    });

    req.on('end', () => {
      try {
        resolve(corpo ? JSON.parse(corpo) : {});
      } catch {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });

    req.on('error', reject);
  });
}

module.exports = { sanitizar, validarEmail, validarData, validarValorPositivo, lerCorpoJSON };
