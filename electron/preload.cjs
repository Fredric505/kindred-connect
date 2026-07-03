const { contextBridge, ipcRenderer } = require("electron");

const syslogListeners = new Set();
ipcRenderer.on("imd:syslog:line", (_e, payload) => {
  syslogListeners.forEach((fn) => { try { fn(payload); } catch {} });
});

contextBridge.exposeInMainWorld("iphoneBridge", {
  isElectron: true,
  bridgeInfo: () => ipcRenderer.invoke("imd:bridge-info"),
  detect: () => ipcRenderer.invoke("imd:detect"),
  info: (opts = {}) => ipcRenderer.invoke("imd:info", opts),
  battery: (opts = {}) => ipcRenderer.invoke("imd:battery", opts),
  storage: (opts = {}) => ipcRenderer.invoke("imd:storage", opts),
  diagnostics: (opts = {}) => ipcRenderer.invoke("imd:diagnostics", opts),
  pair: (opts = {}) => ipcRenderer.invoke("imd:pair", opts),
  pairStatus: (opts = {}) => ipcRenderer.invoke("imd:pair-status", opts),
  historyAppend: (opts) => ipcRenderer.invoke("imd:history-append", opts),
  historyRead: (opts) => ipcRenderer.invoke("imd:history-read", opts),
  syslogStart: (opts = {}) => ipcRenderer.invoke("imd:syslog-start", opts),
  syslogStop: (opts = {}) => ipcRenderer.invoke("imd:syslog-stop", opts),
  onSyslog: (fn) => { syslogListeners.add(fn); return () => syslogListeners.delete(fn); },
  openExternal: (url) => ipcRenderer.invoke("imd:open-external", url),
});
