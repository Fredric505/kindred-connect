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
  // Cuando la app va empaquetada dentro de app.asar, los .exe/.dll deben leerse
  // desde app.asar.unpacked (no se pueden ejecutar desde dentro del asar).
  const dirname = __dirname.includes(`${path.sep}app.asar${path.sep}`)
    ? __dirname.split(`${path.sep}app.asar${path.sep}`).join(`${path.sep}app.asar.unpacked${path.sep}`)
    : __dirname;
  const candidates = [
    path.join(process.resourcesPath || "", "libimobiledevice", platArch),
    path.join(process.resourcesPath || "", "libimobiledevice"),
    path.join(dirname, "..", "libimobiledevice", platArch),
    path.join(dirname, "..", "libimobiledevice"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
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

function mergeMissing(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const [k, v] of Object.entries(source)) {
    if (v !== undefined && v !== null && v !== "" && target[k] === undefined) target[k] = v;
  }
  return target;
}

async function getMergedInfo(udid) {
  const domains = [
    undefined,
    "com.apple.mobile.lockdown_cache",
    "com.apple.international",
    "com.apple.mobile.wireless_lockdown",
  ];
  const results = await Promise.all(domains.map((domain) => getInfo(udid, domain)));
  const data = {};
  const errors = [];
  results.forEach((r, i) => {
    if (r.ok) mergeMissing(data, r.data);
    else errors.push(`${domains[i] || "default"}: ${r.error || "sin acceso"}`);
  });
  if (Object.keys(data).length === 0) return { ok: false, error: errors.join(" | ") || "No se pudo leer identidad" };
  if (errors.length) data._sourceErrors = errors;
  return { ok: true, data };
}

async function getDiagnostics(udid) {
  const args = ["diagnostics", "All"];
  if (udid) args.unshift("-u", udid);
  const r = await run(binPath("idevicediagnostics"), args, 30000);
  return r.ok ? { ok: true, data: parsePlist(r.stdout), raw: r.stdout } : { ok: false, error: r.error || r.stderr };
}

async function runDiagnostic(udid, parts, timeoutMs = 30000) {
  const args = [];
  if (udid) args.push("-u", udid);
  args.push(...parts);
  const r = await run(binPath("idevicediagnostics"), args, timeoutMs);
  return r.ok ? { ok: true, data: parsePlist(r.stdout), raw: r.stdout } : { ok: false, error: r.error || r.stderr || r.stdout };
}

const ADVANCED_BATTERY_KEYS = new Set([
  "AppleRawCurrentCapacity",
  "AppleRawMaxCapacity",
  "AtCriticalLevel",
  "AtWarnLevel",
  "BatteryData",
  "BatteryHealth",
  "BatteryHealthMetric",
  "BatteryIsCharging",
  "BatterySerialNumber",
  "ChemID",
  "CurrentCapacity",
  "CycleCount",
  "DesignCapacity",
  "ExternalChargeCapable",
  "ExternalConnected",
  "Flags",
  "FullAvailableCapacity",
  "FullChargeCapacity",
  "FullyCharged",
  "InstantAmperage",
  "IsCharging",
  "ManufactureDate",
  "Manufacturer",
  "MaxCapacity",
  "NominalChargeCapacity",
  "Serial",
  "Temperature",
  "UpdateTime",
  "Voltage",
]);

function extractBatteryFields(source) {
  const out = {};
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, val] of Object.entries(value)) {
      if (ADVANCED_BATTERY_KEYS.has(key) && val !== undefined && val !== null && typeof val !== "object" && out[key] === undefined) {
        out[key] = val;
      }
      if (val && typeof val === "object") visit(val);
    }
  };
  visit(source);
  return out;
}

