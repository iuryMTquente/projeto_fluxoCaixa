/**
 * server.js
 * Servidor HTTP principal — roteador central da aplicação.
 *
 * Rotas da API:
 *   POST   /api/auth/login
 *   GET    /api/auth/perfil
 *   PUT    /api/auth/senha
 *
 *   GET    /api/dashboard
 *
 *   GET    /api/usuarios
 *   GET    /api/usuarios/:id
 *   POST   /api/usuarios
 *   PUT    /api/usuarios/:id
 *   DELETE /api/usuarios/:id
 *   PATCH  /api/usuarios/:id/ativar
 *
 *   GET    /api/produtos
 *   GET    /api/produtos/estoque-baixo
 *   GET    /api/produtos/:id
 *   POST   /api/produtos
 *   PUT    /api/produtos/:id
 *   DELETE /api/produtos/:id
 *
 *   GET    /api/transacoes
 *   GET    /api/transacoes/:id
 *   POST   /api/transacoes
 *   DELETE /api/transacoes/:id
 *   GET    /api/saldo
 *   GET    /api/relatorio/diario
 *   GET    /api/relatorio/mensal
 *
 *   GET    /*  → arquivos estáticos do frontend
 */

const http = require('http');
const path = require('path');
const fs   = require('fs');

const AuthController      = require('./controllers/authController');
const UsuarioController   = require('./controllers/usuarioController');
const ProdutoController   = require('./controllers/produtoController');
const TransacaoController = require('./controllers/transacaoController');
const DashboardController = require('./controllers/dashboardController');

const { autenticar, autorizar } = require('./middlewares/auth');

// ─── Configurações ────────────────────────────────────────────────────────────

