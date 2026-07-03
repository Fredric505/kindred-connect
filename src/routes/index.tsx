import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

const tests = [
  {
    to: "/test/display",
    title: "Pantalla",
    desc: "Píxeles muertos, colores, multitouch y sensibilidad.",
    icon: "􀏅",
  },
  {
    to: "/test/sensors",
    title: "Sensores",
    desc: "Face ID (cámara), giroscopio, acelerómetro y orientación.",
    icon: "􀎽",
  },
  {
    to: "/test/battery",
    title: "Batería y rendimiento",
    desc: "Nivel, carga, memoria disponible y rendimiento.",
    icon: "􀛨",
  },
  {
    to: "/test/media",
    title: "Audio, cámara y conectividad",
    desc: "Micrófono, altavoces, cámaras, vibración, WiFi y Bluetooth.",
    icon: "􀊨",
  },
] as const;

function Index() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-24">
      <section className="pt-20 pb-16 text-center sm:pt-28 sm:pb-24">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Diagnóstico web
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
          Prueba cada parte de tu iPhone.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
          Verifica pantalla, sensores, batería, cámaras y audio directamente desde tu navegador.
          Sin descargas. Sin cuentas.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href="#tests"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Empezar diagnóstico
          </a>
          <Link
            to="/test/display"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-6 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            Probar pantalla →
          </Link>
        </div>
      </section>

      <section id="tests" className="grid gap-4 sm:grid-cols-2">
        {tests.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all hover:border-foreground/20 hover:shadow-lg"
          >
            <div className="text-3xl">{t.icon}</div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">{t.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t.desc}</p>
            <span className="mt-6 inline-flex items-center text-[14px] font-medium text-foreground/80 transition-colors group-hover:text-foreground">
              Ejecutar prueba →
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-20 rounded-3xl bg-secondary/50 p-8 sm:p-12">
        <h3 className="text-2xl font-semibold tracking-tight">¿Cómo funciona?</h3>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Usamos las APIs estándar del navegador (DeviceMotion, MediaDevices, Battery, Vibration,
          Network) para acceder al hardware de tu iPhone. Todo se ejecuta localmente en tu
          dispositivo — nada se envía a servidores externos.
        </p>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Nota: Safari en iOS requiere permiso explícito para algunos sensores. Face ID no es
          accesible directamente desde web; usamos la cámara frontal como aproximación funcional.
        </p>
      </section>
    </main>
  );
}
