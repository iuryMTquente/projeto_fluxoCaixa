/**
 * db.js
 * Conexão singleton com o banco de dados SQLite.
 * Reutilizada em todo o back-end para evitar múltiplas conexões.
 */

const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'fluxo_caixa.db');

const db = new Database(DB_PATH);

// Performance e integridade referencial
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