const PORT     = process.env.PORT || 3000;
const FRONTEND = path.join(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function responderJSON(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

/**
 * Encadeia middlewares de forma simples.
 * Cada middleware recebe (req, res, next) onde next = () => próximo(req, res).
 */
function pipeline(...fns) {
  return function(req, res) {
    let i = 0;
    function next(r, s) {
      const fn = fns[i++];
      if (fn) fn(r, s, next);
    }
    next(req, res);
  };
}

// ─── Servidor de arquivos estáticos ──────────────────────────────────────────

function servirArquivoEstatico(req, res) {
  const urlPath  = req.url.split('?')[0];
  const filePath = path.normalize(path.join(FRONTEND, urlPath === '/' ? '/index.html' : urlPath));

  // Proteção contra path traversal
  if (!filePath.startsWith(FRONTEND)) {
    res.writeHead(403);
    res.end('Acesso negado.');
    return;
  }

  const ext         = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, conteudo) => {
    if (err) {
      // SPA fallback: serve index.html para rotas do frontend
      fs.readFile(path.join(FRONTEND, 'index.html'), (err2, html) => {
        if (err2) { res.writeHead(404); res.end('Não encontrado.'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(conteudo);
  });
}

// ─── Roteador ────────────────────────────────────────────────────────────────

function rotear(req, res) {
  // Cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const { method } = req;
  const pathname   = req.url.split('?')[0];

  // ── Auth (rotas públicas) ─────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/auth/login')
    return AuthController.login(req, res);

  // ── Auth (rotas protegidas) ───────────────────────────────────────────────
  if (method === 'GET'  && pathname === '/api/auth/perfil')
    return autenticar(req, res, (q, s) => AuthController.perfil(q, s));

  if (method === 'PUT'  && pathname === '/api/auth/senha')
    return autenticar(req, res, (q, s) => AuthController.trocarSenha(q, s));

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/dashboard')
    return autenticar(req, res, (q, s) => DashboardController.resumo(q, s));

  // ── Usuários (apenas ADMIN) ───────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/usuarios')
    return autenticar(req, res, (q, s) =>
      autorizar('ADMIN')(q, s, (q2, s2) => UsuarioController.listar(q2, s2)));

  if (method === 'POST' && pathname === '/api/usuarios')
    return autenticar(req, res, (q, s) =>
      autorizar('ADMIN')(q, s, (q2, s2) => UsuarioController.criar(q2, s2)));

  const mUsuario = pathname.match(/^\/api\/usuarios\/(\d+)$/);
  if (mUsuario) {
    const id = parseInt(mUsuario[1]);
    if (method === 'GET')
      return autenticar(req, res, (q, s) =>
        autorizar('ADMIN')(q, s, (q2, s2) => UsuarioController.buscar(q2, s2, id)));
    if (method === 'PUT')
      return autenticar(req, res, (q, s) =>
        autorizar('ADMIN')(q, s, (q2, s2) => UsuarioController.atualizar(q2, s2, id)));
    if (method === 'DELETE')
      return autenticar(req, res, (q, s) =>
        autorizar('ADMIN')(q, s, (q2, s2) => UsuarioController.desativar(q2, s2, id)));
  }

  const mUsuarioAtivar = pathname.match(/^\/api\/usuarios\/(\d+)\/ativar$/);
  if (mUsuarioAtivar && method === 'PATCH')
    return autenticar(req, res, (q, s) =>
      autorizar('ADMIN')(q, s, (q2, s2) => UsuarioController.ativar(q2, s2, parseInt(mUsuarioAtivar[1]))));

  // ── Produtos ──────────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/produtos/estoque-baixo')
    return autenticar(req, res, (q, s) => ProdutoController.estoqueBaixo(q, s));

  if (method === 'GET' && pathname === '/api/produtos')
    return autenticar(req, res, (q, s) => ProdutoController.listar(q, s));

  if (method === 'POST' && pathname === '/api/produtos')
    return autenticar(req, res, (q, s) =>
      autorizar('ADMIN')(q, s, (q2, s2) => ProdutoController.criar(q2, s2)));

  const mProduto = pathname.match(/^\/api\/produtos\/(\d+)$/);
  if (mProduto) {
    const id = parseInt(mProduto[1]);
    if (method === 'GET')
      return autenticar(req, res, (q, s) => ProdutoController.buscar(q, s, id));
    if (method === 'PUT')
      return autenticar(req, res, (q, s) =>
        autorizar('ADMIN')(q, s, (q2, s2) => ProdutoController.atualizar(q2, s2, id)));
    if (method === 'DELETE')
      return autenticar(req, res, (q, s) =>
        autorizar('ADMIN')(q, s, (q2, s2) => ProdutoController.desativar(q2, s2, id)));
  }

  // ── Transações ────────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/saldo')
    return autenticar(req, res, (q, s) => TransacaoController.saldo(q, s));

  if (method === 'GET' && pathname === '/api/relatorio/diario')
    return autenticar(req, res, (q, s) => TransacaoController.relatorioDiario(q, s));

  if (method === 'GET' && pathname === '/api/relatorio/mensal')
    return autenticar(req, res, (q, s) => TransacaoController.relatorioMensal(q, s));

  if (method === 'GET' && pathname === '/api/transacoes')
    return autenticar(req, res, (q, s) => TransacaoController.listar(q, s));

  if (method === 'POST' && pathname === '/api/transacoes')
    return autenticar(req, res, (q, s) => TransacaoController.criar(q, s));

  const mTransacao = pathname.match(/^\/api\/transacoes\/(\d+)$/);
  if (mTransacao) {
    const id = parseInt(mTransacao[1]);
    if (method === 'GET')
      return autenticar(req, res, (q, s) => TransacaoController.buscar(q, s, id));
    if (method === 'DELETE')
      return autenticar(req, res, (q, s) => TransacaoController.remover(q, s, id));
  }

  // ── Rota não encontrada na API ────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return responderJSON(res, 404, { erro: 'Rota não encontrada.' });
  }

  // ── Arquivos estáticos ────────────────────────────────────────────────────
  servirArquivoEstatico(req, res);
}

// ─── Inicialização ────────────────────────────────────────────────────────────

const servidor = http.createServer(rotear);

servidor.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📁 Frontend:  ${FRONTEND}`);
  console.log(`🔑 Login:     http://localhost:${PORT}/login.html`);
  console.log(`🗄️  API:       http://localhost:${PORT}/api\n`);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Erro não capturado:', err);
});
