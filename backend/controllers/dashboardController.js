/**
 * dashboardController.js
 * Dados consolidados para o painel principal.
 */

const TransacaoModel = require('../models/transacaoModel');
const ProdutoModel   = require('../models/produtoModel');

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

const DashboardController = {

  /** GET /api/dashboard */
  resumo(req, res) {
    try {
      const resumoGeral   = TransacaoModel.resumo();
      const resumoDiario  = TransacaoModel.resumoDiario();
      const resumoMensal  = TransacaoModel.resumoMensal();
      const ultimasMovs   = TransacaoModel.ultimas(8);
      const vendasDia     = TransacaoModel.vendasDia();
      const totalProdutos = ProdutoModel.contar();
      const estoqueBaixo  = ProdutoModel.estoqueBaixo();

      // Gráfico: últimos 7 dias (entradas vs saídas)
      const grafico = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const data = d.toISOString().split('T')[0];
        const r    = TransacaoModel.resumo({ dataInicio: data, dataFim: data });
        grafico.push({
          data,
          label:    d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
          entradas: r.total_entradas,
          saidas:   r.total_saidas,
          saldo:    r.saldo,
        });
      }

      return responderJSON(res, 200, {
        resumo_geral:    resumoGeral,
        resumo_diario:   resumoDiario,
        resumo_mensal:   resumoMensal,
        vendas_dia:      vendasDia,
        total_produtos:  totalProdutos,
        estoque_baixo:   estoqueBaixo.length,
        produtos_alerta: estoqueBaixo.slice(0, 5),
        ultimas_movs:    ultimasMovs,
        grafico_7dias:   grafico,
      });
    } catch (err) {
      console.error('[DashboardController.resumo]', err);
      return responderJSON(res, 500, { erro: 'Erro ao carregar dashboard.' });
    }
  },
};

module.exports = DashboardController;
