const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__FLOWR_DESKTOP__', true);

contextBridge.exposeInMainWorld('flowrFS', {
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  deleteFile: (path) => ipcRenderer.invoke('fs:deleteFile', path),
  readdir: (path) => ipcRenderer.invoke('fs:readdir', path),
  mkdir: (path) => ipcRenderer.invoke('fs:mkdir', path),
  pickVaultFolder: () => ipcRenderer.invoke('dialog:pickVaultFolder'),
});
