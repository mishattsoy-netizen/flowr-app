## Task 3: Extend `flowrDB` IPC handlers to `tasks` and `spaces`

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.** Nearly identical in shape to Task 2 — same executor can likely do both back to back.

**Files:**
- Modify: `electron/db.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

- [ ] **Step 1: Add task/space CRUD functions to `electron/db.js`**

Append before `module.exports`:

```javascript
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
```

- [ ] **Step 2: Register IPC handlers in `electron/main.js`**

Add next to the entity handlers from Task 2:

```javascript
ipcMain.handle('db:upsertTask', async (_, row) => flowrDb.upsertTask(app, row));
ipcMain.handle('db:deleteTask', async (_, id) => flowrDb.deleteTask(app, id));
ipcMain.handle('db:getAllTasks', async () => flowrDb.getAllTasks(app));

ipcMain.handle('db:upsertSpace', async (_, row) => flowrDb.upsertSpace(app, row));
ipcMain.handle('db:deleteSpace', async (_, id) => flowrDb.deleteSpace(app, id));
ipcMain.handle('db:getAllSpaces', async () => flowrDb.getAllSpaces(app));
```

- [ ] **Step 3: Extend `electron/preload.js`**

```javascript
contextBridge.exposeInMainWorld('flowrDB', {
  upsertEntity: (row) => ipcRenderer.invoke('db:upsertEntity', row),
  deleteEntity: (id) => ipcRenderer.invoke('db:deleteEntity', id),
  getAllEntities: () => ipcRenderer.invoke('db:getAllEntities'),
  upsertTask: (row) => ipcRenderer.invoke('db:upsertTask', row),
  deleteTask: (id) => ipcRenderer.invoke('db:deleteTask', id),
  getAllTasks: () => ipcRenderer.invoke('db:getAllTasks'),
  upsertSpace: (row) => ipcRenderer.invoke('db:upsertSpace', row),
  deleteSpace: (id) => ipcRenderer.invoke('db:deleteSpace', id),
  getAllSpaces: () => ipcRenderer.invoke('db:getAllSpaces'),
});
```

- [ ] **Step 4: Manual verification**

Run: `npm run electron:dev`, in DevTools console:

```javascript
await window.flowrDB.upsertTask({ id: 't-1', title: 'Test task', completed: 0, due_date: null, end_date: null, include_time: null, reminder: null, entity_id: null, space_id: null, note: null, color: null, priority: null, status: null, position: null, created_at: Date.now(), completed_at: null, last_modified: Date.now(), subtasks: null, attachments: null, description: null, user_due_date: null, tag: null, sync_mode: 'local-only' });
await window.flowrDB.getAllTasks();
```

Expected: returns array with `t-1`.

- [ ] **Step 5: Commit**

```bash
git add electron/db.js electron/main.js electron/preload.js
git commit -m "feat(db): extend flowrDB IPC bridge to tasks and spaces"
```

---

