// electron/db.js
const path = require('path');
const Database = require('better-sqlite3');

let db = null;

function getDbPath(app) {
  return path.join(app.getPath('userData'), 'flowr.db');
}

function initDb(app) {
  if (db) return db;
  db = new Database(getDbPath(app));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL DEFAULT '',
      type           TEXT NOT NULL,
      parent_id      TEXT,
      last_modified  INTEGER NOT NULL DEFAULT 0,
      icon           TEXT,
      tags           TEXT,
      content        TEXT,
      sort_order     INTEGER DEFAULT 0,
      space_id       TEXT,
      sync_mode      TEXT NOT NULL DEFAULT 'local-only',
      paired_entity_id TEXT,
      widget_layout  TEXT
    );
    CREATE INDEX IF NOT EXISTS entities_parent_id_idx ON entities(parent_id);
    CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(type);

    CREATE TABLE IF NOT EXISTS tasks (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL DEFAULT '',
      completed      INTEGER NOT NULL DEFAULT 0,
      due_date       TEXT,
      end_date       TEXT,
      include_time   INTEGER,
      reminder       TEXT,
      entity_id      TEXT,
      space_id       TEXT,
      note           TEXT,
      color          TEXT,
      priority       TEXT,
      status         TEXT,
      position       REAL,
      created_at     INTEGER,
      completed_at   INTEGER,
      last_modified  INTEGER NOT NULL DEFAULT 0,
      subtasks       TEXT,
      attachments    TEXT,
      description    TEXT,
      user_due_date  TEXT,
      tag            TEXT,
      sync_mode      TEXT NOT NULL DEFAULT 'local-only'
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      type           TEXT NOT NULL DEFAULT 'personal',
      icon           TEXT,
      color          TEXT,
      settings       TEXT,
      is_default     INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER,
      last_modified  INTEGER NOT NULL DEFAULT 0,
      sync_mode      TEXT NOT NULL DEFAULT 'local-only'
    );
  `);

  return db;
}

function getDb() {
  if (!db) throw new Error('[flowr-db] initDb() must be called before getDb()');
  return db;
}

module.exports = { initDb, getDb, getDbPath };
