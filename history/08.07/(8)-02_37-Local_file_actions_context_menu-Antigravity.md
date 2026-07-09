User request: "in the desktop app in this popups show new section between delete button and open in new tab wil local actions like open file location or open local file but ony show if file has local copy. and only in desktop app"

### 2. Objective Reconstruction
Add local file actions ("Show in Explorer" and "Open local file") to the context menu in the desktop application, specifically placed between the "Open in new tab" and "Delete" options. These options should only be visible when the entity has a local file copy (sync mode is not 'cloud-only').

### 3. Strategic Reasoning
To enable these native OS interactions, the Electron main process must expose specific `shell` APIs. We modified `electron/main.js` to handle `fs:showItemInFolder` and `fs:openPath` via the `shell` module. These were then exposed to the renderer through `electron/preload.js`. In the React layer, `ContextMenu.tsx` was updated to import and use these bindings, gated behind `isDesktop()` and checking `entity.syncMode !== 'cloud-only'`. 

### 4. Detailed Blueprint
- **`electron/main.js`**: Imported `shell` from `electron` and added `ipcMain.handle` listeners for `fs:showItemInFolder` and `fs:openPath`.
- **`electron/preload.js`**: Exposed `showItemInFolder` and `openPath` methods on the existing `flowrFS` bridge.
- **`src/components/layout/ContextMenu.tsx`**: Imported `isDesktop`, `FolderOpen`, and `File` icons. Added the new menu items under "Open in new tab", rendering conditionally based on the environment and sync mode.

### 5. Operational Trace
1. Updated `electron/main.js` to import `shell` and register new IPC endpoints.
2. Updated `electron/preload.js` to map these IPC calls to the `flowrFS` global object.
3. Updated `ContextMenu.tsx` to include the conditional rendering logic and the two new menu items with their respective onClick handlers.

### 6. Status Assessment
The new local actions have been fully integrated into the context menu for the desktop application. They accurately respect the local copy constraints and trigger native shell commands to open the file or its directory. You may need to restart your desktop application or dev server to load the new Electron main process scripts.
