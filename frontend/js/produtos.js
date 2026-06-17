/**
 * produtos.js
 * Lógica do módulo de Produtos.
 */

let produtoEditandoId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Apenas ADMIN pode criar/editar/excluir
  if (!Auth.isAdmin()) {
    document.getElementById('btn-novo-produto')?.remove();
  }

  carregarProdutos();
  inicializarFormulario();
  inicializarFiltros();
});

// ─── Carregamento ─────────────────────────────────────────────────────────────

async function carregarProdutos(filtros = {}) {
  const tbody = document.getElementById('tbody-produtos');
  tbody.innerHTML = '<tr><td colspan="8" class="tabela__vazio">Carregando...</td></tr>';

  try {
    const params = new URLSearchParams();
    if (filtros.busca)     params.set('busca',     filtros.busca);
    if (filtros.categoria) params.set('categoria', filtros.categoria);

    const query = params.toString() ? `?${params}` : '';
    const dados = await Http.get(`/produtos${query}`);

    // Preenche filtro de categorias
    const selectCat = document.getElementById('filtro-categoria');
    const catAtual  = selectCat.value;
    selectCat.innerHTML = '<option value="">Todas as categorias</option>' +
      dados.categorias.map(c => `<option value="${c}" ${c === catAtual ? 'selected' : ''}>${c}</option>`).join('');

    // Preenche datalist de categorias no formulário
    const datalist = document.getElementById('lista-categorias');
    if (datalist) {
      datalist.innerHTML = dados.categorias.map(c => `<option value="${c}">`).join('');
    }

    if (!dados.produtos.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="tabela__vazio">Nenhum produto encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.produtos.map(p => {
      const estoqueClass = p.quantidade_estoque <= p.estoque_minimo ? 'badge--perigo' : 'badge--sucesso';
      return `
        <tr>
          <td><strong>${p.nome_produto}</strong>${p.descricao ? `<br><small class="texto-suave">${p.descricao}</small>` : ''}</td>
          <td>${p.codigo_barras || '—'}</td>
          <td><span class="badge badge--cinza">${p.categoria}</span></td>
          <td>${formatarMoeda(p.preco_custo)}</td>
          <td>${formatarMoeda(p.preco_venda)}</td>
          <td><span class="badge ${estoqueClass}">${p.quantidade_estoque}</span> / ${p.estoque_minimo}</td>
          <td>${p.fornecedor || '—'}</td>
          <td class="col-acoes">
            ${Auth.isAdmin() ? `
              <button class="btn btn--outline btn--xs" onclick="editarProduto(${p.id})" title="Editar">✏️</button>
              <button class="btn btn--perigo  btn--xs" onclick="desativarProduto(${p.id}, '${p.nome_produto}')" title="Desativar">🗑</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="tabela__vazio tabela__vazio--erro">Erro: ${err.message}</td></tr>`;
  }
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function inicializarFormulario() {
  const form      = document.getElementById('form-produto');
  const secaoForm = document.getElementById('secao-form');
  const btnNovo   = document.getElementById('btn-novo-produto');
  const btnCancel = document.getElementById('btn-cancelar-prod');
  const btnSalvar = document.getElementById('btn-salvar-prod');

  btnNovo?.addEventListener('click', () => {
    produtoEditandoId = null;
    form.reset();
    document.getElementById('produto-id').value = '';
    document.getElementById('titulo-form').textContent = '➕ Novo Produto';
    limparMensagem('msg-form-prod');
    secaoForm.style.display = 'block';
    secaoForm.scrollIntoView({ behavior: 'smooth' });
  });

  btnCancel.addEventListener('click', () => {
    secaoForm.style.display = 'none';
    form.reset();
    produtoEditandoId = null;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMensagem('msg-form-prod');

    const dados = {
      nome_produto:       form.nome_produto.value.trim(),
      codigo_barras:      form.codigo_barras.value.trim() || null,
      categoria:          form.categoria_prod?.value.trim() || 'geral',
      descricao:          form.descricao_prod?.value.trim() || null,
      preco_custo:        parseFloat(form.preco_custo.value) || 0,
      preco_venda:        parseFloat(form.preco_venda.value) || 0,
      quantidade_estoque: parseInt(form.quantidade_estoque.value) || 0,
      estoque_minimo:     parseInt(form.estoque_minimo.value) || 5,
      fornecedor:         form.fornecedor.value.trim() || null,
    };

    if (!dados.nome_produto) {
      exibirMensagem('msg-form-prod', 'Nome do produto é obrigatório.');
      return;
    }

    btnSalvar.disabled    = true;
    btnSalvar.textContent = 'Salvando...';

    try {
      if (produtoEditandoId) {
        await Http.put(`/produtos/${produtoEditandoId}`, dados);
        exibirMensagem('msg-form-prod', 'Produto atualizado com sucesso!', 'sucesso');
      } else {
        await Http.post('/produtos', dados);
        exibirMensagem('msg-form-prod', 'Produto cadastrado com sucesso!', 'sucesso');
      }

      setTimeout(() => { secaoForm.style.display = 'none'; form.reset(); }, 1500);
      produtoEditandoId = null;
      await carregarProdutos();
    } catch (err) {
      exibirMensagem('msg-form-prod', err.message);
    } finally {
      btnSalvar.disabled    = false;
      btnSalvar.textContent = '💾 Salvar';
    }
  });
}

// ─── Edição ───────────────────────────────────────────────────────────────────

async function editarProduto(id) {
  try {
    const dados = await Http.get(`/produtos/${id}`);
    const p     = dados.produto;
    const form  = document.getElementById('form-produto');
    const secao = document.getElementById('secao-form');

    produtoEditandoId = id;
    document.getElementById('produto-id').value         = id;
    document.getElementById('titulo-form').textContent  = '✏️ Editar Produto';
    form.nome_produto.value       = p.nome_produto;
    form.codigo_barras.value      = p.codigo_barras || '';
    form.categoria_prod.value     = p.categoria;
    form.descricao_prod.value     = p.descricao || '';
    form.preco_custo.value        = p.preco_custo;
    form.preco_venda.value        = p.preco_venda;
    form.quantidade_estoque.value = p.quantidade_estoque;
    form.estoque_minimo.value     = p.estoque_minimo;
    form.fornecedor.value         = p.fornecedor || '';

    limparMensagem('msg-form-prod');
    secao.style.display = 'block';
    secao.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Erro ao carregar produto: ' + err.message);
  }
}

// ─── Desativação ──────────────────────────────────────────────────────────────

function desativarProduto(id, nome) {
  abrirModal(
    'Desativar Produto',
    `Deseja desativar "${nome}"? O produto não aparecerá mais na listagem.`,
    async () => {
      try {
        await Http.del(`/produtos/${id}`);
        await carregarProdutos();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    }
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

function inicializarFiltros() {
  let debounce;

  document.getElementById('busca-produto').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      carregarProdutos({
        busca:     e.target.value.trim() || null,
        categoria: document.getElementById('filtro-categoria').value || null,
      });
    }, 400);
  });

  document.getElementById('filtro-categoria').addEventListener('change', (e) => {
    carregarProdutos({
      busca:     document.getElementById('busca-produto').value.trim() || null,
      categoria: e.target.value || null,
    });
  });
}
