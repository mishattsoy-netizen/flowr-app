User request: "how to fix it"

### 2. Objective Reconstruction
Modify `electron/main.js` to search for the `.env` file in multiple secure and accessible directories (instead of only inside `app.asar`) so that local database credentials and API keys can be loaded by the Next.js process in the production build.

### 3. Strategic Reasoning
We resolved the `.env` load failure by allowing the Electron main process to check multiple potential paths:
1. `appPath` (root folder in dev mode or inside `app.asar` when packaged)
2. `appPath/..` (the `resources/` folder containing `app.asar` in production)
3. `app.getPath('userData')` (the user's OS-specific application data directory)
This lets us either place `.env` in the `resources/` folder next to the ASAR file, or securely store it in the user's personal app profile data directory, without needing to leak secrets by packaging them in the installer.

### 4. Detailed Blueprint
- Update `electron/main.js` standalone Next.js server runner section.
- Replace the single `const envPath = path.join(appPath, '.env')` with an array of search paths.
- Loop and load from the first path that successfully resolves.

### 5. Operational Trace
1. Edited `electron/main.js` to introduce the `possibleEnvPaths` array.
2. Implemented the loop to attempt loading variables from the first existing `.env` file and break on success.

### 6. Status Assessment
The fix has been implemented. The user can now place their `.env` file next to `app.asar` (in the `resources` folder of the installed program) or inside their `userData` folder to resolve the "System Overload" error.
