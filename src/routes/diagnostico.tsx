import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Usb,
  RefreshCw,
  BatteryFull,
  HardDrive,
  Cpu,
  Signal,
  AlertTriangle,
  CheckCircle2,
  Download,
  ArrowLeft,
  FileDown,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Play,
  Pause,
  Trash2,
  Link2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { getBridge, type BridgeInfo, type HistoryEntry, type CrashReport } from "@/lib/iphone-bridge";
import jsPDF from "jspdf";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico avanzado del iPhone — Lectura real por USB" },
      {
        name: "description",
        content:
          "Batería real, ciclos, salud, IMEI, almacenamiento, autenticidad de piezas y syslog en vivo del iPhone conectado por USB.",
      },
    ],
  }),
  component: DiagnosticoPage,
});

type Snapshot = {
  udid: string;
  info: Record<string, unknown> | null;
  battery: Record<string, unknown> | null;
  storage: Record<string, unknown> | null;
  diagnostics: Record<string, unknown> | null;
  loadedAt: number;
};

function pick(obj: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function fmtBytes(n: unknown) {
  const v = num(n);
  if (!v || v <= 0) return "—";
  const gb = v / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(v / 1024 ** 2).toFixed(0)} MB`;
}

function computeBatteryHealth(battery: Record<string, unknown> | null) {
  // 3uTools / CoconutBattery usan NominalChargeCapacity / DesignCapacity.
  const design = num(pick(battery, "DesignCapacity"));
  const nominal = num(pick(battery, "NominalChargeCapacity"));
  if (design && nominal) return Math.max(0, Math.min(100, Math.round((nominal / design) * 100)));
  const reported = num(pick(battery, "BatteryHealth", "BatteryHealthMetric", "BatteryHealthPercent", "MaximumCapacityPercent"));
  if (reported && reported > 0 && reported <= 100) return Math.round(reported);
  const full = num(pick(battery, "AppleRawMaxCapacity", "FullChargeCapacity", "FullAvailableCapacity", "MaxCapacity"));
  if (!design || !full) return undefined;
  return Math.max(0, Math.min(100, Math.round((full / design) * 100)));
}

function getBatterySourceStatus(battery: Record<string, unknown> | null) {
  const raw = battery?._sourceStatus;
  return Array.isArray(raw) ? raw as { name: string; ok: boolean; keys?: number; error?: string }[] : [];
}

function DiagnosticoPage() {
  const bridge = getBridge();
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [syslog, setSyslog] = useState<string[]>([]);
  const [syslogOn, setSyslogOn] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairMsg, setPairMsg] = useState<string | null>(null);
  const [panics, setPanics] = useState<CrashReport[]>([]);
  const [panicMsg, setPanicMsg] = useState<string | null>(null);
  const [loadingPanics, setLoadingPanics] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadPanics = useCallback(async () => {
    if (!bridge || !snapshot?.udid) return;
    setLoadingPanics(true);
    setPanicMsg(null);
    try {
      const r = await bridge.crashReports({ udid: snapshot.udid });
      if (r.ok) {
        setPanics(r.panics || []);
        if ((r.panics || []).length === 0) setPanicMsg("Sin panics registrados en el dispositivo.");
        if (r.warning) setPanicMsg((prev) => (prev ? prev + " · " : "") + `Aviso: ${r.warning}`);
      } else {
        setPanicMsg(r.error || "No se pudieron leer los crash reports.");
      }
    } finally {
      setLoadingPanics(false);
    }
  }, [bridge, snapshot?.udid]);

  const refresh = useCallback(async () => {
    if (!bridge) return;
    setScanning(true);
    setError(null);
    try {
      const detected = await bridge.detect();
      if (!detected.ok || detected.devices.length === 0) {
        setSnapshot(null);
        setError(
          detected.ok
            ? "No se detectó ningún iPhone. Conecta el cable, desbloquea el equipo y toca 'Confiar' cuando aparezca el aviso."
            : detected.error ||
                "No pude comunicarme con el iPhone. Verifica que Apple Devices / iTunes esté instalado.",
        );
        return;
      }
      const udid = detected.devices[0];
      const [info, battery, storage, diagnostics, hist] = await Promise.all([
        bridge.info({ udid }),
        bridge.battery({ udid }),
        bridge.storage({ udid }),
        bridge.diagnostics({ udid }),
        bridge.historyRead({ udid }),
      ]);
      const snap: Snapshot = {
        udid,
        info: info.ok ? (info.data ?? null) : null,
        battery: battery.ok ? (battery.data ?? null) : null,
        storage: storage.ok ? (storage.data ?? null) : null,
        diagnostics: diagnostics.ok ? (diagnostics.data ?? null) : null,
        loadedAt: Date.now(),
      };
      setSnapshot(snap);
      setHistory(hist.ok ? (hist.entries ?? []) : []);

      const totalCap = num(pick(snap.storage, "TotalDiskCapacity"));
      const freeCap = num(pick(snap.storage, "AmountDataAvailable", "TotalDataAvailable"));
      const usedPct = totalCap && freeCap ? Math.round(((totalCap - freeCap) / totalCap) * 100) : undefined;
      await bridge.historyAppend({
        udid,
        snapshot: {
          batteryLevel: num(pick(snap.battery, "BatteryCurrentCapacity")),
          batteryHealth: computeBatteryHealth(snap.battery),
          cycles: num(pick(snap.battery, "CycleCount")),
          storageUsedPct: usedPct,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setScanning(false);
    }
  }, [bridge]);

  const pair = useCallback(async () => {
    if (!bridge) return;
    setPairing(true);
    setPairMsg(null);
    try {
      const udid = snapshot?.udid;
      const r = await bridge.pair(udid ? { udid } : {});
      if (r.ok) {
        setPairMsg("Emparejado correctamente. Reescaneando…");
        await refresh();
        // Verifica si tras el pair conseguimos identidad real (nombre / modelo).
        // Si sigue vacío, es limitación de iOS (17+/26 beta).
        setPairMsg("Emparejado. Hice un escaneo profundo por Lockdown, GasGauge e IORegistry; si faltan ciclos/salud/piezas, iOS no los está entregando por USB en esta versión.");
      } else if (r.needsTrust) {
        setPairMsg("Desbloquea el iPhone y toca 'Confiar' en el aviso. Luego pulsa 'Emparejar' otra vez.");
      } else {
        setPairMsg(r.error || r.message || "No pude emparejar. Verifica que el iPhone esté desbloqueado.");
      }
    } catch (e) {
      setPairMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPairing(false);
    }
  }, [bridge, snapshot, refresh]);

  useEffect(() => {
    if (!bridge) return;
    bridge.bridgeInfo().then(setBridgeInfo).catch(() => {});
    refresh();
  }, [bridge, refresh]);

  useEffect(() => {
    if (!bridge) return;
    const off = bridge.onSyslog((p) => {
      setSyslog((prev) => {
        const next = [...prev, ...p.line.split(/\r?\n/).filter(Boolean)];
        return next.slice(-500);
      });
    });
    return () => { off(); };
  }, [bridge]);

  const toggleSyslog = async () => {
    if (!bridge || !snapshot) return;
    if (syslogOn) {
      await bridge.syslogStop({ udid: snapshot.udid });
      setSyslogOn(false);
    } else {
      setSyslog([]);
      await bridge.syslogStart({ udid: snapshot.udid });
      setSyslogOn(true);
    }
  };

  const exportPdf = () => {
    if (!snapshot) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 60;
    doc.setFontSize(20); doc.text("Diagnóstico iPhone", 40, y); y += 8;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(new Date(snapshot.loadedAt).toLocaleString(), 40, y + 12); y += 30;
    doc.setTextColor(0);

    const section = (title: string, rows: [string, string][]) => {
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(title, 40, y); y += 6;
      doc.setDrawColor(200); doc.line(40, y, W - 40, y); y += 14;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      rows.forEach(([k, v]) => {
        if (y > 780) { doc.addPage(); y = 60; }
        doc.setTextColor(110); doc.text(k, 40, y);
        doc.setTextColor(0); doc.text(String(v || "—"), 220, y);
        y += 16;
      });
      y += 12;
    };

    const b = snapshot.battery, i = snapshot.info, s = snapshot.storage;
    section("Identidad", [
      ["Nombre", String(pick(i, "DeviceName") ?? "—")],
      ["Modelo", String(pick(i, "ProductType", "ModelNumber") ?? "—")],
      ["iOS", String(pick(i, "ProductVersion") ?? "—")],
      ["Serie", String(pick(i, "SerialNumber") ?? "—")],
      ["IMEI", String(pick(i, "InternationalMobileEquipmentIdentity") ?? "—")],
      ["UDID", snapshot.udid],
    ]);
    section("Batería", [
      ["Nivel actual", `${num(pick(b, "BatteryCurrentCapacity")) ?? "—"}%`],
      ["Salud", `${computeBatteryHealth(b) ?? "—"}%`],
      ["Ciclos", String(num(pick(b, "CycleCount")) ?? "—")],
      ["Capacidad diseño", `${num(pick(b, "DesignCapacity")) ?? "—"} mAh`],
      ["Capacidad actual", `${num(pick(b, "AppleRawMaxCapacity", "FullChargeCapacity")) ?? "—"} mAh`],
    ]);
    const total = num(pick(s, "TotalDiskCapacity"));
    const free = num(pick(s, "AmountDataAvailable", "TotalDataAvailable"));
    section("Almacenamiento", [
      ["Total", fmtBytes(total)],
      ["Usado", fmtBytes(total && free ? total - free : undefined)],
      ["Libre", fmtBytes(free)],
    ]);

    doc.save(`diagnostico-${snapshot.udid.slice(0, 8)}-${Date.now()}.pdf`);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <Usb className="h-3.5 w-3.5" aria-hidden="true" />
            Lectura real por USB
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Diagnóstico avanzado
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Batería, ciclos, salud, autenticidad de piezas y syslog en vivo — vía protocolo
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">lockdownd</code>.
          </p>
        </div>
        {bridge && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={pair}
              disabled={pairing}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary backdrop-blur hover:bg-primary/20 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              title="Confía el PC con el iPhone (Trust). Necesario para leer batería, IMEI, serie e identidad."
            >
              <Link2 className={`h-4 w-4 ${pairing ? "animate-pulse" : ""}`} aria-hidden="true" />
              {pairing ? "Emparejando…" : "Emparejar (Trust)"}
            </button>
            {snapshot && (
              <button
                onClick={exportPdf}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-2.5 text-sm font-medium backdrop-blur hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Exportar PDF
              </button>
            )}
            <button
              onClick={refresh}
              disabled={scanning}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} aria-hidden="true" />
              {scanning ? "Escaneando…" : "Escanear"}
            </button>
          </div>
        )}
      </div>

      {bridge && pairMsg && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-foreground/90">{pairMsg}</p>
        </div>
      )}

      {!bridge && <WebModeNotice />}

      {bridge && error && (
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive">No se pudo leer el iPhone</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {bridge && snapshot && (
        <div ref={reportRef} className="mt-10 space-y-5">
          <ConnectedBanner udid={snapshot.udid} loadedAt={snapshot.loadedAt} />
          <HealthScore snapshot={snapshot} />

          <div className="grid gap-4 md:grid-cols-2">
            <IdentityCard info={snapshot.info} />
            <BatteryCard battery={snapshot.battery} />
            <StorageCard storage={snapshot.storage} />
            <SystemCard info={snapshot.info} />
          </div>

          <AuthenticityCard snapshot={snapshot} syslog={syslog} />
          <HistoryCard history={history} />
          <PanicsCard panics={panics} message={panicMsg} loading={loadingPanics} onLoad={loadPanics} />
          <SyslogCard lines={syslog} on={syslogOn} onToggle={toggleSyslog} onClear={() => setSyslog([])} />
        </div>
      )}

      {bridgeInfo && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Bridge v{bridgeInfo.appVersion} · {bridgeInfo.platform}/{bridgeInfo.arch}
          {bridgeInfo.binDir ? " · binarios locales" : " · PATH del sistema"}
        </p>
      )}

      <div className="mt-12 flex justify-center">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/50 px-5 py-2.5 text-sm font-medium backdrop-blur hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function WebModeNotice() {
  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/40 p-6 backdrop-blur sm:p-10">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
          <Download className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Esta función requiere la app de escritorio
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            El navegador no puede leer el hardware del iPhone. La versión{" "}
            <strong className="text-foreground">.exe</strong> se conecta al iPhone por USB usando
            el mismo protocolo que iTunes y obtiene: batería real (salud, ciclos, temperatura),
            almacenamiento, IMEI, autenticidad de piezas y logs en vivo.
          </p>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <RequirementItem title="Windows 10/11" desc="Con Apple Devices o iTunes instalado." />
            <RequirementItem title="Cable USB" desc="Lightning o USB-C, original recomendado." />
            <RequirementItem title="Confiar en el PC" desc="Popup en el iPhone la primera vez." />
          </ul>
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Instalador disponible</p>
            <p className="mt-1">
              El <code>.exe</code> lo generas con <code>bun run electron:pack:win</code> (ver{" "}
              <code>ELECTRON.md</code>). Mientras tanto, prueba las{" "}
              <Link to="/" className="text-primary underline">pruebas interactivas</Link> desde
              cualquier navegador.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RequirementItem({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="flex items-start gap-2 rounded-2xl border border-border/60 bg-card/40 p-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}

function ConnectedBanner({ udid, loadedAt }: { udid: string; loadedAt: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">iPhone conectado</p>
        <p className="truncate font-mono text-xs text-muted-foreground">UDID: {udid}</p>
      </div>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {new Date(loadedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

function HealthScore({ snapshot }: { snapshot: Snapshot }) {
  const health = computeBatteryHealth(snapshot.battery);
  const cycles = num(pick(snapshot.battery, "CycleCount"));
  const total = num(pick(snapshot.storage, "TotalDiskCapacity"));
  const free = num(pick(snapshot.storage, "AmountDataAvailable", "TotalDataAvailable"));
  const storagePct = total && free ? Math.round(((total - free) / total) * 100) : undefined;

  // Score global 0-100.
  let score = 100;
  if (health !== undefined) score -= Math.max(0, 100 - health) * 0.6;
  if (cycles !== undefined) score -= Math.min(30, cycles / 20);
  if (storagePct !== undefined && storagePct > 90) score -= 10;
  const final = Math.max(0, Math.min(100, Math.round(score)));
  const tone = final >= 85 ? "primary" : final >= 65 ? "primary" : "destructive";

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-[auto_1fr]">
      <div className="flex items-center gap-4">
        <div className={`grid h-20 w-20 place-items-center rounded-2xl bg-${tone}/15 text-${tone} ring-1 ring-inset ring-${tone}/30`}>
          <span className="text-3xl font-semibold tracking-tight">{final}</span>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Score global</p>
          <p className="mt-1 text-lg font-semibold">
            {final >= 85 ? "Excelente" : final >= 65 ? "Aceptable" : "Requiere atención"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <MiniStat label="Salud batería" value={health !== undefined ? `${health}%` : "—"} />
        <MiniStat label="Ciclos" value={cycles !== undefined ? String(cycles) : "—"} />
        <MiniStat label="Almacen." value={storagePct !== undefined ? `${storagePct}%` : "—"} />
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Cpu; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-sm">{value ?? "—"}</span>
    </div>
  );
}

function IdentityCard({ info }: { info: Record<string, unknown> | null }) {
  return (
    <InfoCard icon={Cpu} title="Identidad">
      <Row label="Nombre" value={pick(info, "DeviceName") as string} />
      <Row label="Modelo" value={pick(info, "ProductType", "ModelNumber") as string} />
      <Row label="iOS" value={pick(info, "ProductVersion") as string} />
      <Row label="Build" value={pick(info, "BuildVersion") as string} />
      <Row label="Nº serie" value={pick(info, "SerialNumber") as string} />
      <Row label="IMEI" value={pick(info, "InternationalMobileEquipmentIdentity") as string} />
    </InfoCard>
  );
}

function BatteryCard({ battery }: { battery: Record<string, unknown> | null }) {
  const level = num(pick(battery, "BatteryCurrentCapacity"));
  const cycles = num(pick(battery, "CycleCount"));
  const design = num(pick(battery, "DesignCapacity"));
  const full = num(pick(battery, "AppleRawMaxCapacity", "FullChargeCapacity", "FullAvailableCapacity", "MaxCapacity"));
  const health = computeBatteryHealth(battery);
  const temp = num(pick(battery, "Temperature"));
  const sourceStatus = getBatterySourceStatus(battery);
  const sourceKeys = sourceStatus.reduce((sum, s) => sum + (s.keys ?? 0), 0);
  return (
    <InfoCard icon={BatteryFull} title="Batería">
      {level !== undefined && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{level}</span>
            <span className="text-lg text-muted-foreground">% actual</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${level}%` }} />
          </div>
        </>
      )}
      <div className="mt-4">
        <Row label="Salud" value={health !== undefined ? `${health}%` : undefined} />
        <Row label="Ciclos" value={cycles} />
        <Row label="Cap. diseño" value={design ? `${design} mAh` : undefined} />
        <Row label="Cap. actual" value={full ? `${full} mAh` : undefined} />
        <Row label="Temperatura" value={temp ? `${(temp / 100).toFixed(1)} °C` : undefined} />
      </div>
      {sourceStatus.length > 0 && (cycles === undefined || health === undefined) && (
        <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Lectura avanzada limitada</p>
          <p className="mt-1">
            Se probaron {sourceStatus.length} fuentes profundas y se encontraron {sourceKeys} claves de batería.
            Si ciclos/salud siguen en blanco, tu iOS los está ocultando al PC.
          </p>
        </div>
      )}
    </InfoCard>
  );
}

