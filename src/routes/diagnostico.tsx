import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { getBridge, type BridgeInfo } from "@/lib/iphone-bridge";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico avanzado del iPhone — Lectura real por USB" },
      {
        name: "description",
        content:
          "Lee batería real, ciclos, salud, IMEI, almacenamiento y sensores de tu iPhone conectado por USB. Solo en la app de escritorio.",
      },
    ],
  }),
  component: DiagnosticoPage,
});

type DeviceSnapshot = {
  udid: string;
  info: Record<string, unknown> | null;
  battery: Record<string, unknown> | null;
  storage: Record<string, unknown> | null;
  loadedAt: number;
};

function pick(obj: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
}

function fmtBytes(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  const gb = v / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = v / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

function DiagnosticoPage() {
  const bridge = getBridge();
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null);

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
            ? "No se detectó ningún iPhone. Conecta el cable y toca 'Confiar' en el iPhone."
            : detected.error ||
                "No pude comunicarme con el iPhone. ¿Está instalado Apple Devices / iTunes?",
        );
        return;
      }
      const udid = detected.devices[0];
      const [info, battery, storage] = await Promise.all([
        bridge.info({ udid }),
        bridge.battery({ udid }),
        bridge.storage({ udid }),
      ]);
      setSnapshot({
        udid,
        info: info.ok ? (info.data ?? null) : null,
        battery: battery.ok ? (battery.data ?? null) : null,
        storage: storage.ok ? (storage.data ?? null) : null,
        loadedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setScanning(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    bridge.bridgeInfo().then(setBridgeInfo).catch(() => {});
    refresh();
  }, [bridge, refresh]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <Usb className="h-3.5 w-3.5" aria-hidden="true" />
            Lectura real por USB
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Diagnóstico avanzado
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Batería, almacenamiento, IMEI, sensores y logs — leídos directamente del iPhone
            vía el protocolo <code className="rounded bg-muted px-1.5 py-0.5 text-xs">lockdownd</code>.
          </p>
        </div>
        {bridge && (
          <button
            onClick={refresh}
            disabled={scanning}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} aria-hidden="true" />
            {scanning ? "Escaneando…" : "Volver a escanear"}
          </button>
        )}
      </div>

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
        <div className="mt-10 space-y-5">
          <ConnectedBanner udid={snapshot.udid} loadedAt={snapshot.loadedAt} />

          <div className="grid gap-4 md:grid-cols-2">
            <IdentityCard info={snapshot.info} />
            <BatteryCard battery={snapshot.battery} />
            <StorageCard storage={snapshot.storage} />
            <SystemCard info={snapshot.info} />
          </div>
        </div>
      )}

      {bridgeInfo && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Bridge v{bridgeInfo.appVersion} · {bridgeInfo.platform}/{bridgeInfo.arch}
          {bridgeInfo.binDir ? " · binarios locales" : " · usando PATH del sistema"}
        </p>
      )}

      <div className="mt-12 flex justify-center">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/50 px-5 py-2.5 text-sm font-medium backdrop-blur transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
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
            El navegador no puede leer el hardware del iPhone por privacidad. Para acceder a
            batería real, ciclos, IMEI, almacenamiento y logs necesitas la versión{" "}
            <strong className="text-foreground">.exe / .app</strong>, que se conecta al iPhone
            por USB usando el mismo protocolo que iTunes.
          </p>

          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <RequirementItem title="Windows 10/11" desc="Con Apple Devices o iTunes instalado." />
            <RequirementItem title="Cable USB" desc="Lightning o USB-C, original recomendado." />
            <RequirementItem title="Confiar en el PC" desc="Popup en el iPhone la primera vez." />
          </ul>

          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Estado actual del build</p>
            <p className="mt-1">
              El puente IPC ya está integrado. El instalador <code>.exe</code> se genera con{" "}
              <code>bun run electron:pack</code> (ver <code>ELECTRON.md</code>). Mientras tanto,
              usa las <Link to="/" className="text-primary underline">pruebas interactivas</Link>{" "}
              que sí funcionan desde la web.
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
        Leído a las {new Date(loadedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cpu;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
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
  const model = pick(info, "ProductType", "ModelNumber") as string | undefined;
  const name = pick(info, "DeviceName") as string | undefined;
  const ios = pick(info, "ProductVersion") as string | undefined;
  const build = pick(info, "BuildVersion") as string | undefined;
  const serial = pick(info, "SerialNumber") as string | undefined;
  const imei = pick(info, "InternationalMobileEquipmentIdentity") as string | undefined;
  return (
    <InfoCard icon={Cpu} title="Identidad">
      <Row label="Nombre" value={name} />
      <Row label="Modelo" value={model} />
      <Row label="iOS" value={ios ? `${ios}${build ? ` (${build})` : ""}` : undefined} />
      <Row label="Nº serie" value={serial} />
      <Row label="IMEI" value={imei} />
    </InfoCard>
  );
}

function BatteryCard({ battery }: { battery: Record<string, unknown> | null }) {
  const level = pick(battery, "BatteryCurrentCapacity") as number | undefined;
  const cycles = pick(battery, "CycleCount") as number | undefined;
  const design = pick(battery, "DesignCapacity") as number | undefined;
  const full = pick(battery, "AppleRawMaxCapacity", "FullChargeCapacity") as number | undefined;
  const health =
    design && full ? Math.round((Number(full) / Number(design)) * 100) : undefined;
  const temp = pick(battery, "Temperature") as number | undefined;
  return (
    <InfoCard icon={BatteryFull} title="Batería">
      {typeof level === "number" && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{level}</span>
            <span className="text-lg text-muted-foreground">% nivel actual</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${level}%` }} />
          </div>
        </>
      )}
      <div className="mt-4">
        <Row label="Salud" value={health !== undefined ? `${health}%` : "—"} />
        <Row label="Ciclos" value={cycles} />
        <Row label="Cap. diseño" value={design ? `${design} mAh` : undefined} />
        <Row label="Cap. actual" value={full ? `${full} mAh` : undefined} />
        <Row label="Temperatura" value={temp ? `${(Number(temp) / 100).toFixed(1)} °C` : undefined} />
      </div>
    </InfoCard>
  );
}

function StorageCard({ storage }: { storage: Record<string, unknown> | null }) {
  const total = pick(storage, "TotalDiskCapacity") as number | undefined;
  const free = pick(storage, "AmountDataAvailable", "TotalDataAvailable") as number | undefined;
  const used = total && free ? Number(total) - Number(free) : undefined;
  const pct = total && used ? Math.round((used / Number(total)) * 100) : undefined;
  return (
    <InfoCard icon={HardDrive} title="Almacenamiento">
      {typeof pct === "number" && (
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
  const region = pick(info, "RegionInfo") as string | undefined;
  const modem = pick(info, "BasebandVersion") as string | undefined;
  const carrier = pick(info, "CarrierBundleInfoArray", "SIMStatus") as string | undefined;
  const wifi = pick(info, "WiFiAddress") as string | undefined;
  const bt = pick(info, "BluetoothAddress") as string | undefined;
  return (
    <InfoCard icon={Signal} title="Sistema y radios">
      <Row label="Región" value={region} />
      <Row label="Modem" value={modem} />
      <Row label="SIM / Operador" value={typeof carrier === "string" ? carrier : undefined} />
      <Row label="WiFi MAC" value={wifi} />
      <Row label="Bluetooth MAC" value={bt} />
    </InfoCard>
  );
}
