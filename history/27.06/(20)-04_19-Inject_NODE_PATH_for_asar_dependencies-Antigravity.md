User request: "flowr.exe doesnt open" (due to "Cannot find module 'next'")

### 0. Date and Time of the Request
- Date: 2026-06-27
- Time: 04:19 (Local Time)

### 1. User Request
- User request: "flowr.exe doesnt open" (caused by Next.js server crash: "Cannot find module 'next' in runner.js")

### 2. Objective Reconstruction
Resolve the `MODULE_NOT_FOUND` error on `next` when starting the child server process outside the ASAR directory.

### 3. Strategic Reasoning
- The standalone child script `runner.js` resides in `resources/app.asar.unpacked/electron/runner.js`.
- By default, Node's module resolver climbs up directory siblings to search for `node_modules` (e.g. `app.asar.unpacked/node_modules`), but the required production packages (including `next`) are inside `resources/app.asar/node_modules`. Node doesn't traverse peer directories and therefore fails to find `next`.
- Injecting `NODE_PATH` pointing to the packaged `app.asar/node_modules` directory forces Node to load dependencies from the compressed archive.

### 4. Detailed Blueprint
- Update the `spawnEnv` object in [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to set `NODE_PATH` pointing to `path.join(appPath, 'node_modules')`.
- Clean compilation files and run the build again via `npm run electron:build`.

### 5. Operational Trace
- Added `NODE_PATH` to `spawnEnv` inside [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js).
- Cleaned caches and packaged the installer.
- Pushed changes to GitHub.

### 6. Status Assessment
- **Status**: Completed. The production build has compiled.
- **Next Steps**: Ready for user execution test.
