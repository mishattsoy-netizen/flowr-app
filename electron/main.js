const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

async function createWindow() {
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

  // For dev: connect to existing Next.js server on 3000
  mainWindow.loadURL('http://localhost:3000');
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
