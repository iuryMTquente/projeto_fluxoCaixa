/**
 * transacaoController.js
 * CRUD de transações de caixa (entradas e saídas).
 */

const TransacaoModel = require('../models/transacaoModel');
const ProdutoModel   = require('../models/produtoModel');
const { registrarLog, extrairIP } = require('../middlewares/logger');
const { lerCorpoJSON, sanitizar, validarData, validarValorPositivo } = require('../middlewares/validacao');

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

const TIPOS_VALIDOS    = ['entrada', 'saida'];
const PAGAMENTOS_VALIDOS = ['dinheiro','cartao_debito','cartao_credito','pix','transferencia','outro'];

function validarTransacao(dados) {
  const erros = [];
  if (!TIPOS_VALIDOS.includes(dados.tipo_movimentacao))
    erros.push('Tipo de movimentação deve ser "entrada" ou "saida".');
  if (!dados.descricao || String(dados.descricao).trim().length < 2)
    erros.push('Descrição é obrigatória (mínimo 2 caracteres).');
  if (!validarValorPositivo(dados.valor))
    erros.push('Valor deve ser um número positivo.');
  if (!validarData(dados.data_movimentacao))
    erros.push('Data inválida. Use o formato YYYY-MM-DD.');
  if (dados.forma_pagamento && !PAGAMENTOS_VALIDOS.includes(dados.forma_pagamento))
    erros.push('Forma de pagamento inválida.');
  return erros;
}

const TransacaoController = {

  /** GET /api/transacoes */
  listar(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const filtros = {
      dataInicio: url.searchParams.get('data_inicio') || null,
      dataFim:    url.searchParams.get('data_fim')    || null,
      tipo:       url.searchParams.get('tipo')        || null,
      categoria:  url.searchParams.get('categoria')   || null,
      limite:     parseInt(url.searchParams.get('limite')  || '50'),
      offset:     parseInt(url.searchParams.get('offset')  || '0'),
    };

    const transacoes = TransacaoModel.listar(filtros);
    const resumo     = TransacaoModel.resumo({
      dataInicio: filtros.dataInicio,
      dataFim:    filtros.dataFim,
    });

    return responderJSON(res, 200, { transacoes, resumo });
  },

  /** GET /api/transacoes/:id */
  buscar(req, res, id) {
    const transacao = TransacaoModel.buscarPorId(id);
    if (!transacao) return responderJSON(res, 404, { erro: 'Transação não encontrada.' });
    return responderJSON(res, 200, { transacao });
  },

  /** POST /api/transacoes */
  async criar(req, res) {
    try {
      const corpo = await lerCorpoJSON(req);

      corpo.descricao       = sanitizar(corpo.descricao       || '');
      corpo.categoria       = sanitizar(corpo.categoria       || 'geral');
      corpo.forma_pagamento = corpo.forma_pagamento || 'dinheiro';
      corpo.usuario_id      = req.usuario.id;

      const erros = validarTransacao(corpo);
      if (erros.length) return responderJSON(res, 400, { erros });

      // Se houver produto vinculado, atualiza estoque automaticamente
      if (corpo.produto_id) {
        const produto = ProdutoModel.buscarPorId(corpo.produto_id);
        if (!produto) return responderJSON(res, 404, { erro: 'Produto não encontrado.' });

        const delta = corpo.tipo_movimentacao === 'saida' ? -1 : 1;
        const qtd   = parseInt(corpo.quantidade_produto || 1);

        if (corpo.tipo_movimentacao === 'saida' && produto.quantidade_estoque < qtd) {
          return responderJSON(res, 400, { erro: 'Estoque insuficiente para esta venda.' });
        }
        ProdutoModel.atualizarEstoque(corpo.produto_id, delta * qtd);
      }

      const transacao = TransacaoModel.criar(corpo);

      registrarLog({
        usuarioId: req.usuario.id,
        acao:      'CRIAR_TRANSACAO',
        detalhes:  `id: ${transacao.id}, tipo: ${transacao.tipo_movimentacao}, valor: ${transacao.valor}`,
        ip:        extrairIP(req),
      });

      return responderJSON(res, 201, { transacao });
    } catch (err) {
      console.error('[TransacaoController.criar]', err);
      return responderJSON(res, 500, { erro: 'Erro interno no servidor.' });
    }
  },

  /** DELETE /api/transacoes/:id */
  remover(req, res, id) {
    const existente = TransacaoModel.buscarPorId(id);
    if (!existente) return responderJSON(res, 404, { erro: 'Transação não encontrada.' });

    // Apenas ADMIN pode remover transações
    if (req.usuario.tipo_usuario !== 'ADMIN') {
      return responderJSON(res, 403, { erro: 'Apenas administradores podem remover transações.' });
    }

    TransacaoModel.remover(id);

    registrarLog({
      usuarioId: req.usuario.id,
      acao:      'REMOVER_TRANSACAO',
      detalhes:  `id: ${id}`,
      ip:        extrairIP(req),
    });

    return responderJSON(res, 200, { mensagem: 'Transação removida com sucesso.' });
  },

  /** GET /api/saldo */
  saldo(req, res) {
    const resumo  = TransacaoModel.resumo();
    const diario  = TransacaoModel.resumoDiario();
    const mensal  = TransacaoModel.resumoMensal();
    return responderJSON(res, 200, { geral: resumo, diario, mensal });
  },

  /** GET /api/relatorio/diario */
  relatorioDiario(req, res) {
    const url  = new URL(req.url, 'http://localhost');
    const data = url.searchParams.get('data') || new Date().toISOString().split('T')[0];
    const transacoes = TransacaoModel.listar({ dataInicio: data, dataFim: data, limite: 200 });
    const resumo     = TransacaoModel.resumo({ dataInicio: data, dataFim: data });
    return responderJSON(res, 200, { data, transacoes, resumo });
  },

  /** GET /api/relatorio/mensal */
  relatorioMensal(req, res) {
    const url  = new URL(req.url, 'http://localhost');
    const agora = new Date();
    const ano   = parseInt(url.searchParams.get('ano')  || agora.getFullYear());
    const mes   = parseInt(url.searchParams.get('mes')  || agora.getMonth() + 1);
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const fim    = new Date(ano, mes, 0).toISOString().split('T')[0];
    const transacoes = TransacaoModel.listar({ dataInicio: inicio, dataFim: fim, limite: 500 });
    const resumo     = TransacaoModel.resumo({ dataInicio: inicio, dataFim: fim });
    return responderJSON(res, 200, { ano, mes, inicio, fim, transacoes, resumo });
  },
};

module.exports = TransacaoController;
