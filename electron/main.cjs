// Electron main process — carga la app y expone IPC para libimobiledevice.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, execFile } = require("child_process");
const fs = require("fs");

const isDev = !app.isPackaged;

function resolveBinaryDir() {
  if (process.env.IMD_BIN_DIR && fs.existsSync(process.env.IMD_BIN_DIR)) {
    return process.env.IMD_BIN_DIR;
  }
  const platArch = `${process.platform}-${process.arch}`;
  const packaged = path.join(process.resourcesPath || "", "libimobiledevice");
  if (fs.existsSync(packaged)) return packaged;
  const bundled = path.join(__dirname, "..", "libimobiledevice", platArch);
  if (fs.existsSync(bundled)) return bundled;
  const fallback = path.join(__dirname, "..", "libimobiledevice");
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function binPath(name) {
  const dir = resolveBinaryDir();
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (dir) {
    const full = path.join(dir, exe);
    if (fs.existsSync(full)) return full;
  }
  return exe;
}

function run(cmd, args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, error: err.message, stderr: String(stderr || ""), stdout: String(stdout || "") });
      else resolve({ ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

// Parser plist XML → objeto JS (soporta dict, array, string, integer, real, true, false, data).
function parsePlist(xml) {
  const clean = String(xml || "").replace(/<!DOCTYPE[^>]*>/g, "");
  const tokenRe = /<(\/?)(dict|array|key|string|integer|real|true|false|data)\s*\/?>|<(dict|array|true|false)\s*\/>/g;
  const stack = [];
  let root = null;
  let currentKey = null;
  let i = 0;
  let m;

  const push = (val) => {
    const parent = stack[stack.length - 1];
    if (!parent) { root = val; return; }
    if (Array.isArray(parent)) parent.push(val);
    else if (currentKey !== null) { parent[currentKey] = val; currentKey = null; }
  };

  while ((m = tokenRe.exec(clean)) !== null) {
    const closing = m[1] === "/";
    const tag = m[2] || m[3];
    const selfClose = m[0].endsWith("/>");
    if (!closing) {
      if (tag === "dict") { const o = {}; push(o); stack.push(o); }
      else if (tag === "array") { const a = []; push(a); stack.push(a); }
      else if (tag === "true") { push(true); }
      else if (tag === "false") { push(false); }
      else if (!selfClose) {
        const start = tokenRe.lastIndex;
        const closeTag = `</${tag}>`;
        const end = clean.indexOf(closeTag, start);
        if (end === -1) continue;
        const inner = clean.slice(start, end);
        tokenRe.lastIndex = end + closeTag.length;
        if (tag === "key") currentKey = decodeEntities(inner);
        else if (tag === "string") push(decodeEntities(inner));
        else if (tag === "integer") push(Number(inner.trim()));
        else if (tag === "real") push(Number(inner.trim()));
        else if (tag === "data") push(inner.trim());
      }
    } else {
      if (tag === "dict" || tag === "array") stack.pop();
    }
    i = tokenRe.lastIndex;
  }
  return root || {};
}
function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function detectDevices() {
  const r = await run(binPath("idevice_id"), ["-l"]);
  if (!r.ok) return { ok: false, error: r.error || r.stderr, devices: [] };
  return { ok: true, devices: r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) };
}

async function getInfo(udid, domain) {
  const args = ["-x"];
  if (udid) args.push("-u", udid);
  if (domain) args.push("-q", domain);
  const r = await run(binPath("ideviceinfo"), args);
  if (!r.ok) return { ok: false, error: r.error || r.stderr };
  return { ok: true, data: parsePlist(r.stdout), raw: r.stdout };
}

async function getDiagnostics(udid) {
  const args = ["diagnostics", "All"];
  if (udid) args.unshift("-u", udid);
  const r = await run(binPath("idevicediagnostics"), args, 30000);
  return r.ok ? { ok: true, data: parsePlist(r.stdout), raw: r.stdout } : { ok: false, error: r.error || r.stderr };
}

// Historial: JSON en userData/history.json.
function historyPath() {
  return path.join(app.getPath("userData"), "history.json");
}
function readHistory() {
  try { return JSON.parse(fs.readFileSync(historyPath(), "utf8")); } catch { return {}; }
}
function writeHistory(h) {
  try { fs.mkdirSync(path.dirname(historyPath()), { recursive: true }); fs.writeFileSync(historyPath(), JSON.stringify(h, null, 2)); } catch (e) { console.error("history write", e); }
}
function appendSnapshot(udid, snap) {
  const h = readHistory();
  const list = h[udid] || [];
  list.push({ ...snap, t: Date.now() });
  // conservar máx 500 entradas / device
  h[udid] = list.slice(-500);
  writeHistory(h);
}

// Syslog en vivo — spawn persistente, stream por webContents.send.
const syslogProcs = new Map(); // udid -> child
function startSyslog(win, udid) {
  stopSyslog(udid);
  const args = [];
  if (udid) args.push("-u", udid);
  const child = spawn(binPath("idevicesyslog"), args, { windowsHide: true });
  syslogProcs.set(udid || "_default", child);
  child.stdout.on("data", (d) => win.webContents.send("imd:syslog:line", { udid, line: String(d) }));
  child.stderr.on("data", (d) => win.webContents.send("imd:syslog:line", { udid, line: String(d), err: true }));
  child.on("exit", () => syslogProcs.delete(udid || "_default"));
  return { ok: true };
}
function stopSyslog(udid) {
  const key = udid || "_default";
  const p = syslogProcs.get(key);
  if (p) { try { p.kill(); } catch {} syslogProcs.delete(key); }
  return { ok: true };
}

function registerIpc(getWin) {
  ipcMain.handle("imd:bridge-info", async () => ({
    platform: process.platform, arch: process.arch,
    binDir: resolveBinaryDir(), appVersion: app.getVersion(),
    userData: app.getPath("userData"),
  }));
  ipcMain.handle("imd:detect", () => detectDevices());
  ipcMain.handle("imd:info", (_e, { udid, domain } = {}) => getInfo(udid, domain));
  ipcMain.handle("imd:battery", (_e, { udid } = {}) => getInfo(udid, "com.apple.mobile.battery"));
  ipcMain.handle("imd:storage", (_e, { udid } = {}) => getInfo(udid, "com.apple.disk_usage"));
  ipcMain.handle("imd:diagnostics", (_e, { udid } = {}) => getDiagnostics(udid));
  ipcMain.handle("imd:history-append", (_e, { udid, snapshot }) => { appendSnapshot(udid, snapshot); return { ok: true }; });
  ipcMain.handle("imd:history-read", (_e, { udid }) => ({ ok: true, entries: (readHistory()[udid] || []) }));
  ipcMain.handle("imd:syslog-start", (_e, { udid } = {}) => startSyslog(getWin(), udid));
  ipcMain.handle("imd:syslog-stop", (_e, { udid } = {}) => stopSyslog(udid));
  ipcMain.handle("imd:open-external", (_e, url) => shell.openExternal(url));
}

let mainWin;
let ssrProc;

function findFreePort() {
  return new Promise((resolve) => {
    const net = require("net");
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startSsrServer() {
  // Nitro node-server build: dist/server/index.mjs
  const entry = path.join(__dirname, "..", "dist", "server", "index.mjs");
  if (!fs.existsSync(entry)) return null;
  const port = await findFreePort();
  const nodeBin = process.execPath; // Electron ejecutable acepta ELECTRON_RUN_AS_NODE=1
  const child = spawn(nodeBin, [entry], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (d) => console.log("[ssr]", String(d).trim()));
  child.stderr.on("data", (d) => console.error("[ssr]", String(d).trim()));
  ssrProc = child;
  // esperar a que el puerto responda
  await new Promise((resolve) => {
    const net = require("net");
    const started = Date.now();
    const tryConnect = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => { s.end(); resolve(); });
      s.once("error", () => {
        if (Date.now() - started > 8000) return resolve();
        setTimeout(tryConnect, 120);
      });
    };
    tryConnect();
  });
  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  mainWin = new BrowserWindow({
    width: 1360, height: 860, minWidth: 980, minHeight: 660,
    backgroundColor: "#0a0a1a", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (isDev && process.env.ELECTRON_START_URL) {
    mainWin.loadURL(process.env.ELECTRON_START_URL);
    mainWin.webContents.openDevTools({ mode: "detach" });
    return;
  }
  const url = await startSsrServer();
  if (url) {
    mainWin.loadURL(url);
  } else {
    // Fallback: intentar file://
    const html = path.join(__dirname, "..", "dist", "client", "index.html");
    if (fs.existsSync(html)) mainWin.loadFile(html);
    else mainWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
      "<h1 style='font-family:sans-serif;color:#e94'>No se encontró el build. Ejecuta bun run electron:pack:win.</h1>"
    ));
  }
}

app.whenReady().then(async () => {
  registerIpc(() => mainWin);
  await createWindow();
  app.on("activate", async () => { if (BrowserWindow.getAllWindows().length === 0) await createWindow(); });
});

app.on("window-all-closed", () => {
  syslogProcs.forEach((p) => { try { p.kill(); } catch {} });
  if (ssrProc) { try { ssrProc.kill(); } catch {} }
  if (process.platform !== "darwin") app.quit();
});

