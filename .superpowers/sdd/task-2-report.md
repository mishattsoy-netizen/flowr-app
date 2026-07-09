# Task 2 Report: Add flowrDB IPC handlers for entities CRUD

## What was implemented

**Step 1: `electron/db.js`** — Added three CRUD functions before `module.exports`:
- `upsertEntity(app, row)` — Inserts or replaces an entity row via `ON CONFLICT(id) DO UPDATE SET`
- `deleteEntity(app, id)` — Deletes an entity by ID
- `getAllEntities(app)` — Returns all entities from the `entities` table

Exports updated to include all three functions.

**Step 2: `electron/main.js`** — Inside `app.whenReady().then(...)`:
- Changed `const { initDb } = require('./db')` to `const flowrDb = require('./db')`
- Changed `initDb(app)` to `flowrDb.initDb(app)`
- Added three `ipcMain.handle` registrations: `db:upsertEntity`, `db:deleteEntity`, `db:getAllEntities`

**Step 3: `electron/preload.js`** — Added a new `contextBridge.exposeInMainWorld('flowrDB', ...)` block exposing `upsertEntity`, `deleteEntity`, and `getAllEntities` methods that invoke the corresponding IPC channels.

## Verification

- All three files pass `node --check` syntax validation
- No linter or syntax errors found

## Files changed

- `C:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\electron\db.js` — +33 lines (CRUD functions + updated exports)
- `C:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\electron\main.js` — +4 lines (import change + 3 IPC handlers)
- `C:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\electron\preload.js` — +6 lines (flowrDB preload bridge)

## Self-review

- All code matches the brief verbatim
- The `flowrDb` variable is required inside `app.whenReady()` where `app` is in scope, as required
- The import changed from destructured `{ initDb }` to full module `flowrDb`, and `initDb(app)` updated to `flowrDb.initDb(app)`, which is consistent with existing IPC patterns
- No issues found

## Concerns

None.
