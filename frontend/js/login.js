/**
 * login.js
 * Lógica da página de login.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Se já estiver logado, vai direto para o dashboard
  if (localStorage.getItem('fc_token')) {
    window.location.href = '/index.html';
    return;
  }

  const form      = document.getElementById('form-login');
  const btnEntrar = document.getElementById('btn-entrar');
  const msgEl     = document.getElementById('msg-login');
  const btnToggle = document.getElementById('btn-toggle-senha');
  const inputSenha= document.getElementById('senha');

  // Toggle visibilidade da senha
  btnToggle?.addEventListener('click', () => {
    const tipo = inputSenha.type === 'password' ? 'text' : 'password';
    inputSenha.type = tipo;
    btnToggle.textContent = tipo === 'password' ? '👁' : '🙈';
  });

  function exibirErro(msg) {
    msgEl.textContent = msg;
    msgEl.className   = 'mensagem mensagem--erro';
  }

  function limparMsg() {
    msgEl.textContent = '';
    msgEl.className   = 'mensagem';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparMsg();

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!email || !senha) {
      exibirErro('Preencha e-mail e senha.');
      return;
    }

    btnEntrar.disabled    = true;
    btnEntrar.textContent = 'Entrando...';

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, senha }),
      });

      const dados = await res.json();

      if (!res.ok) {
        exibirErro(dados.erro || 'Erro ao fazer login.');
        return;
      }

      // Salva sessão
      localStorage.setItem('fc_token',   dados.token);
      localStorage.setItem('fc_usuario', JSON.stringify(dados.usuario));

      // Redireciona para o dashboard
      window.location.href = '/index.html';

    } catch (err) {
      exibirErro('Não foi possível conectar ao servidor.');
    } finally {
      btnEntrar.disabled    = false;
      btnEntrar.textContent = 'Entrar';
    }
  });
});
