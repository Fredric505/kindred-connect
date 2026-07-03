// Expone un API seguro al renderer. Sin nodeIntegration; solo lo que declaramos aquí.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("iphoneBridge", {
  isElectron: true,
  bridgeInfo: () => ipcRenderer.invoke("imd:bridge-info"),
  detect: () => ipcRenderer.invoke("imd:detect"),
  info: (opts = {}) => ipcRenderer.invoke("imd:info", opts),
  battery: (opts = {}) => ipcRenderer.invoke("imd:battery", opts),
  storage: (opts = {}) => ipcRenderer.invoke("imd:storage", opts),
  diagnostics: (opts = {}) => ipcRenderer.invoke("imd:diagnostics", opts),
  openExternal: (url) => ipcRenderer.invoke("imd:open-external", url),
});
