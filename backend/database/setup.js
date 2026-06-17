/**
 * setup.js
 * Script de criação e inicialização do banco de dados SQLite.
 * Cria todas as tabelas e insere dados iniciais (seed).
 * Execute com: npm run setup
 */

const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'fluxo_caixa.db');

// Remove banco antigo para recriar do zero (apenas no setup)
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑️  Banco anterior removido.');
}

const db = new Database(DB_PATH);

// Performance e integridade
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Criação das Tabelas ──────────────────────────────────────────────────────

db.exec(`
  -- ── Usuários ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    senha         TEXT    NOT NULL,
    telefone      TEXT,
    status        INTEGER NOT NULL DEFAULT 1,          -- 1=ativo, 0=inativo
    tipo_usuario  TEXT    NOT NULL DEFAULT 'USUARIO_NORMAL'
                          CHECK(tipo_usuario IN ('ADMIN','USUARIO_NORMAL')),
    data_criacao  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- ── Produtos ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS produtos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_produto      TEXT    NOT NULL,
    codigo_barras     TEXT    UNIQUE,
    categoria         TEXT    NOT NULL DEFAULT 'geral',
    descricao         TEXT,
    preco_custo       REAL    NOT NULL DEFAULT 0 CHECK(preco_custo >= 0),
    preco_venda       REAL    NOT NULL DEFAULT 0 CHECK(preco_venda >= 0),
    quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK(quantidade_estoque >= 0),
    estoque_minimo    INTEGER NOT NULL DEFAULT 5,
    fornecedor        TEXT,
    data_cadastro     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    status            INTEGER NOT NULL DEFAULT 1       -- 1=ativo, 0=inativo
  );

  -- ── Transações de Caixa ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS transacoes (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_movimentacao  TEXT    NOT NULL CHECK(tipo_movimentacao IN ('entrada','saida')),
    descricao          TEXT    NOT NULL,
    valor              REAL    NOT NULL CHECK(valor > 0),
    categoria          TEXT    NOT NULL DEFAULT 'geral',
    forma_pagamento    TEXT    NOT NULL DEFAULT 'dinheiro'
                               CHECK(forma_pagamento IN ('dinheiro','cartao_debito','cartao_credito','pix','transferencia','outro')),
    usuario_id         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    produto_id         INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    data_movimentacao  TEXT    NOT NULL DEFAULT (date('now','localtime')),
    criado_em          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- ── Logs de Ações ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    acao       TEXT    NOT NULL,
    detalhes   TEXT,
    ip         TEXT,
    criado_em  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- ── Índices para performance ──────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_transacoes_data     ON transacoes(data_movimentacao);
  CREATE INDEX IF NOT EXISTS idx_transacoes_tipo     ON transacoes(tipo_movimentacao);
  CREATE INDEX IF NOT EXISTS idx_transacoes_usuario  ON transacoes(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_produtos_categoria  ON produtos(categoria);
  CREATE INDEX IF NOT EXISTS idx_produtos_codigo     ON produtos(codigo_barras);
  CREATE INDEX IF NOT EXISTS idx_logs_usuario        ON logs(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_logs_criado_em      ON logs(criado_em);
`);

console.log('✅ Tabelas criadas com sucesso.');

// ─── Seed: Usuário Administrador ──────────────────────────────────────────────

const senhaHash = bcrypt.hashSync('admin123', 10);

const insertAdmin = db.prepare(`
  INSERT OR IGNORE INTO usuarios (nome, email, senha, tipo_usuario)
  VALUES (?, ?, ?, 'ADMIN')
`);
insertAdmin.run('Administrador', 'admin@admin.com', senhaHash);
console.log('✅ Usuário admin criado: admin@admin.com / admin123');

// ─── Seed: Produtos de Exemplo ────────────────────────────────────────────────

const insertProduto = db.prepare(`
  INSERT INTO produtos (nome_produto, codigo_barras, categoria, descricao, preco_custo, preco_venda, quantidade_estoque, estoque_minimo, fornecedor)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const produtos = [
  ['Caneta Azul BIC',    '7891234560001', 'papelaria',   'Caneta esferográfica azul',    0.50,  2.50,  100, 20, 'Distribuidora ABC'],
  ['Caderno 100 folhas', '7891234560002', 'papelaria',   'Caderno universitário pautado', 5.00, 18.90,   50, 10, 'Distribuidora ABC'],
  ['Café 500g',          '7891234560003', 'alimentacao', 'Café torrado e moído',          8.00, 15.90,   30,  5, 'Fornecedor Café'],
  ['Água Mineral 500ml', '7891234560004', 'alimentacao', 'Água mineral sem gás',          0.80,  3.00,  200, 50, 'Distribuidora Bebidas'],
  ['Mouse USB',          '7891234560005', 'informatica', 'Mouse óptico USB preto',       15.00, 45.00,   20,  3, 'Tech Distribuidora'],
];

const insertProdutos = db.transaction(() => {
  for (const p of produtos) insertProduto.run(...p);
});
insertProdutos();
console.log('✅ Produtos de exemplo inseridos.');

// ─── Seed: Transações de Exemplo ─────────────────────────────────────────────

const insertTransacao = db.prepare(`
  INSERT INTO transacoes (tipo_movimentacao, descricao, valor, categoria, forma_pagamento, usuario_id, data_movimentacao)
  VALUES (?, ?, ?, ?, ?, 1, ?)
`);

const hoje = new Date().toISOString().split('T')[0];
const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

const transacoes = [
  ['entrada', 'Venda de produtos',       350.00, 'vendas',      'dinheiro',       hoje],
  ['entrada', 'Recebimento de cliente',  120.50, 'recebimentos','pix',            hoje],
  ['saida',   'Compra de estoque',       200.00, 'fornecedores','transferencia',  hoje],
  ['saida',   'Conta de energia',         85.00, 'contas',      'transferencia',     ontem],
  ['entrada', 'Venda balcão',            450.00, 'vendas',      'cartao_debito',  ontem],
  ['saida',   'Material de escritório',   45.00, 'despesas',    'dinheiro',       ontem],
];

const insertTransacoes = db.transaction(() => {
  for (const t of transacoes) insertTransacao.run(...t);
});
insertTransacoes();
console.log('✅ Transações de exemplo inseridas.');

db.close();
console.log('\n🎉 Banco de dados configurado com sucesso!');
console.log(`📍 Localização: ${DB_PATH}`);
console.log('\n🔑 Credenciais de acesso:');
console.log('   Email: admin@admin.com');
console.log('   Senha: admin123\n');
