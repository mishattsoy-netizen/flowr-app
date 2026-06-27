User request: "spawn C:\Users\misha\AppData\Local\Programs\flowr-beta-1.5.1\Flowr.exe ENOENT"

### 0. Date and Time of the Request
- Date: 2026-06-27
- Time: 03:41 (Local Time)

### 1. User Request
- User request: (Shared screenshot showing spawn C:\Users\misha\AppData\Local\Programs\flowr-beta-1.5.1\Flowr.exe ENOENT)

### 2. Objective Reconstruction
Resolve the `spawn Flowr.exe ENOENT` crash when starting the compiled packaged app.

### 3. Strategic Reasoning
- The Windows spawn call failed with `ENOENT` on `Flowr.exe` because the working directory (`cwd` parameter) of the spawned process was set to `appPath`, which points to the virtual, compressed ASAR archive (`resources/app.asar`).
- Since Windows does not recognize the virtual `.asar` archive as a physical directory on disk, the system `CreateProcess` function failed to load the working directory, causing Node's child process manager to throw an `ENOENT` exception on the executable itself.
- Setting `cwd` to `path.join(appPath, '..')` in packaged mode targets the physical `resources` directory, resolving the working directory path correctly.

### 4. Detailed Blueprint
- Update the `cwd` option in the spawn call inside [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to use a physical directory (`resources` directory) in packaged mode.
- Re-run `Remove-Item -Recurse -Force .next` and run the build again via `npm run electron:build`.

### 5. Operational Trace
- Modified the `cwd` option in [main.js](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/electron/main.js) to be `isPackaged ? path.join(appPath, '..') : appPath`.
- Ran a clean rebuild and packaged the installer.
- Pushed changes to GitHub.

### 6. Status Assessment
- **Status**: Completed. The production build has compiled.
- **Next Steps**: Ready for user execution test.
