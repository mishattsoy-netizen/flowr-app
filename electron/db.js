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

function upsertEntity(app, row) {
  const database = initDb(app);
  const stmt = database.prepare(`
    INSERT INTO entities (id, title, type, parent_id, last_modified, icon, tags, content, sort_order, space_id, sync_mode, paired_entity_id, widget_layout)
    VALUES (@id, @title, @type, @parent_id, @last_modified, @icon, @tags, @content, @sort_order, @space_id, @sync_mode, @paired_entity_id, @widget_layout)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      parent_id = excluded.parent_id,
      last_modified = excluded.last_modified,
      icon = excluded.icon,
      tags = excluded.tags,
      content = excluded.content,
      sort_order = excluded.sort_order,
      space_id = excluded.space_id,
      sync_mode = excluded.sync_mode,
      paired_entity_id = excluded.paired_entity_id,
      widget_layout = excluded.widget_layout
  `);
  stmt.run(row);
}

function deleteEntity(app, id) {
  const database = initDb(app);
  database.prepare('DELETE FROM entities WHERE id = ?').run(id);
}

function getAllEntities(app) {
  const database = initDb(app);
  return database.prepare('SELECT * FROM entities').all();
}

function upsertTask(app, row) {
  const database = initDb(app);
  const stmt = database.prepare(`
    INSERT INTO tasks (id, title, completed, due_date, end_date, include_time, reminder, entity_id, space_id, note, color, priority, status, position, created_at, completed_at, last_modified, subtasks, attachments, description, user_due_date, tag, sync_mode)
    VALUES (@id, @title, @completed, @due_date, @end_date, @include_time, @reminder, @entity_id, @space_id, @note, @color, @priority, @status, @position, @created_at, @completed_at, @last_modified, @subtasks, @attachments, @description, @user_due_date, @tag, @sync_mode)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, completed = excluded.completed, due_date = excluded.due_date,
      end_date = excluded.end_date, include_time = excluded.include_time, reminder = excluded.reminder,
      entity_id = excluded.entity_id, space_id = excluded.space_id, note = excluded.note,
      color = excluded.color, priority = excluded.priority, status = excluded.status,
      position = excluded.position, created_at = excluded.created_at, completed_at = excluded.completed_at,
      last_modified = excluded.last_modified, subtasks = excluded.subtasks, attachments = excluded.attachments,
      description = excluded.description, user_due_date = excluded.user_due_date, tag = excluded.tag,
      sync_mode = excluded.sync_mode
  `);
  stmt.run(row);
}

function deleteTask(app, id) {
  initDb(app).prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

function getAllTasks(app) {
  return initDb(app).prepare('SELECT * FROM tasks').all();
}

function upsertSpace(app, row) {
  const database = initDb(app);
  const stmt = database.prepare(`
    INSERT INTO spaces (id, name, type, icon, color, settings, is_default, created_at, last_modified, sync_mode)
    VALUES (@id, @name, @type, @icon, @color, @settings, @is_default, @created_at, @last_modified, @sync_mode)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, type = excluded.type, icon = excluded.icon, color = excluded.color,
      settings = excluded.settings, is_default = excluded.is_default, created_at = excluded.created_at,
      last_modified = excluded.last_modified, sync_mode = excluded.sync_mode
  `);
  stmt.run(row);
}

function deleteSpace(app, id) {
  initDb(app).prepare('DELETE FROM spaces WHERE id = ?').run(id);
}

function getAllSpaces(app) {
  return initDb(app).prepare('SELECT * FROM spaces').all();
}

module.exports = {
  initDb, getDb, getDbPath,
  upsertEntity, deleteEntity, getAllEntities,
  upsertTask, deleteTask, getAllTasks,
  upsertSpace, deleteSpace, getAllSpaces,
};