async function getAdvancedBattery(udid) {
  const sourceDefs = [
    ["lockdown", () => getInfo(udid, "com.apple.mobile.battery")],
    ["diagnostics:GasGauge", () => runDiagnostic(udid, ["diagnostics", "GasGauge"])],
    ["diagnostics:All", () => runDiagnostic(udid, ["diagnostics", "All"])],
    ["ioregentry:AppleSmartBattery", () => runDiagnostic(udid, ["ioregentry", "AppleSmartBattery"])],
    ["ioregentry:AppleARMPMUCharger", () => runDiagnostic(udid, ["ioregentry", "AppleARMPMUCharger"])],
    ["ioreg:IOPower", () => runDiagnostic(udid, ["ioreg", "IOPower"], 45000)],
  ];
  const results = await Promise.all(sourceDefs.map(async ([name, fn]) => [name, await fn()]));
  const data = {};
  const sourceStatus = [];

  for (const [name, result] of results) {
    if (result.ok) {
      const fields = name === "lockdown" ? (result.data || {}) : extractBatteryFields(result.data);
      mergeMissing(data, fields);
      sourceStatus.push({ name, ok: true, keys: Object.keys(fields).length });
    } else {
      sourceStatus.push({ name, ok: false, error: String(result.error || "sin acceso").slice(0, 500) });
    }
  }

  if (data.AppleRawMaxCapacity === undefined && data.MaxCapacity !== undefined) data.AppleRawMaxCapacity = data.MaxCapacity;
  if (data.FullChargeCapacity === undefined && data.FullAvailableCapacity !== undefined) data.FullChargeCapacity = data.FullAvailableCapacity;
  if (data.Serial === undefined && data.BatterySerialNumber !== undefined) data.Serial = data.BatterySerialNumber;
  data._sourceStatus = sourceStatus;

  const hasAny = Object.keys(data).some((k) => !k.startsWith("_"));
  return hasAny ? { ok: true, data } : { ok: false, error: sourceStatus.map((s) => `${s.name}: ${s.error || "sin claves"}`).join(" | ") };
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

// Crash reports / panics — descarga con idevicecrashreport y analiza los archivos.
async function fetchCrashReports(udid) {
  const outDir = path.join(app.getPath("userData"), "crashes", udid || "_default");
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const args = ["-e", "-k"];
  if (udid) args.push("-u", udid);
  args.push(outDir);
  const r = await run(binPath("idevicecrashreport"), args, 60000);
  if (!r.ok && !fs.existsSync(outDir)) return { ok: false, error: r.error || r.stderr };
  const files = [];
  const walk = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(outDir);
  const panics = [];
  const crashes = [];
  for (const f of files) {
    const base = path.basename(f);
    const stat = (() => { try { return fs.statSync(f); } catch { return null; } })();
    const mtime = stat ? stat.mtimeMs : 0;
    let head = "";
    try { head = fs.readFileSync(f, "utf8").slice(0, 4096); } catch {}
    const item = { file: base, path: f, mtime, size: stat ? stat.size : 0, head };
    if (/panic/i.test(base)) panics.push(item);
    else if (/\.(ips|crash|synced)$/i.test(base)) crashes.push(item);
  }
  panics.sort((a, b) => b.mtime - a.mtime);
  crashes.sort((a, b) => b.mtime - a.mtime);
  return { ok: true, panics, crashes: crashes.slice(0, 30), dir: outDir, warning: r.ok ? undefined : (r.stderr || r.error) };
}


function registerIpc(getWin) {
  ipcMain.handle("imd:bridge-info", async () => ({
    platform: process.platform, arch: process.arch,
    binDir: resolveBinaryDir(), appVersion: app.getVersion(),
    userData: app.getPath("userData"),
  }));
  ipcMain.handle("imd:detect", () => detectDevices());
  ipcMain.handle("imd:info", (_e, { udid, domain } = {}) => domain ? getInfo(udid, domain) : getMergedInfo(udid));
  ipcMain.handle("imd:battery", (_e, { udid } = {}) => getAdvancedBattery(udid));
  ipcMain.handle("imd:storage", (_e, { udid } = {}) => getInfo(udid, "com.apple.disk_usage"));
  ipcMain.handle("imd:diagnostics", (_e, { udid } = {}) => getDiagnostics(udid));
  ipcMain.handle("imd:pair", async (_e, { udid } = {}) => {
    const args = ["pair"];
    if (udid) args.push("-u", udid);
    const r = await run(binPath("idevicepair"), args, 30000);
    const out = String(r.stdout || "") + String(r.stderr || "");
    const success = /SUCCESS|paired|is now paired/i.test(out);
    if (success) return { ok: true, message: out.trim() };
    if (/Please accept|trust/i.test(out)) return { ok: false, needsTrust: true, message: out.trim() };
    return { ok: false, error: (r.error || out || "").trim() };
  });
  ipcMain.handle("imd:pair-status", async (_e, { udid } = {}) => {
    const args = ["validate"];
    if (udid) args.push("-u", udid);
    const r = await run(binPath("idevicepair"), args, 10000);
    const out = String(r.stdout || "") + String(r.stderr || "");
    return { ok: /SUCCESS|validated/i.test(out), message: out.trim() };
  });
  ipcMain.handle("imd:history-append", (_e, { udid, snapshot }) => { appendSnapshot(udid, snapshot); return { ok: true }; });
  ipcMain.handle("imd:history-read", (_e, { udid }) => ({ ok: true, entries: (readHistory()[udid] || []) }));
  ipcMain.handle("imd:syslog-start", (_e, { udid } = {}) => startSyslog(getWin(), udid));
  ipcMain.handle("imd:syslog-stop", (_e, { udid } = {}) => stopSyslog(udid));
  ipcMain.handle("imd:crashreports", (_e, { udid } = {}) => fetchCrashReports(udid));
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
  // SPA build (hash routing) — carga desde file://
  const candidates = [
    path.join(__dirname, "..", "dist-electron", "index.html"),
    path.join(process.resourcesPath || "", "app", "dist-electron", "index.html"),
    path.join(__dirname, "..", "dist", "client", "index.html"),
  ];
  const html = candidates.find((p) => fs.existsSync(p));
  if (html) {
    await mainWin.loadFile(html);
  } else {
    await mainWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
      "<div style='font-family:system-ui;background:#0a0a1a;color:#fff;min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center'><div><h1 style='color:#f87171'>Build no encontrado</h1><p>No se encontró <code>dist-electron/index.html</code>.</p></div></div>"
    ));
  }
  // Log de errores de carga para diagnóstico
  mainWin.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[renderer] did-fail-load", code, desc, url);
  });
  mainWin.webContents.on("render-process-gone", (_e, details) => {
    console.error("[renderer] gone", details);
  });
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

