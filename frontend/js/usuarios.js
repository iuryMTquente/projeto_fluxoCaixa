/**
 * usuarios.js
 * Lógica do módulo de Usuários (apenas ADMIN).
 */

let usuarioEditandoId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Redireciona se não for admin
  if (!Auth.isAdmin()) {
    window.location.href = '/index.html';
    return;
  }

  carregarUsuarios();
  inicializarFormulario();
});

// ─── Carregamento ─────────────────────────────────────────────────────────────

async function carregarUsuarios() {
  const tbody = document.getElementById('tbody-usuarios');
  tbody.innerHTML = '<tr><td colspan="7" class="tabela__vazio">Carregando...</td></tr>';

  try {
    const dados = await Http.get('/usuarios');

    if (!dados.usuarios.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tabela__vazio">Nenhum usuário encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.usuarios.map(u => `
      <tr class="${!u.status ? 'linha-inativa' : ''}">
        <td><strong>${u.nome}</strong></td>
        <td>${u.email}</td>
        <td>${u.telefone || '—'}</td>
        <td>${badgeTipo(u.tipo_usuario)}</td>
        <td>${u.status
          ? '<span class="badge badge--sucesso">✅ Ativo</span>'
          : '<span class="badge badge--perigo">❌ Inativo</span>'
        }</td>
        <td>${formatarData(u.data_criacao)}</td>
        <td class="col-acoes">
          <button class="btn btn--outline btn--xs" onclick="editarUsuario(${u.id})" title="Editar">✏️</button>
          ${u.status
            ? `<button class="btn btn--perigo btn--xs" onclick="desativarUsuario(${u.id}, '${u.nome}')" title="Desativar">🚫</button>`
            : `<button class="btn btn--sucesso btn--xs" onclick="ativarUsuario(${u.id}, '${u.nome}')" title="Ativar">✅</button>`
          }
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="tabela__vazio tabela__vazio--erro">Erro: ${err.message}</td></tr>`;
  }
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function inicializarFormulario() {
  const form      = document.getElementById('form-usuario');
  const secaoForm = document.getElementById('secao-form');
  const btnNovo   = document.getElementById('btn-novo-usuario');
  const btnCancel = document.getElementById('btn-cancelar-usr');
  const btnSalvar = document.getElementById('btn-salvar-usr');
  const campoSenha= document.getElementById('campo-senha');

  btnNovo.addEventListener('click', () => {
    usuarioEditandoId = null;
    form.reset();
    document.getElementById('usuario-id').value = '';
    document.getElementById('titulo-form').textContent = '➕ Novo Usuário';
    campoSenha.style.display = 'block';
    document.getElementById('senha').required = true;
    limparMensagem('msg-form-usr');
    secaoForm.style.display = 'block';
    secaoForm.scrollIntoView({ behavior: 'smooth' });
  });

  btnCancel.addEventListener('click', () => {
    secaoForm.style.display = 'none';
    form.reset();
    usuarioEditandoId = null;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMensagem('msg-form-usr');

    const dados = {
      nome:         form.nome.value.trim(),
      email:        form.email.value.trim().toLowerCase(),
      telefone:     form.telefone.value.trim() || null,
      tipo_usuario: form.tipo_usuario.value,
    };

    if (!usuarioEditandoId) {
      dados.senha = form.senha.value;
    }

    if (!dados.nome) { exibirMensagem('msg-form-usr', 'Nome é obrigatório.'); return; }
    if (!dados.email) { exibirMensagem('msg-form-usr', 'E-mail é obrigatório.'); return; }
    if (!usuarioEditandoId && (!dados.senha || dados.senha.length < 6)) {
      exibirMensagem('msg-form-usr', 'Senha deve ter ao menos 6 caracteres.');
      return;
    }

    btnSalvar.disabled    = true;
    btnSalvar.textContent = 'Salvando...';

    try {
      if (usuarioEditandoId) {
        await Http.put(`/usuarios/${usuarioEditandoId}`, dados);
        exibirMensagem('msg-form-usr', 'Usuário atualizado com sucesso!', 'sucesso');
      } else {
        await Http.post('/usuarios', dados);
        exibirMensagem('msg-form-usr', 'Usuário criado com sucesso!', 'sucesso');
      }

      setTimeout(() => { secaoForm.style.display = 'none'; form.reset(); }, 1500);
      usuarioEditandoId = null;
      await carregarUsuarios();
    } catch (err) {
      exibirMensagem('msg-form-usr', err.message);
    } finally {
      btnSalvar.disabled    = false;
      btnSalvar.textContent = '💾 Salvar';
    }
  });
}

// ─── Edição ───────────────────────────────────────────────────────────────────

async function editarUsuario(id) {
  try {
    const dados = await Http.get(`/usuarios/${id}`);
    const u     = dados.usuario;
    const form  = document.getElementById('form-usuario');
    const secao = document.getElementById('secao-form');
    const campoSenha = document.getElementById('campo-senha');

    usuarioEditandoId = id;
    document.getElementById('usuario-id').value        = id;
    document.getElementById('titulo-form').textContent = '✏️ Editar Usuário';
    form.nome.value         = u.nome;
    form.email.value        = u.email;
    form.telefone.value     = u.telefone || '';
    form.tipo_usuario.value = u.tipo_usuario;

    // Na edição, senha é opcional
    campoSenha.style.display = 'none';
    document.getElementById('senha').required = false;

    limparMensagem('msg-form-usr');
    secao.style.display = 'block';
    secao.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('Erro ao carregar usuário: ' + err.message);
  }
}

// ─── Ativar / Desativar ───────────────────────────────────────────────────────

function desativarUsuario(id, nome) {
  abrirModal(
    'Desativar Usuário',
    `Deseja desativar "${nome}"? O usuário não conseguirá mais fazer login.`,
    async () => {
      try {
        await Http.del(`/usuarios/${id}`);
        await carregarUsuarios();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    }
  );
}

async function ativarUsuario(id, nome) {
  abrirModal(
    'Ativar Usuário',
    `Deseja reativar "${nome}"?`,
    async () => {
      try {
        await Http.patch(`/usuarios/${id}/ativar`);
        await carregarUsuarios();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeTipo(tipo) {
  return tipo === 'ADMIN'
    ? '<span class="badge badge--roxo">🔑 Admin</span>'
    : '<span class="badge badge--cinza">👤 Usuário</span>';
}
