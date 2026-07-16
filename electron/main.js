const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
// macOS ships unsigned (no Apple Developer account) and electron-updater's
// MacUpdater refuses to apply updates to an unsigned app — it silently fails
// every check. ./updater-mac.js is a from-scratch replacement for mac only,
// exposing the same shape (checkForUpdatesAndNotify/quitAndInstall + events)
// so the rest of this file doesn't need to branch beyond this require.
const { autoUpdater } = process.platform === 'darwin'
  ? require('./updater-mac')
  : require('electron-updater');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const net = require('net');
const os = require('os');

// Must match PAGE_MARGIN_MM in src/components/modals/PdfExportModal.tsx.
const PAGE_MARGIN_MM_EXPORT = 15;

// Configure autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.logger = {
  info: (msg) => debugLog('[UPDATER INFO] ' + msg),
  warn: (msg) => debugLog('[UPDATER WARN] ' + msg),
  error: (msg) => debugLog('[UPDATER ERROR] ' + msg),
};

// ── Global error handlers (MUST be registered before any risky requires) ────
// These catch errors that happen before our own handlers below are set up.
let earlyCrashLog = '';
try {
  earlyCrashLog = path.join(os.tmpdir(), 'flowr-crash.log');
} catch (_) { /* best-effort */ }

process.on('uncaughtException', (err) => {
  const msg = err && (err.stack || err.message);
  try { fs.appendFileSync(earlyCrashLog, `[FATAL ${Date.now()}] ${msg}\n`); } catch (_) {}
  
  // Do not crash on autoUpdater/electron-updater errors
  if (msg && (msg.includes('electron-updater') || msg.includes('MacUpdater') || msg.includes('AppUpdater'))) {
    debugLog('[UPDATER SILENT ERROR] Ignored fatal updater crash:', msg);
    return;
  }

  dialog.showErrorBox('Flowr Fatal Error', msg || String(err));
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  const msg = (reason && (reason.stack || reason.message)) || String(reason);
  try { fs.appendFileSync(earlyCrashLog, `[FATAL ${Date.now()}] UNHANDLED: ${msg}\n`); } catch (_) {}
  
  // Do not crash on autoUpdater/electron-updater errors
  if (msg && (msg.includes('electron-updater') || msg.includes('MacUpdater') || msg.includes('AppUpdater'))) {
    debugLog('[UPDATER SILENT ERROR] Ignored fatal updater rejection:', msg);
    return;
  }

  dialog.showErrorBox('Flowr Fatal Error', msg);
  app.quit();
});

// Disable hardware acceleration to fix white screen issues on some Windows machines/GPUs
app.disableHardwareAcceleration();

// ── Diagnostic logger ───────────────────────────────────────────────────────
const LOG_FILE = path.join(os.tmpdir(), 'flowr-startup.log');
function debugLog(...args) {
  const line = `[Flowr ${new Date().toISOString()}] ${args.join(' ')}`;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) { /* best-effort */ }
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args) => {
  debugLog('[MAIN_LOG]', ...args);
  originalConsoleLog(...args);
};
console.error = (...args) => {
  debugLog('[MAIN_ERROR]', ...args);
  originalConsoleError(...args);
};

console.log('=== Flowr starting ===');

// Disable GPU sandbox on Windows to prevent GPU process crash under restricted folder permissions
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
  debugLog('GPU sandbox and Main sandbox disabled');
}

let mainWindow;
let nextPort = 3000;

