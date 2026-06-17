/**
 * app.js
 * Lógica do Dashboard principal.
 * Carrega dados consolidados e renderiza gráfico + tabelas.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await carregarDashboard();
});

async function carregarDashboard() {
  try {
    const dados = await Http.get('/dashboard');

    // ── Cards de resumo ──────────────────────────────────────────────────────
    document.getElementById('dash-saldo').textContent         = formatarMoeda(dados.resumo_geral.saldo);
    document.getElementById('dash-entradas-dia').textContent  = formatarMoeda(dados.resumo_diario.total_entradas);
    document.getElementById('dash-saidas-dia').textContent    = formatarMoeda(dados.resumo_diario.total_saidas);
    document.getElementById('dash-vendas-dia').textContent    = formatarMoeda(dados.vendas_dia);
    document.getElementById('dash-total-produtos').textContent= dados.total_produtos;
    document.getElementById('dash-estoque-baixo').textContent = dados.estoque_baixo;

    // Cor do saldo
    const saldoEl = document.getElementById('dash-saldo');
    saldoEl.style.color = dados.resumo_geral.saldo >= 0 ? 'var(--cor-sucesso)' : 'var(--cor-perigo)';

    // ── Alertas de estoque ───────────────────────────────────────────────────
    if (dados.estoque_baixo > 0) {
      document.getElementById('secao-alertas').style.display = 'block';
      const tbody = document.getElementById('tbody-alertas');
      tbody.innerHTML = dados.produtos_alerta.map(p => `
        <tr>
          <td>${p.nome_produto}</td>
          <td><span class="badge badge--cinza">${p.categoria}</span></td>
          <td><span class="badge badge--perigo">${p.quantidade_estoque}</span></td>
          <td>${p.estoque_minimo}</td>
        </tr>
      `).join('');
    }

    // ── Últimas movimentações ────────────────────────────────────────────────
    const tbody = document.getElementById('tbody-movs');
    if (!dados.ultimas_movs.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tabela__vazio">Nenhuma movimentação registrada.</td></tr>';
    } else {
      tbody.innerHTML = dados.ultimas_movs.map(t => `
        <tr>
          <td>${formatarData(t.data_movimentacao)}</td>
          <td>${badgeTipo(t.tipo_movimentacao)}</td>
          <td>${t.descricao}</td>
          <td><span class="badge badge--cinza">${t.categoria}</span></td>
          <td class="${t.tipo_movimentacao === 'entrada' ? 'valor-positivo' : 'valor-negativo'}">
            ${formatarMoeda(t.valor)}
          </td>
          <td>${t.nome_usuario || '—'}</td>
        </tr>
      `).join('');
    }

    // ── Gráfico de barras (7 dias) ───────────────────────────────────────────
    renderizarGrafico(dados.grafico_7dias);

  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
    if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
      Auth.sair();
    }
  }
}

function badgeTipo(tipo) {
  return tipo === 'entrada'
    ? '<span class="badge badge--sucesso">📈 Entrada</span>'
    : '<span class="badge badge--perigo">📉 Saída</span>';
}

// ─── Gráfico de barras simples (Canvas API) ───────────────────────────────────

function renderizarGrafico(dados) {
  const canvas = document.getElementById('grafico-barras');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth || 600;
  const H   = canvas.height;

  canvas.width = W;

  const maxVal = Math.max(...dados.map(d => Math.max(d.entradas, d.saidas)), 1);
  const pad    = { top: 30, right: 20, bottom: 50, left: 60 };
  const areaW  = W - pad.left - pad.right;
  const areaH  = H - pad.top  - pad.bottom;
  const grupoW = areaW / dados.length;
  const barW   = Math.min(grupoW * 0.35, 30);

  ctx.clearRect(0, 0, W, H);

  // Linhas de grade
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (areaH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const val = maxVal - (maxVal / 4) * i;
    ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(formatarMoeda(val).replace('R$\u00a0','R$ '), pad.left - 5, y + 4);
  }

  // Barras
  dados.forEach((d, i) => {
    const cx = pad.left + grupoW * i + grupoW / 2;

    // Entrada (verde)
    const hE = (d.entradas / maxVal) * areaH;
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(cx - barW - 2, pad.top + areaH - hE, barW, hE);

    // Saída (vermelho)
    const hS = (d.saidas / maxVal) * areaH;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx + 2, pad.top + areaH - hS, barW, hS);

    // Label data
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.label, cx, H - pad.bottom + 16);
  });

  // Legenda
  ctx.fillStyle = '#16a34a'; ctx.fillRect(pad.left, H - 18, 12, 12);
  ctx.fillStyle = '#1e293b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Entradas', pad.left + 16, H - 8);

  ctx.fillStyle = '#dc2626'; ctx.fillRect(pad.left + 90, H - 18, 12, 12);
  ctx.fillStyle = '#1e293b';
  ctx.fillText('Saídas', pad.left + 106, H - 8);
}
