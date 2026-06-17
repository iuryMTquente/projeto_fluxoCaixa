/**
 * usuarioController.js
 * CRUD de usuários — acesso restrito a ADMIN.
 */

const bcrypt       = require('bcryptjs');
const UsuarioModel = require('../models/usuarioModel');
const { registrarLog, extrairIP } = require('../middlewares/logger');
const { lerCorpoJSON, sanitizar, validarEmail } = require('../middlewares/validacao');

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

const UsuarioController = {

  /** GET /api/usuarios */
  listar(req, res) {
    const usuarios = UsuarioModel.listarTodos();
    return responderJSON(res, 200, { usuarios });
  },

  /** GET /api/usuarios/:id */
  buscar(req, res, id) {
    const usuario = UsuarioModel.buscarPorId(id);
    if (!usuario) return responderJSON(res, 404, { erro: 'Usuário não encontrado.' });
    return responderJSON(res, 200, { usuario });
  },

  /** POST /api/usuarios */
  async criar(req, res) {
    try {
      const corpo = await lerCorpoJSON(req);
      const erros = [];

      const nome         = sanitizar(corpo.nome || '');
      const email        = sanitizar(corpo.email || '').toLowerCase();
      const senha        = corpo.senha || '';
      const telefone     = sanitizar(corpo.telefone || '') || null;
      const tipo_usuario = corpo.tipo_usuario || 'USUARIO_NORMAL';

      if (nome.length < 2)   erros.push('Nome deve ter ao menos 2 caracteres.');
      if (!validarEmail(email)) erros.push('E-mail inválido.');
      if (senha.length < 6)  erros.push('Senha deve ter ao menos 6 caracteres.');
      if (!['ADMIN', 'USUARIO_NORMAL'].includes(tipo_usuario))
        erros.push('Tipo de usuário inválido.');

      if (erros.length) return responderJSON(res, 400, { erros });

      if (UsuarioModel.emailEmUso(email)) {
        return responderJSON(res, 409, { erro: 'E-mail já cadastrado.' });
      }

      const senhaHash = bcrypt.hashSync(senha, 10);
      const usuario   = UsuarioModel.criar({ nome, email, senha: senhaHash, telefone, tipo_usuario });

      registrarLog({
        usuarioId: req.usuario.id,
        acao:      'CRIAR_USUARIO',
        detalhes:  `id: ${usuario.id}, email: ${email}`,
        ip:        extrairIP(req),
      });

      return responderJSON(res, 201, { usuario });
    } catch (err) {
      console.error('[UsuarioController.criar]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },

  /** PUT /api/usuarios/:id */
  async atualizar(req, res, id) {
    try {
      const existente = UsuarioModel.buscarPorId(id);
      if (!existente) return responderJSON(res, 404, { erro: 'Usuário não encontrado.' });

      const corpo = await lerCorpoJSON(req);
      const erros = [];

      const nome         = sanitizar(corpo.nome || '');
      const email        = sanitizar(corpo.email || '').toLowerCase();
      const telefone     = sanitizar(corpo.telefone || '') || null;
      const tipo_usuario = corpo.tipo_usuario || existente.tipo_usuario;

      if (nome.length < 2)      erros.push('Nome deve ter ao menos 2 caracteres.');
      if (!validarEmail(email)) erros.push('E-mail inválido.');
      if (!['ADMIN', 'USUARIO_NORMAL'].includes(tipo_usuario))
        erros.push('Tipo de usuário inválido.');

      if (erros.length) return responderJSON(res, 400, { erros });

      if (UsuarioModel.emailEmUso(email, id)) {
        return responderJSON(res, 409, { erro: 'E-mail já em uso por outro usuário.' });
      }

      const usuario = UsuarioModel.atualizar(id, { nome, email, telefone, tipo_usuario });

      registrarLog({
        usuarioId: req.usuario.id,
        acao:      'ATUALIZAR_USUARIO',
        detalhes:  `id: ${id}`,
        ip:        extrairIP(req),
      });

      return responderJSON(res, 200, { usuario });
    } catch (err) {
      console.error('[UsuarioController.atualizar]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },

  /** DELETE /api/usuarios/:id — exclusão lógica */
  desativar(req, res, id) {
    // Impede que o admin desative a si mesmo
    if (parseInt(id) === req.usuario.id) {
      return responderJSON(res, 400, { erro: 'Você não pode desativar sua própria conta.' });
    }

    const existente = UsuarioModel.buscarPorId(id);
    if (!existente) return responderJSON(res, 404, { erro: 'Usuário não encontrado.' });

    UsuarioModel.desativar(id);

    registrarLog({
      usuarioId: req.usuario.id,
      acao:      'DESATIVAR_USUARIO',
      detalhes:  `id: ${id}`,
      ip:        extrairIP(req),
    });

    return responderJSON(res, 200, { mensagem: 'Usuário desativado com sucesso.' });
  },

  /** PATCH /api/usuarios/:id/ativar */
  ativar(req, res, id) {
    const existente = UsuarioModel.buscarPorId(id);
    if (!existente) return responderJSON(res, 404, { erro: 'Usuário não encontrado.' });

    UsuarioModel.ativar(id);

    registrarLog({
      usuarioId: req.usuario.id,
      acao:      'ATIVAR_USUARIO',
      detalhes:  `id: ${id}`,
      ip:        extrairIP(req),
    });

    return responderJSON(res, 200, { mensagem: 'Usuário ativado com sucesso.' });
  },
};

module.exports = UsuarioController;
