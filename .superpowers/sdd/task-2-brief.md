## Task 2: Add `flowrDB` IPC handlers in main process for `entities`

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.**

**Files:**
- Modify: `electron/db.js`
- Modify: `electron/main.js`

- [ ] **Step 1: Add row mapper + CRUD functions to `electron/db.js`**

Append to `electron/db.js` (before `module.exports`):

```javascript
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

module.exports = { initDb, getDb, getDbPath, upsertEntity, deleteEntity, getAllEntities };
```

- [ ] **Step 2: Register IPC handlers in `electron/main.js`**

Find the block of `ipcMain.handle('fs:...', ...)` registrations (around line 428). Add nearby:

```javascript
const flowrDb = require('./db');

ipcMain.handle('db:upsertEntity', async (_, row) => flowrDb.upsertEntity(app, row));
ipcMain.handle('db:deleteEntity', async (_, id) => flowrDb.deleteEntity(app, id));
ipcMain.handle('db:getAllEntities', async () => flowrDb.getAllEntities(app));
```

- [ ] **Step 3: Expose `flowrDB` in `electron/preload.js`**

Add after the existing `flowrFS` block in `electron/preload.js`:

```javascript
contextBridge.exposeInMainWorld('flowrDB', {
  upsertEntity: (row) => ipcRenderer.invoke('db:upsertEntity', row),
  deleteEntity: (id) => ipcRenderer.invoke('db:deleteEntity', id),
  getAllEntities: () => ipcRenderer.invoke('db:getAllEntities'),
});
```

- [ ] **Step 4: Manual verification**

Run: `npm run electron:dev`, open DevTools in the app window (Ctrl+Shift+I), run in the console:

```javascript
await window.flowrDB.upsertEntity({ id: 'test-1', title: 'Hello', type: 'note', parent_id: null, last_modified: Date.now(), icon: null, tags: '[]', content: '[]', sort_order: 0, space_id: null, sync_mode: 'local-only', paired_entity_id: null, widget_layout: null });
await window.flowrDB.getAllEntities();
```

Expected: second call returns an array containing the `test-1` row.

- [ ] **Step 5: Commit**

```bash
git add electron/db.js electron/main.js electron/preload.js
git commit -m "feat(db): expose flowrDB IPC bridge for entities CRUD"
```

---

