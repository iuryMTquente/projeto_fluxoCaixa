/**
 * transacaoModel.js
 * Camada de acesso a dados para transações de caixa.
 */

const db = require('../database/db');

const TransacaoModel = {

  /**
   * Lista transações com filtros opcionais.
   * @param {Object} filtros - { dataInicio, dataFim, tipo, categoria, usuarioId, limite, offset }
   */
  listar({ dataInicio = null, dataFim = null, tipo = null, categoria = null,
           usuarioId = null, limite = 50, offset = 0 } = {}) {
    let sql = `
      SELECT t.*, u.nome as nome_usuario
      FROM transacoes t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (dataInicio) { sql += ' AND t.data_movimentacao >= ?'; params.push(dataInicio); }
    if (dataFim)    { sql += ' AND t.data_movimentacao <= ?'; params.push(dataFim); }
    if (tipo)       { sql += ' AND t.tipo_movimentacao = ?';  params.push(tipo); }
    if (categoria)  { sql += ' AND t.categoria = ?';          params.push(categoria); }
    if (usuarioId)  { sql += ' AND t.usuario_id = ?';         params.push(usuarioId); }

    sql += ' ORDER BY t.data_movimentacao DESC, t.criado_em DESC';
    sql += ' LIMIT ? OFFSET ?';
    params.push(limite, offset);

    return db.prepare(sql).all(...params);
  },

  /** Busca transação por ID. */
  buscarPorId(id) {
    return db.prepare(`
      SELECT t.*, u.nome as nome_usuario
      FROM transacoes t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = ?
    `).get(id);
  },

  /** Cria nova transação. */
  criar(dados) {
    const {
      tipo_movimentacao, descricao, valor, categoria = 'geral',
      forma_pagamento = 'dinheiro', usuario_id = null,
      produto_id = null, data_movimentacao
    } = dados;

    const stmt = db.prepare(`
      INSERT INTO transacoes
        (tipo_movimentacao, descricao, valor, categoria, forma_pagamento,
         usuario_id, produto_id, data_movimentacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      tipo_movimentacao, descricao, valor, categoria,
      forma_pagamento, usuario_id, produto_id, data_movimentacao
    );
    return this.buscarPorId(result.lastInsertRowid);
  },

  /** Remove transação permanentemente. */
  remover(id) {
    const info = db.prepare('DELETE FROM transacoes WHERE id = ?').run(id);
    return info.changes > 0;
  },

  /**
   * Calcula resumo financeiro (saldo, entradas, saídas).
   * @param {Object} filtros - { dataInicio, dataFim }
   */
  resumo({ dataInicio = null, dataFim = null } = {}) {
    let sql = `
      SELECT
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'saida'   THEN valor ELSE 0 END), 0) AS total_saidas
      FROM transacoes
      WHERE 1=1
    `;
    const params = [];

    if (dataInicio) { sql += ' AND data_movimentacao >= ?'; params.push(dataInicio); }
    if (dataFim)    { sql += ' AND data_movimentacao <= ?'; params.push(dataFim); }

    const row = db.prepare(sql).get(...params);
    return {
      total_entradas: row.total_entradas,
      total_saidas:   row.total_saidas,
      saldo:          row.total_entradas - row.total_saidas,
    };
  },

  /** Resumo do dia atual. */
  resumoDiario() {
    const hoje = new Date().toISOString().split('T')[0];
    return this.resumo({ dataInicio: hoje, dataFim: hoje });
  },

  /** Resumo do mês atual. */
  resumoMensal() {
    const agora = new Date();
    const inicio = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`;
    const fim    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
                     .toISOString().split('T')[0];
    return this.resumo({ dataInicio: inicio, dataFim: fim });
  },

  /** Últimas N transações (para dashboard). */
  ultimas(n = 5) {
    return db.prepare(`
      SELECT t.*, u.nome as nome_usuario
      FROM transacoes t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      ORDER BY t.criado_em DESC
      LIMIT ?
    `).all(n);
  },

  /** Vendas do dia atual. */
  vendasDia() {
    const hoje = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM transacoes
      WHERE tipo_movimentacao = 'entrada'
        AND categoria = 'vendas'
        AND data_movimentacao = ?
    `).get(hoje).total;
  },
};

module.exports = TransacaoModel;