function handleDeepLink(url) {
  debugLog('Received deep link: ' + url);
  if (mainWindow) {
    if (url.startsWith('flowr://')) {
      const targetUrl = url.replace('flowr://', `http://127.0.0.1:${nextPort}/`);
      mainWindow.loadURL(targetUrl);
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const url = commandLine.find(arg => arg.startsWith('flowr://'));
    if (url) handleDeepLink(url);
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('flowr', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('flowr');
}

function getFreePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// ── Start Next.js directly in the main process ──────────────────────────────
// Previously this spawned a child process with ELECTRON_RUN_AS_NODE=1, but that
// disabled ASAR filesystem support, so require('next') would fail because all
// node_modules live inside app.asar. Running Next.js in the main process keeps
// ASAR support intact.
//
// We lazy-require 'next' here (rather than at the top of the file) so that the
// error handlers above are fully registered before we load any module that
// depends on large ASAR-backed packages.
let nextServer;

async function startNextServer(port) {
  const isPackaged = app.isPackaged;
  const appPath = app.getAppPath();
  
  debugLog('isPackaged:', isPackaged);
  debugLog('appPath:', appPath);

  return new Promise((resolve, reject) => {
    const { fork } = require('child_process');
    let standalonePath = path.join(appPath, '.next/standalone');
    if (isPackaged && appPath.endsWith('.asar')) {
      standalonePath = path.join(appPath + '.unpacked', '.next/standalone');
    }
    const serverPath = isPackaged 
      ? path.join(standalonePath, 'server.js')
      : path.join(appPath, 'node_modules/next/dist/bin/next');

    // Load .env file for the standalone server
    // Check multiple potential locations (inside app.asar, next to app.asar in resources/, or in userData/)
    const possibleEnvPaths = [
      path.join(appPath, '.env'),
      path.join(appPath, '..', '.env'),
      path.join(app.getPath('userData'), '.env')
    ];
    let envVars = {};
    for (const envPath of possibleEnvPaths) {
      if (fs.existsSync(envPath)) {
        try {
          const envFile = fs.readFileSync(envPath, 'utf8');
          envFile.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
              let val = match[2] || '';
              val = val.trim().replace(/(^['"]|['"]$)/g, '');
              envVars[match[1]] = val;
            }
          });
          debugLog('Loaded .env variables from: ' + envPath);
          break; // Stop at first successfully loaded .env file
        } catch (e) {
          debugLog('Failed to load .env from ' + envPath + ': ' + e.message);
        }
      }
    }

    const STDERR_LOG = path.join(os.tmpdir(), 'flowr-server-stderr.log');
    let resolved = false;

    nextServer = fork(serverPath, [], {
      cwd: isPackaged ? standalonePath : appPath,
      env: {
        ...process.env,
        ...envVars,
        PORT: port.toString(),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1',
        FLOWR_DESKTOP: '1'
      },
      stdio: 'pipe'
    });

    nextServer.stdout.on('data', (data) => {
      const str = data.toString();
      debugLog('[Next.js STDOUT]', str.trim());
      if (!resolved && (str.includes('Ready') || str.includes('Listening on port') || str.includes('listening on port') || str.includes('ready'))) {
        resolved = true;
        resolve();
      }
    });

    nextServer.stderr.on('data', (data) => {
      const str = data.toString().trim();
      debugLog('[Next.js STDERR]', str);
      try { fs.appendFileSync(STDERR_LOG, `[${new Date().toISOString()}] ${str}\n`); } catch (_) {}
    });

    nextServer.on('error', (err) => {
      debugLog('Next.js fork error:', err.message);
      if (!resolved) { resolved = true; reject(err); }
    });

    nextServer.on('exit', (code, signal) => {
      debugLog('Next.js process exited with code:', code, 'signal:', signal);
      if (!resolved) {
        resolved = true;
        reject(new Error(`Next.js server exited immediately with code ${code}. Check ${STDERR_LOG} for details.`));
      }
    });
    
    // Safety timeout — only resolve if server is still alive after 8s
    setTimeout(() => {
      if (!resolved && nextServer && !nextServer.killed) {
        debugLog('Next.js timeout — assuming ready (no ready message received)');
        resolved = true;
        resolve();
      }
    }, 8000);
  });
}

async function createWindow() {
  const { nativeTheme } = require('electron');
  const isDark = nativeTheme.shouldUseDarkColors;
  const sysColor = isDark ? '#1E1E1D' : '#F7F7F6';
  const bone3 = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
  const brandBlue = '#2A78D6';

  let loadingWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: sysColor,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0,0,0,0)',
      symbolColor: '#636363',
      height: 50
    },
    icon: path.join(__dirname, '../icons/icon.png'),
    show: true,
  });

  const loadingHtml = `
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      body {
        background-color: ${sysColor};
        margin: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 16px;
        height: 100vh;
        -webkit-app-region: drag;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .loading-text {
        font-size: 15px;
        font-weight: 500;
        color: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'};
      }
      .progress-container {
        width: 300px;
        height: 6px;
        background-color: ${bone3};
        border-radius: 3px;
        overflow: hidden;
      }
      .progress-bar {
        width: 100px;
        height: 100%;
        background-color: ${brandBlue};
        border-radius: 3px;
        animation: indeterminate 1.5s infinite ease-in-out;
      }
      @keyframes indeterminate {
        0% { transform: translateX(-100px); }
        100% { transform: translateX(300px); }
      }
    </style>
    </head>
    <body>
      <div class="loading-text">Starting Flowr...</div>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
    </body>
    </html>
  `;
  loadingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);

  if (app.isPackaged) {
    nextPort = await getFreePort();
    debugLog(`Selected free port: ${nextPort}`);
    try {
      await startNextServer(nextPort);
    } catch (err) {
      debugLog('startNextServer failed:', err.message);
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.close();
      }
      throw err; // caught by the .catch() in app.whenReady
    }
  } else {
    debugLog('Dev mode — skipping Next.js startup, expecting external dev server');
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: sysColor,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0,0,0,0)',
      symbolColor: '#636363', // A nice subtle color for the window controls
      height: 50 // Matches the 50px of the HeaderBar
    },
    icon: path.join(__dirname, '../icons/icon.png'),
    show: false, // Hide until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    mainWindow.show();
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    debugLog('[CRASH] render-process-gone: ' + JSON.stringify(details));
  });
  mainWindow.on('unresponsive', () => {
    debugLog('[CRASH] window unresponsive');
  });
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-change', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-change', false);
  });
  mainWindow.webContents.on('plugin-crashed', (event, name, version) => {
    debugLog('[CRASH] plugin-crashed: ' + name);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    debugLog(`[CONSOLE] level ${level}: ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    debugLog(`[PAGE-ERROR] did-fail-load: ${errorCode} ${errorDescription} on ${validatedURL}`);
  });

  // Intercept Supabase OAuth login URLs and Google accounts sign-in
  const handleOauthRedirect = (event, url) => {
    if (url.includes('/auth/v1/authorize') || url.includes('accounts.google.com')) {
      event.preventDefault();
      const { shell } = require('electron');
      shell.openExternal(url);
    }
  };

  mainWindow.webContents.on('will-navigate', handleOauthRedirect);
  mainWindow.webContents.on('will-redirect', handleOauthRedirect);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    debugLog(`[RENDERER CONSOLE] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    debugLog(`[WEB-CONTENTS] did-finish-load`);
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        debugLog('Updater: initial check failed: ' + err.message);
      });
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    debugLog(`[WEB-CONTENTS] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  mainWindow.webContents.on('crashed', () => {
    debugLog(`[WEB-CONTENTS] CRASHED!`);
  });

  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* ws://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com https://js.pusher.com https: data: blob:",
        ],
      },
    });
  });

  session.defaultSession.webRequest.onErrorOccurred((details) => {
    debugLog(`[NETWORK ERROR] ${details.url} - ${details.error}`);
  });

  session.defaultSession.webRequest.onCompleted((details) => {
    debugLog(`[HTTP] ${details.statusCode} ${details.url}`);
  });

  // mainWindow.webContents.openDevTools();
  debugLog(`Loading URL: http://127.0.0.1:${nextPort}`);
  mainWindow.loadURL(`http://127.0.0.1:${nextPort}`);

  // Dump DOM after 5 seconds to debug black screen
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(`
        ({
          body: document.body ? document.body.innerHTML.substring(0, 500) : 'null',
          styles: document.styleSheets.length,
          scripts: document.scripts.length,
          url: window.location.href,
        })
      `).then(res => debugLog('[DOM-DUMP] ' + JSON.stringify(res))).catch(err => debugLog('[DOM-DUMP-ERR] ' + err));
    }
  }, 6000);
}