function StorageCard({ storage }: { storage: Record<string, unknown> | null }) {
  const total = num(pick(storage, "TotalDiskCapacity"));
  const free = num(pick(storage, "AmountDataAvailable", "TotalDataAvailable"));
  const used = total && free ? total - free : undefined;
  const pct = total && used ? Math.round((used / total) * 100) : undefined;
  return (
    <InfoCard icon={HardDrive} title="Almacenamiento">
      {pct !== undefined && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{pct}</span>
            <span className="text-lg text-muted-foreground">% usado</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      <div className="mt-4">
        <Row label="Total" value={fmtBytes(total)} />
        <Row label="Usado" value={fmtBytes(used)} />
        <Row label="Libre" value={fmtBytes(free)} />
      </div>
    </InfoCard>
  );
}

function SystemCard({ info }: { info: Record<string, unknown> | null }) {
  return (
    <InfoCard icon={Signal} title="Sistema y radios">
      <Row label="Región" value={pick(info, "RegionInfo") as string} />
      <Row label="Modem" value={pick(info, "BasebandVersion") as string} />
      <Row label="WiFi MAC" value={pick(info, "WiFiAddress") as string} />
      <Row label="Bluetooth MAC" value={pick(info, "BluetoothAddress") as string} />
      <Row label="Zona horaria" value={pick(info, "TimeZone") as string} />
      <Row label="Idioma" value={pick(info, "Language") as string} />
    </InfoCard>
  );
}

function AuthenticityCard({ snapshot, syslog }: { snapshot: Snapshot; syslog: string[] }) {
  // Heurística: iOS registra en syslog patrones como "Unknown Part" cuando detecta
  // batería/pantalla no originales. También revisamos claves de gestalt.
  const suspiciousLines = syslog.filter((l) =>
    /unknown\s*part|non[- ]?genuine|not\s+a\s+genuine|counterfeit|CoreOptics.*mismatch|BatteryPack.*mismatch/i.test(l),
  );
  const batterySerial = pick(snapshot.battery, "Serial", "BatterySerialNumber") as string | undefined;
  const cycles = num(pick(snapshot.battery, "CycleCount"));
  const health = computeBatteryHealth(snapshot.battery);
  const sourceStatus = getBatterySourceStatus(snapshot.battery);
  const blockedSources = sourceStatus.filter((s) => !s.ok).length;

  const flags: { level: "ok" | "warn" | "bad"; title: string; detail: string }[] = [];
  if (suspiciousLines.length > 0) {
    flags.push({
      level: "bad",
      title: "iOS reporta pieza no original",
      detail: `Se detectaron ${suspiciousLines.length} mensajes de "unknown part" en el syslog. Abre el panel de logs para ver detalles.`,
    });
  } else if (syslog.length === 0) {
    flags.push({
      level: "warn",
      title: "Piezas no verificables por USB",
      detail: blockedSources > 0
        ? "iOS bloqueó logs/IORegistry necesarios para confirmar piezas. Revisa Ajustes > General > Información > Historial de piezas en el iPhone."
        : "Activa Syslog en vivo para intentar capturar avisos de piezas; si iOS lo bloquea, solo el iPhone puede mostrarlo en Ajustes.",
    });
  } else {
    flags.push({
      level: "ok",
      title: "Sin alertas de piezas no originales",
      detail: "iOS no está reportando componentes desconocidos en los logs monitorizados.",
    });
  }
  if (health !== undefined && health < 80) {
    flags.push({
      level: "warn",
      title: "Salud de batería baja",
      detail: `${health}% — Apple recomienda reemplazar por debajo del 80%.`,
    });
  }
  if (cycles !== undefined && cycles > 800) {
    flags.push({
      level: "warn",
      title: "Ciclos elevados",
      detail: `${cycles} ciclos — el diseño de iPhone contempla ~1000 al 80%.`,
    });
  }
  if (batterySerial) {
    flags.push({
      level: "ok",
      title: "Serie batería legible",
      detail: batterySerial,
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Autenticidad de piezas
        </h2>
        <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Beta
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Basado en logs del sistema y series de componentes. Activa el <strong>Syslog en vivo</strong> abajo
        para mejorar la detección — iOS publica los avisos "Unknown Part" en tiempo real.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {flags.map((f, i) => (
          <li key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${f.level === "bad" ? "border-destructive/40 bg-destructive/10" : f.level === "warn" ? "border-amber-500/40 bg-amber-500/10" : "border-primary/30 bg-primary/5"}`}>
            {f.level === "bad" ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            ) : f.level === "warn" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{f.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryCard({ history }: { history: HistoryEntry[] }) {
  const data = useMemo(
    () =>
      history.map((h) => ({
        t: new Date(h.t).toLocaleDateString(),
        Salud: h.batteryHealth ?? null,
        Nivel: h.batteryLevel ?? null,
      })),
    [history],
  );
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Historial de batería
        </h2>
      </div>
      {data.length < 2 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Necesito al menos 2 lecturas para dibujar la evolución. Vuelve mañana tras un nuevo
          escaneo — cada snapshot se guarda automáticamente en tu PC.
        </p>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <ReTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="Salud" stroke="oklch(0.58 0.22 275)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Nivel" stroke="oklch(0.75 0.15 275)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function SyslogCard({ lines, on, onToggle, onClear }: { lines: string[]; on: boolean; onToggle: () => void; onClear: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Syslog en vivo
          </h2>
          {on && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              En vivo
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Limpiar
          </button>
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {on ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
            {on ? "Detener" : "Iniciar"}
          </button>
        </div>
      </div>
      <div
        ref={boxRef}
        className="mt-4 h-64 overflow-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-primary/90 ring-1 ring-inset ring-border"
      >
        {lines.length === 0 ? (
          <p className="text-muted-foreground">
            {on ? "Esperando eventos del iPhone…" : "Pulsa Iniciar para ver los logs del sistema en tiempo real."}
          </p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={/unknown\s*part|error|fatal/i.test(l) ? "text-destructive" : ""}>
              {l}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function extractPanicSummary(head: string) {
  const lines = head.split(/\r?\n/).slice(0, 40);
  const pick = (re: RegExp) => {
    for (const l of lines) { const m = l.match(re); if (m) return m[1] || m[0]; }
    return null;
  };
  return {
    date: pick(/"?timestamp"?\s*[:=]\s*"?([^",\n]+)/i) || pick(/^Date\/Time:\s*(.+)/i),
    product: pick(/"?product"?\s*[:=]\s*"?([^",\n]+)/i) || pick(/^Hardware Model:\s*(.+)/i),
    os: pick(/"?os_version"?\s*[:=]\s*"?([^",\n]+)/i) || pick(/^OS Version:\s*(.+)/i),
    reason: pick(/panicString"?\s*[:=]\s*"?([^"\n]+)/i) || pick(/^Exception (?:Type|Note):\s*(.+)/i) || pick(/"?bug_type"?\s*[:=]\s*"?([^",\n]+)/i),
  };
}

function PanicsCard({ panics, message, loading, onLoad }: { panics: CrashReport[]; message: string | null; loading: boolean; onLoad: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section className="rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <h3 className="text-base font-semibold">Historial de panics</h3>
          {panics.length > 0 && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
              {panics.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          {loading ? "Descargando…" : panics.length ? "Actualizar" : "Descargar crash logs"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      {panics.length === 0 && !loading && !message && (
        <p className="mt-3 text-sm text-muted-foreground">
          Pulsa el botón para descargar los crash logs del iPhone y mostrar los panics del kernel.
        </p>
      )}
      {panics.length > 0 && (
        <ul className="mt-4 space-y-2">
          {panics.slice(0, 20).map((p, i) => {
            const sum = extractPanicSummary(p.head);
            const open = openIdx === i;
            return (
              <li key={p.path} className="rounded-2xl border border-border bg-background/40">
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{sum.reason || p.file}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(p.mtime).toLocaleString()}
                      {sum.os ? ` · ${sum.os}` : ""}
                      {sum.product ? ` · ${sum.product}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <pre className="max-h-72 overflow-auto border-t border-border bg-black/40 p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {p.head}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
