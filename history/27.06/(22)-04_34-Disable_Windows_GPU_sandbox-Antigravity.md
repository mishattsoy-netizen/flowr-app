User request: "flowr.exe doesnt open" (installed programs folder GPU crash)

### 0. Date and Time of the Request
- Date: 2026-06-27
- Time: 04:34 (Local Time)

### 1. User Request
- User request: "flowr.exe doesnt open" (diagnosed as a Chromium GPU sandbox initialization crash inside Programs folder: `exit_code=-2147483645` / `GPU process isn't usable. Goodbye.`)

### 2. Objective Reconstruction
Resolve the fatal Chromium GPU sandbox startup crash that prevents the installed application from opening on Windows.

### 3. Strategic Reasoning
- Chromium sandboxes its GPU rendering process for safety.
- However, when the app executes inside `%LOCALAPPDATA%\Programs`, strict folder permission restrictions on Windows can block Chromium's sandboxed GPU process from starting or loading device DLLs. This causes Chromium to crash and exit immediately with a fatal exit code.
- Setting `disable-gpu-sandbox` command-line switch disables sandboxing of the GPU process only. This keeps full hardware graphics acceleration intact while bypassing Windows security and permission conflicts, resolving the crash.

### 4. Detailed Blueprint
- Add `app.commandLine.appendSwitch('disable-gpu-sandbox')` inside [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) for `win32` platform.
- Clean caches and build a fresh installer via `npm run electron:build`.

### 5. Operational Trace
- Inserted `disable-gpu-sandbox` switch at the top of [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js).
- Cleaned Next.js cache and packaged the installer.
- Pushed changes to GitHub.

### 6. Status Assessment
- **Status**: Completed. The production build has compiled.
- **Next Steps**: Ready for user execution test.
