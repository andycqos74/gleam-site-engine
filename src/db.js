import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS fields (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  coll TEXT NOT NULL,
  pos INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER
);
CREATE INDEX IF NOT EXISTS items_coll ON items (coll, pos);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  user_id INTEGER,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  action TEXT NOT NULL,
  before TEXT,
  after TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT,
  message TEXT NOT NULL,
  emailed INTEGER NOT NULL DEFAULT 0,
  handled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  at TEXT NOT NULL,
  user_id INTEGER
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export function openDb(dataDir) {
  const file = dataDir === ':memory:' ? ':memory:' : path.join(dataDir, 'site.db');
  if (file !== ':memory:') fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

export const now = () => new Date().toISOString();
