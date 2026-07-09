## Task 1: Install `better-sqlite3` and open the local database in the main process

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.**

**Files:**
- Modify: `package.json`
- Create: `electron/db.js`
- Modify: `electron/main.js`

- [ ] **Step 1: Install the dependency**

Run: `npm install better-sqlite3`
Expected: adds `better-sqlite3` to `dependencies` in `package.json`, installs native binary via prebuild-install (no compiler toolchain needed on Windows/Mac for standard Node/Electron ABI versions).

- [ ] **Step 2: Create `electron/db.js` — schema + connection module**

```javascript
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
```

- [ ] **Step 3: Wire `initDb` into `electron/main.js` app startup**

Find the `app.whenReady()` block in `electron/main.js` (search for `app.whenReady`) and add the db init call before `createWindow()` (or equivalent) runs. Example — locate the existing block:

```javascript
app.whenReady().then(() => {
  // ... existing setup ...
});
```

Add near the top of that block, after `app` is ready but before any window is created:

```javascript
const { initDb } = require('./db');
initDb(app);
```

- [ ] **Step 4: Manual verification**

Run: `npm run electron:dev`
Expected: app launches without errors; check `%APPDATA%/flowr-beta/flowr.db` (or platform equivalent via `app.getPath('userData')`) exists after launch. Confirm no `better-sqlite3` native module load errors in the console/log (`electron/main.js` logs to `flowr-startup.log` in the OS temp dir — check there if the window doesn't appear).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron/db.js electron/main.js
git commit -m "feat(db): add better-sqlite3 and local schema for entities/tasks/spaces"
```

---

