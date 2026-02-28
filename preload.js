const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stickyApi', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (payload) => ipcRenderer.invoke('notes:save', payload),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('window:setAlwaysOnTop', enabled),
  loginGoogle: () => ipcRenderer.invoke('google:login'),
  logoutGoogle: () => ipcRenderer.invoke('google:logout'),
  getOpenAtLogin: () => ipcRenderer.invoke('system:getOpenAtLogin'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('system:setOpenAtLogin', enabled)
});
