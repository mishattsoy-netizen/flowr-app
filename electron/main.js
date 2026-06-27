const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const net = require('net');

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
      ELECTRON_RUN_AS_NODE: '1'
    });

    // Ensure critical Windows variables are defined for cmd.exe spawning
    if (process.platform === 'win32') {
      spawnEnv.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
      spawnEnv.SystemDrive = process.env.SystemDrive || 'C:';
      spawnEnv.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    }
    
    // Spawn the runner process using Electron's Node environment
    nextProcess = spawn(process.execPath, [runnerPath], {
      cwd: appPath,
      shell: false, // Do not use shell to avoid cmd.exe parsing errors with spaces
      env: spawnEnv
    });

    nextProcess.stdout.on('data', (data) => {
      console.log(`[Next.js stdout]: ${data}`);
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`[Next.js stderr]: ${data}`);
    });

    // Wait a brief moment for the server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
