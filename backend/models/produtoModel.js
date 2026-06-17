/**
 * produtoModel.js
 * Camada de acesso a dados para produtos e estoque.
 */

const db = require('../database/db');

const ProdutoModel = {

  /** Lista todos os produtos ativos com filtros opcionais. */
  listar({ categoria = null, busca = null, apenasAtivos = true } = {}) {
    let sql = 'SELECT * FROM produtos WHERE 1=1';
    const params = [];

    if (apenasAtivos) { sql += ' AND status = 1'; }
    if (categoria)    { sql += ' AND categoria = ?'; params.push(categoria); }
    if (busca) {
      sql += ' AND (nome_produto LIKE ? OR codigo_barras LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }

    sql += ' ORDER BY nome_produto';
    return db.prepare(sql).all(...params);
  },

  /** Busca produto por ID. */
  buscarPorId(id) {
    return db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
  },

  /** Busca produto por código de barras. */
  buscarPorCodigo(codigo) {
    return db.prepare('SELECT * FROM produtos WHERE codigo_barras = ?').get(codigo);
  },

  /** Cria novo produto. */
  criar(dados) {
    const {
      nome_produto, codigo_barras = null, categoria = 'geral', descricao = null,
      preco_custo = 0, preco_venda = 0, quantidade_estoque = 0,
      estoque_minimo = 5, fornecedor = null
    } = dados;

    const stmt = db.prepare(`
      INSERT INTO produtos
        (nome_produto, codigo_barras, categoria, descricao, preco_custo,
         preco_venda, quantidade_estoque, estoque_minimo, fornecedor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      nome_produto, codigo_barras, categoria, descricao,
      preco_custo, preco_venda, quantidade_estoque, estoque_minimo, fornecedor
    );
    return this.buscarPorId(result.lastInsertRowid);
  },

  /** Atualiza produto existente. */
  atualizar(id, dados) {
    const {
      nome_produto, codigo_barras, categoria, descricao,
      preco_custo, preco_venda, quantidade_estoque, estoque_minimo, fornecedor
    } = dados;

    db.prepare(`
      UPDATE produtos SET
        nome_produto = ?, codigo_barras = ?, categoria = ?, descricao = ?,
        preco_custo = ?, preco_venda = ?, quantidade_estoque = ?,
        estoque_minimo = ?, fornecedor = ?
      WHERE id = ?
    `).run(
      nome_produto, codigo_barras ?? null, categoria, descricao ?? null,
      preco_custo, preco_venda, quantidade_estoque, estoque_minimo,
      fornecedor ?? null, id
    );
    return this.buscarPorId(id);
  },

  /** Exclusão lógica do produto. */
  desativar(id) {
    db.prepare('UPDATE produtos SET status = 0 WHERE id = ?').run(id);
  },

  /** Atualiza quantidade em estoque (positivo = entrada, negativo = saída). */
  atualizarEstoque(id, quantidade) {
    db.prepare(`
      UPDATE produtos SET quantidade_estoque = quantidade_estoque + ?
      WHERE id = ? AND quantidade_estoque + ? >= 0
    `).run(quantidade, id, quantidade);
    return this.buscarPorId(id);
  },

  /** Retorna produtos com estoque abaixo do mínimo. */
  estoqueBaixo() {
    return db.prepare(`
      SELECT * FROM produtos
      WHERE status = 1 AND quantidade_estoque <= estoque_minimo
      ORDER BY quantidade_estoque ASC
    `).all();
  },

  /** Lista categorias distintas cadastradas. */
  listarCategorias() {
    return db.prepare(
      'SELECT DISTINCT categoria FROM produtos WHERE status = 1 ORDER BY categoria'
    ).all().map(r => r.categoria);
  },

  /** Contagem total de produtos ativos. */
  contar() {
    return db.prepare('SELECT COUNT(*) as total FROM produtos WHERE status = 1').get().total;
  },
};

module.exports = ProdutoModel;
