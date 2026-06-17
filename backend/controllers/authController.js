/**
 * authController.js
 * Controla autenticação: login, logout, perfil e troca de senha.
 */

const bcrypt         = require('bcryptjs');
const UsuarioModel   = require('../models/usuarioModel');
const { gerarToken } = require('../middlewares/auth');
const { registrarLog, extrairIP } = require('../middlewares/logger');
const { lerCorpoJSON, sanitizar, validarEmail } = require('../middlewares/validacao');

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

const AuthController = {

  /** POST /api/auth/login */
  async login(req, res) {
    try {
      const corpo = await lerCorpoJSON(req);
      const email = sanitizar(corpo.email || '');
      const senha = corpo.senha || '';

      if (!email || !senha) {
        return responderJSON(res, 400, { erro: 'E-mail e senha são obrigatórios.' });
      }

      const usuario = UsuarioModel.buscarPorEmail(email);

      if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
        registrarLog({ acao: 'LOGIN_FALHOU', detalhes: `email: ${email}`, ip: extrairIP(req) });
        return responderJSON(res, 401, { erro: 'E-mail ou senha incorretos.' });
      }

      if (!usuario.status) {
        return responderJSON(res, 403, { erro: 'Conta desativada. Contate o administrador.' });
      }

      const token = gerarToken({
        id:           usuario.id,
        nome:         usuario.nome,
        email:        usuario.email,
        tipo_usuario: usuario.tipo_usuario,
      });

      registrarLog({
        usuarioId: usuario.id,
        acao:      'LOGIN',
        detalhes:  `email: ${email}`,
        ip:        extrairIP(req),
      });

      return responderJSON(res, 200, {
        token,
        usuario: {
          id:           usuario.id,
          nome:         usuario.nome,
          email:        usuario.email,
          tipo_usuario: usuario.tipo_usuario,
        },
      });
    } catch (err) {
      console.error('[AuthController.login]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },

  /** GET /api/auth/perfil — retorna dados do usuário logado */
  perfil(req, res) {
    const usuario = UsuarioModel.buscarPorId(req.usuario.id);
    if (!usuario) return responderJSON(res, 404, { erro: 'Usuário não encontrado.' });
    return responderJSON(res, 200, { usuario });
  },

  /** PUT /api/auth/senha — troca a senha do usuário logado */
  async trocarSenha(req, res) {
    try {
      const corpo = await lerCorpoJSON(req);
      const { senha_atual, nova_senha } = corpo;

      if (!senha_atual || !nova_senha) {
        return responderJSON(res, 400, { erro: 'Senha atual e nova senha são obrigatórias.' });
      }
      if (nova_senha.length < 6) {
        return responderJSON(res, 400, { erro: 'A nova senha deve ter ao menos 6 caracteres.' });
      }

      // Busca com senha para comparar
      const usuario = UsuarioModel.buscarPorEmail(req.usuario.email);
      if (!bcrypt.compareSync(senha_atual, usuario.senha)) {
        return responderJSON(res, 400, { erro: 'Senha atual incorreta.' });
      }

      const novoHash = bcrypt.hashSync(nova_senha, 10);
      UsuarioModel.atualizarSenha(req.usuario.id, novoHash);

      registrarLog({ usuarioId: req.usuario.id, acao: 'TROCA_SENHA', ip: extrairIP(req) });
      return responderJSON(res, 200, { mensagem: 'Senha alterada com sucesso.' });
    } catch (err) {
      console.error('[AuthController.trocarSenha]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },
};

module.exports = AuthController;
