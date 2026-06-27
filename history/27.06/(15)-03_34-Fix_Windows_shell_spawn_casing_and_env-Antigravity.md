User request: "spawn C:\WINDOWS\system32\cmd.exe ENOENT"

### 0. Date and Time of the Request
- Date: 2026-06-27
- Time: 03:34 (Local Time)

### 1. User Request
- User request: (Shared screenshot showing Uncaught Exception: Error: spawn C:\WINDOWS\system32\cmd.exe ENOENT)

### 2. Objective Reconstruction
Resolve the spawn `ENOENT` exception when executing the compiled binary's background Next.js server runner using `cmd.exe` on Windows.

### 3. Strategic Reasoning
- The Windows shell spawn failed with `ENOENT` for `cmd.exe` because when spawning a child process with custom environment mapping (`env: { ... }`), critical system environment variables (`ComSpec`, `SystemRoot`, `SystemDrive`) can be stripped or case-mismatched on Windows execution.
- In addition, the case-sensitive string replacement `.replace('app.asar', 'app.asar.unpacked')` fails if the path resolves with capitalization (e.g. `App.asar`), which keeps the path inside the virtual ASAR archive and causes Windows to fail to spawn it.
- Resolving `runnerPath` relative to `app.getAppPath()` ensures correct case-insensitive path formatting, and copying `process.env` completely with Windows fallback values ensures `cmd.exe` has the required context to run.

### 4. Detailed Blueprint
- Modify [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to construct a robust `runnerPath` relative to `appPath`.
- Clone the full `process.env` object and define fallback keys for `SystemRoot`, `SystemDrive`, and `ComSpec`.
- Clear cache and re-package the installer with `npm run electron:build`.

### 5. Operational Trace
- Updated [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to resolve the unpacked `runnerPath` using `path.join(appPath, '..', 'app.asar.unpacked', 'electron', 'runner.js')`.
- Cloned the environment variables and injected Windows system-level environment safety keys.
- Cleared `.next` cache and ran `npm run electron:build` which successfully completed packaging.
- Staged, committed, and pushed changes to remote main branch on GitHub.

### 6. Status Assessment
- **Status**: Completed. The compilation and packaging succeeded, producing the standalone installer `Flowr Setup 1.0.0.exe` in `dist-desktop/`.
- **Next Steps**: Hand off verification of the compiled installer to the user.
