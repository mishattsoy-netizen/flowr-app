const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const net = require('net');
const os = require('os');

// ── Global error handlers (MUST be registered before any risky requires) ────
// These catch errors that happen before our own handlers below are set up.
let earlyCrashLog = '';
try {
  earlyCrashLog = path.join(os.tmpdir(), 'flowr-crash.log');
} catch (_) { /* best-effort */ }

process.on('uncaughtException', (err) => {
  const msg = err && (err.stack || err.message);
  try { fs.appendFileSync(earlyCrashLog, `[FATAL ${Date.now()}] ${msg}\n`); } catch (_) {}
  dialog.showErrorBox('Flowr Fatal Error', msg || String(err));
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  const msg = (reason && (reason.stack || reason.message)) || String(reason);
  try { fs.appendFileSync(earlyCrashLog, `[FATAL ${Date.now()}] UNHANDLED: ${msg}\n`); } catch (_) {}
  dialog.showErrorBox('Flowr Fatal Error', msg);
  app.quit();
});

// ── Diagnostic logger ───────────────────────────────────────────────────────
const LOG_FILE = path.join(os.tmpdir(), 'flowr-startup.log');
function debugLog(...args) {
  const line = `[Flowr ${new Date().toISOString()}] ${args.join(' ')}`;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) { /* best-effort */ }
  console.log(line);
}
debugLog('=== Flowr starting ===');

// Disable GPU sandbox on Windows to prevent GPU process crash under restricted folder permissions
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  debugLog('GPU sandbox disabled');
}

let mainWindow;

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

  // Lazy-require — this call depends on ASAR support for reading node_modules
  let next;
  try {
    next = require('next');
    debugLog('require(next) succeeded');
  } catch (err) {
    debugLog('FAILED to require(next):', err.message);
    throw new Error(`Cannot load Next.js: ${err.message}`);
  }

  const { createServer } = require('http');

  const nextApp = next({
    dev: false,
    dir: appPath,
  });
  const handle = nextApp.getRequestHandler();

  debugLog('Calling nextApp.prepare()...');
  await nextApp.prepare();
  debugLog('nextApp.prepare() completed');

  return new Promise((resolve, reject) => {
    nextServer = createServer((req, res) => {
      handle(req, res);
    });

    nextServer.listen(port, () => {
      debugLog(`Next.js server listening on port ${port}`);
      resolve();
    });

    nextServer.on('error', (err) => {
      debugLog('Next.js server error:', err.message);
      reject(err);
    });
  });
}

async function createWindow() {
  let port = 3000;

  if (app.isPackaged) {
    port = await getFreePort();
    debugLog(`Selected free port: ${port}`);
    try {
      await startNextServer(port);
    } catch (err) {
      debugLog('startNextServer failed:', err.message);
      throw err; // caught by the .catch() in app.whenReady
    }
  } else {
    debugLog('Dev mode — skipping Next.js startup, expecting external dev server');
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Intercept Supabase OAuth login URLs and Google accounts sign-in
  const handleOauthRedirect = (event, url) => {
    if (url.includes('/auth/v1/authorize') || url.includes('accounts.google.com')) {
      event.preventDefault();
      let targetUrl = url;
      if (url.includes('redirect_to=')) {
        targetUrl = url.replace(/redirect_to=([^&]+)/, (match, p1) => {
          const redirectUrl = decodeURIComponent(p1);
          const separator = redirectUrl.includes('?') ? '&' : '?';
          const newRedirect = encodeURIComponent(`${redirectUrl}${separator}desktop=true`);
          return `redirect_to=${newRedirect}`;
        });
      }
      const { shell } = require('electron');
      shell.openExternal(targetUrl);
    }
  };

  mainWindow.webContents.on('will-navigate', handleOauthRedirect);
  mainWindow.webContents.on('will-redirect', handleOauthRedirect);

  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* https://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
        ],
      },
    });
  });

  mainWindow.webContents.openDevTools();
  debugLog(`Loading URL: http://localhost:${port}`);
  mainWindow.loadURL(`http://localhost:${port}`);
}

app.whenReady().then(() => {
  debugLog('app.whenReady');

  ipcMain.handle('fs:readFile', async (_, filePath) => fsp.readFile(filePath, 'utf-8'));
  ipcMain.handle('fs:writeFile', async (_, filePath, content) => fsp.writeFile(filePath, content, 'utf-8'));
  ipcMain.handle('fs:deleteFile', async (_, filePath) => fsp.unlink(filePath));
  ipcMain.handle('fs:readdir', async (_, dirPath) => fsp.readdir(dirPath));
  ipcMain.handle('fs:mkdir', async (_, dirPath) => fsp.mkdir(dirPath, { recursive: true }));
  ipcMain.handle('dialog:pickVaultFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.filePaths[0] || null;
  });

  createWindow().catch((err) => {
    debugLog('createWindow failed:', err.message);
    dialog.showErrorBox('Flowr Startup Error', err.stack || err.message);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.close();
    debugLog('Next.js server closed');
  }
  if (process.platform !== 'darwin') app.quit();
  debugLog('=== Flowr exiting ===');
});
