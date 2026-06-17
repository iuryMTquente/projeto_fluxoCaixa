/**
 * utils.js
 * Utilitários compartilhados por todas as páginas.
 * Autenticação, formatação, sidebar, requisições HTTP.
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const API = '/api';

// ─── Autenticação ─────────────────────────────────────────────────────────────

const Auth = {
  /** Salva token e dados do usuário no localStorage. */
  salvar(token, usuario) {
    localStorage.setItem('fc_token',   token);
    localStorage.setItem('fc_usuario', JSON.stringify(usuario));
  },

  /** Retorna o token JWT armazenado. */
  token() {
    return localStorage.getItem('fc_token');
  },

  /** Retorna os dados do usuário logado. */
  usuario() {
    try { return JSON.parse(localStorage.getItem('fc_usuario')); }
    catch { return null; }
  },

  /** Verifica se há sessão ativa. */
  logado() {
    return !!this.token();
  },

  /** Remove sessão e redireciona para login. */
  sair() {
    localStorage.removeItem('fc_token');
    localStorage.removeItem('fc_usuario');
    window.location.href = '/login.html';
  },

  /** Redireciona para login se não estiver autenticado. */
  exigirLogin() {
    if (!this.logado()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  /** Verifica se o usuário é ADMIN. */
  isAdmin() {
    const u = this.usuario();
    return u && u.tipo_usuario === 'ADMIN';
  },
};

// ─── Requisições HTTP ─────────────────────────────────────────────────────────

const Http = {
  /** Cabeçalhos padrão com token JWT. */
  _headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Auth.token()}`,
      ...extra,
    };
  },

  async _tratar(res) {
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = dados.erro || (dados.erros && dados.erros.join(' ')) || `Erro ${res.status}`;
      throw new Error(msg);
    }
    return dados;
  },

  async get(url) {
    const res = await fetch(`${API}${url}`, { headers: this._headers() });
    return this._tratar(res);
  },

  async post(url, corpo) {
    const res = await fetch(`${API}${url}`, {
      method:  'POST',
      headers: this._headers(),
      body:    JSON.stringify(corpo),
    });
    return this._tratar(res);
  },

  async put(url, corpo) {
    const res = await fetch(`${API}${url}`, {
      method:  'PUT',
      headers: this._headers(),
      body:    JSON.stringify(corpo),
    });
    return this._tratar(res);
  },

  async patch(url, corpo = {}) {
    const res = await fetch(`${API}${url}`, {
      method:  'PATCH',
      headers: this._headers(),
      body:    JSON.stringify(corpo),
    });
    return this._tratar(res);
  },

  async del(url) {
    const res = await fetch(`${API}${url}`, {
      method:  'DELETE',
      headers: this._headers(),
    });
    return this._tratar(res);
  },
};

// ─── Formatação ───────────────────────────────────────────────────────────────

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO) {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dtISO) {
  if (!dtISO) return '—';
  const d = new Date(dtISO.replace(' ', 'T'));
  return d.toLocaleString('pt-BR');
}

function dataHoje() {
  return new Date().toISOString().split('T')[0];
}

// ─── Mensagens de feedback ────────────────────────────────────────────────────

function exibirMensagem(elementoId, texto, tipo = 'erro') {
  const el = document.getElementById(elementoId);
  if (!el) return;
  el.textContent = texto;
  el.className   = `mensagem mensagem--${tipo}`;
  if (tipo === 'sucesso') {
    setTimeout(() => { el.textContent = ''; el.className = 'mensagem'; }, 4000);
  }
}

function limparMensagem(elementoId) {
  const el = document.getElementById(elementoId);
  if (el) { el.textContent = ''; el.className = 'mensagem'; }
}

// ─── Modal de confirmação ─────────────────────────────────────────────────────

function abrirModal(titulo, texto, onConfirmar) {
  const overlay  = document.getElementById('modal-overlay');
  const tituloEl = document.getElementById('modal-titulo');
  const textoEl  = document.getElementById('modal-texto');
  const btnConf  = document.getElementById('modal-confirmar');
  const btnCanc  = document.getElementById('modal-cancelar');

  if (!overlay) return onConfirmar(); // fallback sem modal

  tituloEl.textContent = titulo;
  textoEl.textContent  = texto;
  overlay.style.display = 'flex';

  const fechar = () => { overlay.style.display = 'none'; };

  btnConf.onclick = () => { fechar(); onConfirmar(); };
  btnCanc.onclick = fechar;
  overlay.onclick = (e) => { if (e.target === overlay) fechar(); };
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function inicializarSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const btnAbrir = document.getElementById('btn-abrir-sidebar');
  const btnFechar= document.getElementById('btn-fechar-sidebar');

  if (!sidebar) return;

  const abrir  = () => { sidebar.classList.add('sidebar--aberta');  overlay?.classList.add('ativo'); };
  const fechar = () => { sidebar.classList.remove('sidebar--aberta'); overlay?.classList.remove('ativo'); };

  btnAbrir?.addEventListener('click', abrir);
  btnFechar?.addEventListener('click', fechar);
  overlay?.addEventListener('click', fechar);

  // Oculta link de usuários para não-admins
  if (!Auth.isAdmin()) {
    document.querySelectorAll('.nav-item--admin').forEach(el => el.style.display = 'none');
  }

  // Preenche dados do usuário na sidebar
  const usuario = Auth.usuario();
  if (usuario) {
    const nomeEl = document.getElementById('nome-usuario');
    const tipoEl = document.getElementById('tipo-usuario');
    const badgeEl= document.getElementById('badge-usuario');
    if (nomeEl) nomeEl.textContent = usuario.nome;
    if (tipoEl) tipoEl.textContent = usuario.tipo_usuario === 'ADMIN' ? '🔑 Admin' : '👤 Usuário';
    if (badgeEl) badgeEl.textContent = usuario.nome;
  }

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('Deseja sair do sistema?')) Auth.sair();
  });
}

// ─── Inicialização global ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Não redireciona na página de login
  if (window.location.pathname.includes('login')) return;

  if (!Auth.exigirLogin()) return;
  inicializarSidebar();
});
