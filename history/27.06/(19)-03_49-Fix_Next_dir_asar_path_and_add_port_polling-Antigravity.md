User request: "app opens with white screen from dist-desktop. doesnt open from Programs folder"

### 0. Date and Time of the Request
- Date: 2026-06-27
- Time: 03:49 (Local Time)

### 1. User Request
- User request: "app opens with white screen from dist-desktop. doesnt open from Programs folder"

### 2. Objective Reconstruction
Resolve the blank white screen and silent startup crashes on both the unpacked and installed production binaries.

### 3. Strategic Reasoning
- The Next.js production server crashed during boot because it was configured to look for the `.next` directory inside the unpacked folder `app.asar.unpacked`, whereas the `.next` directory is packaged inside the compressed `app.asar` archive.
- Since Electron intercepts file reads inside `app.asar`, passing `NEXT_DIR` pointing to the `app.asar` path directs Next.js to read its build files correctly.
- Additionally, replacing the fixed 2-second timeout with active TCP port checking (`net.connect`) ensures that the Electron main window loads the URL only when the server is fully ready and listening, avoiding connection refused errors that display as a blank white screen.

### 4. Detailed Blueprint
- Update [runner.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/runner.js) to prioritize the `process.env.NEXT_DIR` environment variable over the default parent directory path.
- Update [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to pass `NEXT_DIR: appPath` in `spawnEnv`.
- Add active TCP port checking in `startNextServer` to poll the localhost port until it's open, with a premature exit check on the child process to reject immediately if the process dies.
- Re-run `Remove-Item -Recurse -Force .next` and run the build again via `npm run electron:build`.

### 5. Operational Trace
- Modified [runner.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/runner.js) and [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to support path propagation and port polling.
- Re-compiled Next.js and packaged the installer.
- Pushed changes to GitHub.

### 6. Status Assessment
- **Status**: Completed. The production build has compiled.
- **Next Steps**: Ready for user execution test.
