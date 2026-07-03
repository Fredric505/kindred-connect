// Electron main process — carga la app y expone IPC para libimobiledevice.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, execFile } = require("child_process");
const fs = require("fs");

const isDev = !app.isPackaged;

// Ruta a los binarios libimobiledevice. En producción los buscamos junto a la app;
// en desarrollo permitimos overrides con IMD_BIN_DIR o el PATH del sistema.
function resolveBinaryDir() {
  if (process.env.IMD_BIN_DIR && fs.existsSync(process.env.IMD_BIN_DIR)) {
    return process.env.IMD_BIN_DIR;
  }
  const packaged = path.join(process.resourcesPath || "", "libimobiledevice");
  if (fs.existsSync(packaged)) return packaged;
  const bundled = path.join(__dirname, "..", "libimobiledevice");
  if (fs.existsSync(bundled)) return bundled;
  return null; // caerá al PATH del sistema
}

function binPath(name) {
  const dir = resolveBinaryDir();
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (dir) {
    const full = path.join(dir, exe);
    if (fs.existsSync(full)) return full;
  }
  return exe; // el sistema lo resolverá vía PATH
}

function run(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: err.message, stderr: String(stderr || ""), stdout: String(stdout || "") });
      } else {
        resolve({ ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") });
      }
    });
    child.on("error", (e) => resolve({ ok: false, error: e.message }));
  });
}

// Parser básico de la salida XML plist de ideviceinfo -x (formato simple key/value).
function parsePlistDict(xml) {
  const out = {};
  const re = /<key>([^<]+)<\/key>\s*(?:<string>([^<]*)<\/string>|<integer>([^<]*)<\/integer>|<true\s*\/>|<false\s*\/>|<data>([^<]*)<\/data>)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const key = m[1];
    let value;
    if (m[2] !== undefined) value = m[2];
    else if (m[3] !== undefined) value = Number(m[3]);
    else if (m[0].includes("<true")) value = true;
    else if (m[0].includes("<false")) value = false;
    else value = m[4] || null;
    out[key] = value;
  }
  return out;
}

async function detectDevices() {
  const r = await run(binPath("idevice_id"), ["-l"]);
  if (!r.ok) return { ok: false, error: r.error || r.stderr, devices: [] };
  const udids = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return { ok: true, devices: udids };
}

async function getInfo(udid, domain) {
  const args = ["-x"];
  if (udid) args.push("-u", udid);
  if (domain) args.push("-q", domain);
  const r = await run(binPath("ideviceinfo"), args);
  if (!r.ok) return { ok: false, error: r.error || r.stderr };
  return { ok: true, data: parsePlistDict(r.stdout), raw: r.stdout };
}

async function getBattery(udid) {
  return getInfo(udid, "com.apple.mobile.battery");
}

async function getStorage(udid) {
  return getInfo(udid, "com.apple.disk_usage");
}

async function getDiagnostics(udid) {
  const args = ["diagnostics", "All"];
  if (udid) args.push("-u", udid);
  const r = await run(binPath("idevicediagnostics"), args, 30000);
  return r.ok ? { ok: true, raw: r.stdout } : { ok: false, error: r.error || r.stderr };
}

function registerIpc() {
  ipcMain.handle("imd:bridge-info", async () => ({
    platform: process.platform,
    arch: process.arch,
    binDir: resolveBinaryDir(),
    appVersion: app.getVersion(),
  }));
  ipcMain.handle("imd:detect", () => detectDevices());
  ipcMain.handle("imd:info", (_e, { udid, domain }) => getInfo(udid, domain));
  ipcMain.handle("imd:battery", (_e, { udid }) => getBattery(udid));
  ipcMain.handle("imd:storage", (_e, { udid }) => getStorage(udid));
  ipcMain.handle("imd:diagnostics", (_e, { udid }) => getDiagnostics(udid));
  ipcMain.handle("imd:open-external", (_e, url) => shell.openExternal(url));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0a1a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
