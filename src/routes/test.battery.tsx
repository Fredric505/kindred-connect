import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, BackHome } from "./test.display";

export const Route = createFileRoute("/test/battery")({
  head: () => ({
    meta: [
      { title: "Prueba de batería y rendimiento — iPhone Diagnostics" },
      { name: "description", content: "Nivel de batería, estado de carga, memoria disponible y rendimiento del iPhone." },
    ],
  }),
  component: BatteryTest,
});

type Bat = { level: number; charging: boolean; chargingTime: number; dischargingTime: number };

function BatteryTest() {
  const [battery, setBattery] = useState<Bat | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [memory, setMemory] = useState<{ used: number; limit: number } | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [network, setNetwork] = useState<any>(null);

  useEffect(() => {
    const nav: any = navigator;
    if (nav.getBattery) {
      nav.getBattery().then((b: any) => {
        setSupported(true);
        const update = () =>
          setBattery({
            level: b.level,
            charging: b.charging,
            chargingTime: b.chargingTime,
            dischargingTime: b.dischargingTime,
          });
        update();
        b.addEventListener("levelchange", update);
        b.addEventListener("chargingchange", update);
      });
    } else {
      setSupported(false);
    }

    const mem = (performance as any).memory;
    if (mem) setMemory({ used: mem.usedJSHeapSize, limit: mem.jsHeapSizeLimit });

    if (nav.connection) {
      const c = nav.connection;
      setNetwork({ type: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData });
    }

    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="Batería y rendimiento"
        title="Batería y rendimiento"
        desc="Estado de la batería, memoria disponible, conectividad y rendimiento de renderizado."
      />

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Batería</h2>
          {supported === false && (
            <p className="mt-4 text-sm text-muted-foreground">
              Safari en iOS no expone la Battery API por privacidad. Prueba desde Chrome/Android o
              revisa Ajustes → Batería en tu iPhone.
            </p>
          )}
          {battery && (
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight">
                  {Math.round(battery.level * 100)}
                </span>
                <span className="text-2xl text-muted-foreground">%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${battery.level * 100}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {battery.charging ? "🔌 Cargando" : "🔋 En batería"}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Rendimiento</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight">{fps ?? "—"}</span>
            <span className="text-2xl text-muted-foreground">fps</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            iPhones ProMotion alcanzan 120 fps; el resto, 60 fps.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Memoria JS</h2>
          {memory ? (
            <>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">
                  {(memory.used / 1024 / 1024).toFixed(1)}
                </span>
                <span className="text-lg text-muted-foreground">
                  / {(memory.limit / 1024 / 1024).toFixed(0)} MB
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(memory.used / memory.limit) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No disponible en Safari iOS.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Red</h2>
          {network ? (
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Tipo" value={network.type ?? "—"} />
              <Row label="Bajada" value={network.downlink ? `${network.downlink} Mbps` : "—"} />
              <Row label="Latencia" value={network.rtt ? `${network.rtt} ms` : "—"} />
              <Row label="Ahorro datos" value={network.saveData ? "Sí" : "No"} />
              <Row label="Online" value={navigator.onLine ? "Sí" : "No"} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Estado: {navigator.onLine ? "En línea" : "Sin conexión"}
            </p>
          )}
        </div>
      </section>

      <BackHome />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
