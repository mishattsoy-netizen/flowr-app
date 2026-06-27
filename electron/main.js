const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const net = require('net');

// Global error handlers to display native dialogs for uncaught main process crashes
process.on('uncaughtException', (err) => {
  dialog.showErrorBox('Main Process Uncaught Exception', err.stack || err.message);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  const msg = (reason && (reason.stack || reason.message)) || String(reason);
  dialog.showErrorBox('Main Process Unhandled Rejection', msg);
  app.quit();
});

let mainWindow;
let nextProcess;

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

async function startNextServer(port) {
  const isPackaged = app.isPackaged;
  const appPath = app.getAppPath();
  
  if (isPackaged) {
    // Resolve unpacked runnerPath case-insensitively using appPath
    // appPath points to resources/app.asar, so unpacked runner is in resources/app.asar.unpacked/electron/runner.js
    const runnerPath = path.join(appPath, '..', 'app.asar.unpacked', 'electron', 'runner.js');
    
    // Copy system environment variables (case-sensitive on Windows)
    const spawnEnv = Object.assign({}, process.env, {
      NODE_ENV: 'production',
      PORT: port.toString(),
      ELECTRON_RUN_AS_NODE: '1',
      NEXT_DIR: appPath, // Tell Next.js to read from the app.asar archive directory
      NODE_PATH: path.join(appPath, 'node_modules') // Direct Node to resolve dependencies inside app.asar
    });

    // Ensure critical Windows variables are defined for cmd.exe spawning
    if (process.platform === 'win32') {
      spawnEnv.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
      spawnEnv.SystemDrive = process.env.SystemDrive || 'C:';
      spawnEnv.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    }
    
    // Spawn the runner process using Electron's Node environment
    nextProcess = spawn(process.execPath, [runnerPath], {
      cwd: isPackaged ? path.join(appPath, '..') : appPath,
      shell: false, // Do not use shell to avoid cmd.exe parsing errors with spaces
      env: spawnEnv
    });

    nextProcess.stdout.on('data', (data) => {
      console.log(`[Next.js stdout]: ${data}`);
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`[Next.js stderr]: ${data}`);
    });

    // Capture premature child process exit
    let exited = false;
    let exitCode = null;
    nextProcess.on('exit', (code) => {
      exited = true;
      exitCode = code;
    });

    // Wait for the Next.js server port to actively accept TCP connections before resolving
    await new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = 15000;
      
      function check() {
        if (exited) {
          return reject(new Error(`Next.js server process exited prematurely with code ${exitCode}`));
        }
        
        const socket = net.connect(port, '127.0.0.1', () => {
          socket.destroy();
          resolve();
        });
        
        socket.on('error', () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for Next.js server on port ${port}`));
          } else {
            setTimeout(check, 200);
          }
        });
      }
      check();
    });
  }
}

async function createWindow() {
  let port = 3000;
  if (app.isPackaged) {
    port = await getFreePort();
    await startNextServer(port);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* https://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com"]
      }
    });
  });

  mainWindow.loadURL(`http://localhost:${port}`);
}

app.whenReady().then(() => {
  ipcMain.handle('fs:readFile', async (_, filePath) => fs.readFile(filePath, 'utf-8'));
  ipcMain.handle('fs:writeFile', async (_, filePath, content) => fs.writeFile(filePath, content, 'utf-8'));
  ipcMain.handle('fs:deleteFile', async (_, filePath) => fs.unlink(filePath));
  ipcMain.handle('fs:readdir', async (_, dirPath) => fs.readdir(dirPath));
  ipcMain.handle('fs:mkdir', async (_, dirPath) => fs.mkdir(dirPath, { recursive: true }));
  ipcMain.handle('dialog:pickVaultFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.filePaths[0] || null;
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
