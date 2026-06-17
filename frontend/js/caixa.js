/**
 * caixa.js
 * Lógica do módulo de Fluxo de Caixa.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Define data de hoje no campo
  document.getElementById('data_movimentacao').value = dataHoje();

  carregarTransacoes();
  inicializarFormulario();
  inicializarFiltros();
});

// ─── Carregamento ─────────────────────────────────────────────────────────────

async function carregarTransacoes(filtros = {}) {
  const tbody = document.getElementById('tbody-transacoes');
  tbody.innerHTML = '<tr><td colspan="8" class="tabela__vazio">Carregando...</td></tr>';

  try {
    const params = new URLSearchParams();
    if (filtros.dataInicio) params.set('data_inicio', filtros.dataInicio);
    if (filtros.dataFim)    params.set('data_fim',    filtros.dataFim);
    if (filtros.tipo)       params.set('tipo',        filtros.tipo);

    const query = params.toString() ? `?${params}` : '';
    const dados = await Http.get(`/transacoes${query}`);

    // Atualiza cards de resumo
    document.getElementById('cx-saldo').textContent   = formatarMoeda(dados.resumo.saldo);
    document.getElementById('cx-entradas').textContent= formatarMoeda(dados.resumo.total_entradas);
    document.getElementById('cx-saidas').textContent  = formatarMoeda(dados.resumo.total_saidas);

    const saldoEl = document.getElementById('cx-saldo');
    saldoEl.style.color = dados.resumo.saldo >= 0 ? 'var(--cor-sucesso)' : 'var(--cor-perigo)';

    if (!dados.transacoes.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="tabela__vazio">Nenhuma movimentação encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.transacoes.map(t => `
      <tr>
        <td>${formatarData(t.data_movimentacao)}</td>
        <td>${badgeTipo(t.tipo_movimentacao)}</td>
        <td>${t.descricao}</td>
        <td><span class="badge badge--cinza">${t.categoria}</span></td>
        <td><span class="badge badge--cinza">${labelPagamento(t.forma_pagamento)}</span></td>
        <td class="${t.tipo_movimentacao === 'entrada' ? 'valor-positivo' : 'valor-negativo'}">
          ${formatarMoeda(t.valor)}
        </td>
        <td>${t.nome_usuario || '—'}</td>
        <td class="col-acoes">
          ${Auth.isAdmin() ? `
            <button class="btn btn--perigo btn--xs" onclick="removerTransacao(${t.id})"
                    title="Remover">🗑</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="tabela__vazio tabela__vazio--erro">Erro: ${err.message}</td></tr>`;
  }
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function inicializarFormulario() {
  const form    = document.getElementById('form-transacao');
  const btnSalv = document.getElementById('btn-salvar');
  const btnLimp = document.getElementById('btn-limpar');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMensagem('msg-form');

    const dados = {
      tipo_movimentacao: form.querySelector('[name="tipo_movimentacao"]:checked')?.value,
      descricao:         form.descricao.value.trim(),
      valor:             parseFloat(form.valor.value),
      categoria:         form.categoria.value,
      forma_pagamento:   form.forma_pagamento.value,
      data_movimentacao: form.data_movimentacao.value,
    };

    // Validação básica no cliente
    if (!dados.descricao) { exibirMensagem('msg-form', 'Descrição é obrigatória.'); return; }
    if (!dados.valor || dados.valor <= 0) { exibirMensagem('msg-form', 'Informe um valor válido.'); return; }
    if (!dados.data_movimentacao) { exibirMensagem('msg-form', 'Data é obrigatória.'); return; }

    btnSalv.disabled    = true;
    btnSalv.textContent = 'Salvando...';

    try {
      await Http.post('/transacoes', dados);
      exibirMensagem('msg-form', 'Movimentação registrada com sucesso!', 'sucesso');
      form.reset();
      form.data_movimentacao.value = dataHoje();
      await carregarTransacoes();
    } catch (err) {
      exibirMensagem('msg-form', err.message);
    } finally {
      btnSalv.disabled    = false;
      btnSalv.textContent = '💾 Registrar';
    }
  });

  btnLimp.addEventListener('click', () => {
    form.reset();
    form.data_movimentacao.value = dataHoje();
    limparMensagem('msg-form');
  });
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

function inicializarFiltros() {
  document.getElementById('btn-filtrar').addEventListener('click', () => {
    carregarTransacoes({
      dataInicio: document.getElementById('filtro-inicio').value || null,
      dataFim:    document.getElementById('filtro-fim').value    || null,
      tipo:       document.getElementById('filtro-tipo').value   || null,
    });
  });

  document.getElementById('btn-limpar-filtro').addEventListener('click', () => {
    document.getElementById('filtro-inicio').value = '';
    document.getElementById('filtro-fim').value    = '';
    document.getElementById('filtro-tipo').value   = '';
    carregarTransacoes();
  });
}

// ─── Remoção ──────────────────────────────────────────────────────────────────

async function removerTransacao(id) {
  abrirModal(
    'Remover Movimentação',
    'Esta ação é permanente. Deseja continuar?',
    async () => {
      try {
        await Http.del(`/transacoes/${id}`);
        await carregarTransacoes();
      } catch (err) {
        alert('Erro ao remover: ' + err.message);
      }
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeTipo(tipo) {
  return tipo === 'entrada'
    ? '<span class="badge badge--sucesso">📈 Entrada</span>'
    : '<span class="badge badge--perigo">📉 Saída</span>';
}

function labelPagamento(forma) {
  const mapa = {
    dinheiro:       '💵 Dinheiro',
    pix:            '📱 PIX',
    cartao_debito:  '💳 Débito',
    cartao_credito: '💳 Crédito',
    transferencia:  '🏦 Transf.',
    outro:          '📌 Outro',
  };
  return mapa[forma] || forma;
}
