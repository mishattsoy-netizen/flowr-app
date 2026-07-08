const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__FLOWR_DESKTOP__', true);

contextBridge.exposeInMainWorld('flowrFS', {
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  deleteFile: (path) => ipcRenderer.invoke('fs:deleteFile', path),
  readdir: (path) => ipcRenderer.invoke('fs:readdir', path),
  mkdir: (path) => ipcRenderer.invoke('fs:mkdir', path),
  pickVaultFolder: () => ipcRenderer.invoke('dialog:pickVaultFolder'),
  getDefaultVaultPath: () => ipcRenderer.invoke('fs:getDefaultVaultPath'),
  getVaultPath: () => ipcRenderer.invoke('fs:getVaultPath'),
  setVaultPath: (path) => ipcRenderer.invoke('fs:setVaultPath', path),
  listAllFiles: (vaultPath) => ipcRenderer.invoke('fs:listAllFiles', vaultPath),
  onFileChanged: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('fs:file-changed', listener);
    return () => ipcRenderer.removeListener('fs:file-changed', listener);
  },
  showItemInFolder: (path) => ipcRenderer.invoke('fs:showItemInFolder', path),
  openPath: (path) => ipcRenderer.invoke('fs:openPath', path),
});

contextBridge.exposeInMainWorld('flowrPdf', {
  exportPdf: (options) => ipcRenderer.invoke('pdf:export', options),
});

contextBridge.exposeInMainWorld('flowrUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
  onUpdateAvailable: (callback) => {
    const listener = (_, info) => callback(info);
    ipcRenderer.on('updater:update-available', listener);
    return () => ipcRenderer.removeListener('updater:update-available', listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (_, info) => callback(info);
    ipcRenderer.on('updater:update-downloaded', listener);
    return () => ipcRenderer.removeListener('updater:update-downloaded', listener);
  },
  onDownloadProgress: (callback) => {
    const listener = (_, progress) => callback(progress);
    ipcRenderer.on('updater:download-progress', listener);
    return () => ipcRenderer.removeListener('updater:download-progress', listener);
  },
  onError: (callback) => {
    const listener = (_, err) => callback(err);
    ipcRenderer.on('updater:error', listener);
    return () => ipcRenderer.removeListener('updater:error', listener);
  }
});
