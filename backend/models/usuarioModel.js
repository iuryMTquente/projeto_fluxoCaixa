/**
 * usuarioModel.js
 * Camada de acesso a dados para usuários.
 * Todas as queries SQL de usuários passam por aqui.
 */

const db = require('../database/db');

const UsuarioModel = {

  /** Busca usuário por e-mail (usado no login). */
  buscarPorEmail(email) {
    return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  },

  /** Busca usuário por ID (sem retornar a senha). */
  buscarPorId(id) {
    return db.prepare(
      'SELECT id, nome, email, telefone, status, tipo_usuario, data_criacao FROM usuarios WHERE id = ?'
    ).get(id);
  },

  /** Lista todos os usuários (sem senhas). Apenas ADMIN. */
  listarTodos() {
    return db.prepare(
      'SELECT id, nome, email, telefone, status, tipo_usuario, data_criacao FROM usuarios ORDER BY nome'
    ).all();
  },

  /** Cria novo usuário. Senha já deve vir criptografada. */
  criar(dados) {
    const { nome, email, senha, telefone = null, tipo_usuario = 'USUARIO_NORMAL' } = dados;
    const stmt = db.prepare(`
      INSERT INTO usuarios (nome, email, senha, telefone, tipo_usuario)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(nome, email, senha, telefone, tipo_usuario);
    return this.buscarPorId(result.lastInsertRowid);
  },

  /** Atualiza dados do usuário (sem alterar senha). */
  atualizar(id, dados) {
    const { nome, email, telefone, tipo_usuario } = dados;
    db.prepare(`
      UPDATE usuarios SET nome = ?, email = ?, telefone = ?, tipo_usuario = ?
      WHERE id = ?
    `).run(nome, email, telefone ?? null, tipo_usuario, id);
    return this.buscarPorId(id);
  },

  /** Atualiza senha do usuário. Senha já deve vir criptografada. */
  atualizarSenha(id, senhaHash) {
    db.prepare('UPDATE usuarios SET senha = ? WHERE id = ?').run(senhaHash, id);
  },

  /** Exclusão lógica: desativa o usuário sem remover do banco. */
  desativar(id) {
    db.prepare('UPDATE usuarios SET status = 0 WHERE id = ?').run(id);
  },

  /** Reativa um usuário desativado. */
  ativar(id) {
    db.prepare('UPDATE usuarios SET status = 1 WHERE id = ?').run(id);
  },

  /** Verifica se e-mail já está em uso (excluindo o próprio usuário na edição). */
  emailEmUso(email, excluirId = null) {
    const stmt = excluirId
      ? db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?')
      : db.prepare('SELECT id FROM usuarios WHERE email = ?');
    const args = excluirId ? [email, excluirId] : [email];
    return !!stmt.get(...args);
  },
};

module.exports = UsuarioModel;