app.whenReady().then(() => {
  // app.quit() from a lost single-instance race is asynchronous — without this
  // guard the losing instance still boots a full server + window before dying,
  // leaving the user staring at a window whose server is gone.
  if (!gotTheLock) return;

  const flowrDb = require('./db');
  flowrDb.initDb(app);

  debugLog('app.whenReady');

  ipcMain.handle('db:upsertEntity', async (_, row) => flowrDb.upsertEntity(app, row));
  ipcMain.handle('db:deleteEntity', async (_, id) => flowrDb.deleteEntity(app, id));
  ipcMain.handle('db:getAllEntities', async () => flowrDb.getAllEntities(app));
  
  ipcMain.handle('window:is-fullscreen', async () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
  });

  ipcMain.handle('db:upsertTask', async (_, row) => flowrDb.upsertTask(app, row));
  ipcMain.handle('db:deleteTask', async (_, id) => flowrDb.deleteTask(app, id));
  ipcMain.handle('db:getAllTasks', async () => flowrDb.getAllTasks(app));

  ipcMain.handle('db:upsertSpace', async (_, row) => flowrDb.upsertSpace(app, row));
  ipcMain.handle('db:deleteSpace', async (_, id) => flowrDb.deleteSpace(app, id));
  ipcMain.handle('db:getAllSpaces', async () => flowrDb.getAllSpaces(app));

  const LEGACY_IMPORT_FLAG = path.join(app.getPath('userData'), 'legacy-import-done.flag');
  ipcMain.handle('db:isLegacyImportDone', async () => fs.existsSync(LEGACY_IMPORT_FLAG));
  ipcMain.handle('db:markLegacyImportDone', async () => {
    fs.writeFileSync(LEGACY_IMPORT_FLAG, String(Date.now()), 'utf-8');
    return true;
  });

  // Generates a PDF via Electron's native printToPDF, then prompts a save location - no OS
  // print dialog. pageWidthMicrons/pageHeightMicrons let custom page sizes (square,
  // presentation) print at their exact dimensions instead of a named size like 'A4'.
  // printToPDF does NOT reliably apply @media print / doesn't re-run paged.js's on-screen
  // pagination, so the export path renders un-paginated source content (margin applied via
  // the `margins` option below, not CSS @page, since that interaction is undocumented) and
  // lets Chromium's native print engine fragment it - rather than reusing paged.js's
  // pre-built page boxes, which risks doubled/blank sheets when re-flowed by Electron's own
  // print pipeline.
  //
  // IMPORTANT: printToPDF's custom `pageSize` object takes width/height in INCHES, not
  // microns - passing microns (e.g. 210000) throws "Failed to generate PDF: Printing failed"
  // with no indication of why. Verified empirically: pageSize as a string ('A4') or an
  // inches object both work; a microns-scale object fails every time. `margins` is
  // separately documented as inches, matching this.
  ipcMain.handle('pdf:export', async (_, { defaultFileName, pageWidthMicrons, pageHeightMicrons }) => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFileName || 'export.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { canceled: true };

    const marginIn = (PAGE_MARGIN_MM_EXPORT / 25.4);
    const pageWidthIn = pageWidthMicrons / 1000 / 25.4;
    const pageHeightIn = pageHeightMicrons / 1000 / 25.4;
    const pdfBuffer = await mainWindow.webContents.printToPDF({
      pageSize: { width: pageWidthIn, height: pageHeightIn },
      printBackground: true,
      margins: { top: marginIn, bottom: marginIn, left: marginIn, right: marginIn },
    });
    await fsp.writeFile(filePath, pdfBuffer);
    return { canceled: false, filePath };
  });

  ipcMain.handle('updater:checkForUpdates', async () => {
    debugLog('Updater: checkForUpdates invoked');
    if (!app.isPackaged) {
      debugLog('Updater: Skip checking in dev mode');
      // Mock update-available and update-downloaded in dev mode for UI testing if user triggers check
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.webContents.send('updater:update-available', { version: '1.15962.1' });
          setTimeout(() => {
            if (mainWindow) {
              mainWindow.webContents.send('updater:update-downloaded', { version: '1.15962.1' });
            }
          }, 3000);
        }
      }, 1000);
      return null;
    }
    try {
      return await autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      debugLog('Updater error checking: ' + err.message);
      return null;
    }
  });

  ipcMain.handle('updater:installUpdate', async () => {
    debugLog('Updater: installUpdate invoked');
    if (!app.isPackaged) {
      debugLog('Updater: simulating relaunch in dev mode');
      app.relaunch();
      app.exit(0);
      return;
    }
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on('update-available', (info) => {
    debugLog('Updater: update-available ' + JSON.stringify(info));
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-available', info);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    debugLog('Updater: update-downloaded ' + JSON.stringify(info));
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-downloaded', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    debugLog('Updater: download-progress ' + JSON.stringify(progressObj));
    if (mainWindow) {
      mainWindow.webContents.send('updater:download-progress', progressObj);
    }
  });

  autoUpdater.on('error', (err) => {
    debugLog('Updater: error ' + err.message);
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', err.message);
    }
  });

  createWindow().catch((err) => {
    debugLog('createWindow failed:', err.message);
    dialog.showErrorBox('Flowr Startup Error', err.stack || err.message);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill();
    debugLog('Next.js server closed');
  }
  if (process.platform !== 'darwin') app.quit();
  debugLog('=== Flowr exiting ===');
});
