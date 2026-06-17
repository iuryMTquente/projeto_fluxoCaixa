/**
 * produtoController.js
 * CRUD de produtos e controle de estoque.
 */

const ProdutoModel = require('../models/produtoModel');
const { registrarLog, extrairIP } = require('../middlewares/logger');
const { lerCorpoJSON, sanitizar, validarValorPositivo } = require('../middlewares/validacao');

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

/** Valida campos obrigatórios de produto. */
function validarProduto(dados) {
  const erros = [];
  if (!dados.nome_produto || String(dados.nome_produto).trim().length < 2)
    erros.push('Nome do produto é obrigatório (mínimo 2 caracteres).');
  if (dados.preco_custo !== undefined && parseFloat(dados.preco_custo) < 0)
    erros.push('Preço de custo não pode ser negativo.');
  if (dados.preco_venda !== undefined && parseFloat(dados.preco_venda) < 0)
    erros.push('Preço de venda não pode ser negativo.');
  if (dados.quantidade_estoque !== undefined && parseInt(dados.quantidade_estoque) < 0)
    erros.push('Quantidade em estoque não pode ser negativa.');
  return erros;
}

const ProdutoController = {

  /** GET /api/produtos */
  listar(req, res) {
    const url    = new URL(req.url, 'http://localhost');
    const busca  = url.searchParams.get('busca')     || null;
    const cat    = url.searchParams.get('categoria') || null;
    const todos  = url.searchParams.get('todos')     === 'true';

    const produtos = ProdutoModel.listar({ busca, categoria: cat, apenasAtivos: !todos });
    const categorias = ProdutoModel.listarCategorias();
    return responderJSON(res, 200, { produtos, categorias });
  },

  /** GET /api/produtos/estoque-baixo */
  estoqueBaixo(req, res) {
    const produtos = ProdutoModel.estoqueBaixo();
    return responderJSON(res, 200, { produtos });
  },

  /** GET /api/produtos/:id */
  buscar(req, res, id) {
    const produto = ProdutoModel.buscarPorId(id);
    if (!produto) return responderJSON(res, 404, { erro: 'Produto não encontrado.' });
    return responderJSON(res, 200, { produto });
  },

  /** POST /api/produtos */
  async criar(req, res) {
    try {
      const corpo = await lerCorpoJSON(req);

      // Sanitiza strings
      corpo.nome_produto  = sanitizar(corpo.nome_produto  || '');
      corpo.codigo_barras = sanitizar(corpo.codigo_barras || '') || null;
      corpo.categoria     = sanitizar(corpo.categoria     || 'geral');
      corpo.descricao     = sanitizar(corpo.descricao     || '') || null;
      corpo.fornecedor    = sanitizar(corpo.fornecedor    || '') || null;

      const erros = validarProduto(corpo);
      if (erros.length) return responderJSON(res, 400, { erros });

      // Verifica código de barras duplicado
      if (corpo.codigo_barras && ProdutoModel.buscarPorCodigo(corpo.codigo_barras)) {
        return responderJSON(res, 409, { erro: 'Código de barras já cadastrado.' });
      }

      const produto = ProdutoModel.criar(corpo);

      registrarLog({
        usuarioId: req.usuario.id,
        acao:      'CRIAR_PRODUTO',
        detalhes:  `id: ${produto.id}, nome: ${produto.nome_produto}`,
        ip:        extrairIP(req),
      });

      return responderJSON(res, 201, { produto });
    } catch (err) {
      console.error('[ProdutoController.criar]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },

  /** PUT /api/produtos/:id */
  async atualizar(req, res, id) {
    try {
      const existente = ProdutoModel.buscarPorId(id);
      if (!existente) return responderJSON(res, 404, { erro: 'Produto não encontrado.' });

      const corpo = await lerCorpoJSON(req);

      corpo.nome_produto  = sanitizar(corpo.nome_produto  || '');
      corpo.codigo_barras = sanitizar(corpo.codigo_barras || '') || null;
      corpo.categoria     = sanitizar(corpo.categoria     || 'geral');
      corpo.descricao     = sanitizar(corpo.descricao     || '') || null;
      corpo.fornecedor    = sanitizar(corpo.fornecedor    || '') || null;

      const erros = validarProduto(corpo);
      if (erros.length) return responderJSON(res, 400, { erros });

      // Verifica código de barras duplicado (excluindo o próprio)
      if (corpo.codigo_barras) {
        const outro = ProdutoModel.buscarPorCodigo(corpo.codigo_barras);
        if (outro && outro.id !== parseInt(id)) {
          return responderJSON(res, 409, { erro: 'Código de barras já em uso por outro produto.' });
        }
      }

      const produto = ProdutoModel.atualizar(id, corpo);

      registrarLog({
        usuarioId: req.usuario.id,
        acao:      'ATUALIZAR_PRODUTO',
        detalhes:  `id: ${id}`,
        ip:        extrairIP(req),
      });

      return responderJSON(res, 200, { produto });
    } catch (err) {
      console.error('[ProdutoController.atualizar]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },

  /** DELETE /api/produtos/:id */
  desativar(req, res, id) {
    const existente = ProdutoModel.buscarPorId(id);
    if (!existente) return responderJSON(res, 404, { erro: 'Produto não encontrado.' });

    ProdutoModel.desativar(id);

    registrarLog({
      usuarioId: req.usuario.id,
      acao:      'DESATIVAR_PRODUTO',
      detalhes:  `id: ${id}`,
      ip:        extrairIP(req),
    });

    return responderJSON(res, 200, { mensagem: 'Produto desativado com sucesso.' });
  },
};

module.exports = ProdutoController;
