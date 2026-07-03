import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Smartphone,
  Radar,
  BatteryCharging,
  Mic,
  ArrowRight,
  ShieldCheck,
  Zap,
  WifiOff,
  Usb,
} from "lucide-react";


export const Route = createFileRoute("/")({
  component: Index,
});

const tests = [
  {
    to: "/test/display" as const,
    title: "Pantalla",
    desc: "Píxeles muertos, colores puros, multitouch y sensibilidad.",
    Icon: Smartphone,
    tag: "5 pruebas",
  },
  {
    to: "/test/sensors" as const,
    title: "Sensores",
    desc: "Face ID (cámara), giroscopio, acelerómetro y orientación.",
    Icon: Radar,
    tag: "3 pruebas",
  },
  {
    to: "/test/battery" as const,
    title: "Batería y rendimiento",
    desc: "Nivel, carga, memoria disponible, FPS y estado de red.",
    Icon: BatteryCharging,
    tag: "4 métricas",
  },
  {
    to: "/test/media" as const,
    title: "Audio, cámara y conectividad",
    desc: "Micrófono, altavoces, cámaras, vibración, WiFi y Bluetooth.",
    Icon: Mic,
    tag: "5 pruebas",
  },
];

const features = [
  { Icon: ShieldCheck, title: "100% local", desc: "Nada sale de tu dispositivo." },
  { Icon: Zap, title: "Sin instalar", desc: "Funciona en cualquier navegador moderno." },
  { Icon: WifiOff, title: "PWA offline‑ready", desc: "Instálalo como app en PC o iPhone." },
];

function Index() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6">
      {/* Hero */}
      <section className="pt-16 pb-14 text-center sm:pt-24 sm:pb-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[12px] font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Diagnóstico web para iOS y macOS
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Prueba cada parte
          <br />
          <span className="bg-linear-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
            de tu iPhone.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Verifica pantalla, sensores, batería, cámaras y audio directamente desde tu navegador.
          Sin descargas. Sin cuentas.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href="#tests"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-[15px] font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Empezar diagnóstico
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link
            to="/test/display"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card/50 px-6 py-3 text-[15px] font-medium text-foreground backdrop-blur transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Probar pantalla
          </Link>
        </div>

        {/* Feature strip */}
        <ul className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {features.map((f) => (
            <li
              key={f.title}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 text-left backdrop-blur"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"
                aria-hidden="true"
              >
                <f.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.title}</p>
                <p className="truncate text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Tests grid */}
      <section id="tests" aria-labelledby="tests-heading" className="scroll-mt-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 id="tests-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Categorías de pruebas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Elige un módulo para comenzar.</p>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <li key={t.to}>
              <Link
                to={t.to}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/60 p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-8"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-opacity group-hover:bg-primary/20"
                />
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-primary/30 to-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                    aria-hidden="true"
                  >
                    <t.Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t.tag}
                  </span>
                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Diagnóstico avanzado (USB) */}
      <section className="mt-16 sm:mt-20">
        <Link
          to="/diagnostico"
          className="group relative flex flex-col overflow-hidden rounded-3xl border border-primary/40 bg-linear-to-br from-primary/20 via-card/60 to-card/40 p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl transition-opacity group-hover:bg-primary/40"
          />
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/25 text-primary ring-1 ring-inset ring-primary/40">
              <Usb className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-primary">
              App de escritorio
            </span>
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Diagnóstico avanzado por USB
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Batería real, ciclos, salud, IMEI, almacenamiento y sensores — leídos directamente
            del iPhone con el mismo protocolo que iTunes. Disponible en la versión .exe.
          </p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Abrir diagnóstico
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
      </section>


      {/* Info */}
      <section className="mt-16 overflow-hidden rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/40 p-6 backdrop-blur sm:mt-20 sm:p-10">
        <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">¿Cómo funciona?</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Usamos las APIs estándar del navegador (DeviceMotion, MediaDevices, Battery,
            Vibration, Network) para acceder al hardware de tu iPhone. Todo se ejecuta
            localmente — nada se envía a servidores externos.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Safari en iOS requiere permiso explícito para algunos sensores. Face ID no es
            accesible directamente desde web; usamos la cámara frontal como aproximación
            funcional.
          </p>
        </div>
      </section>
    </div>
  );
}
