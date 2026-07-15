const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__FLOWR_DESKTOP__', true);

contextBridge.exposeInMainWorld('flowrDesktop', {
  onFullscreenChange: (callback) => {
    const listener = (_, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('window:fullscreen-change', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-change', listener);
  },
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen')
});

contextBridge.exposeInMainWorld('flowrDB', {
  upsertEntity: (row) => ipcRenderer.invoke('db:upsertEntity', row),
  deleteEntity: (id) => ipcRenderer.invoke('db:deleteEntity', id),
  getAllEntities: () => ipcRenderer.invoke('db:getAllEntities'),
  upsertTask: (row) => ipcRenderer.invoke('db:upsertTask', row),
  deleteTask: (id) => ipcRenderer.invoke('db:deleteTask', id),
  getAllTasks: () => ipcRenderer.invoke('db:getAllTasks'),
  upsertSpace: (row) => ipcRenderer.invoke('db:upsertSpace', row),
  deleteSpace: (id) => ipcRenderer.invoke('db:deleteSpace', id),
  getAllSpaces: () => ipcRenderer.invoke('db:getAllSpaces'),
  isLegacyImportDone: () => ipcRenderer.invoke('db:isLegacyImportDone'),
  markLegacyImportDone: () => ipcRenderer.invoke('db:markLegacyImportDone'),
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
