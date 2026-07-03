import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/test/display")({
  head: () => ({
    meta: [
      { title: "Prueba de pantalla — iPhone Diagnostics" },
      { name: "description", content: "Detecta píxeles muertos, prueba colores puros y multitouch en tu iPhone." },
    ],
  }),
  component: DisplayTest,
});

const COLORS = [
  { name: "Rojo", value: "#FF0000" },
  { name: "Verde", value: "#00FF00" },
  { name: "Azul", value: "#0000FF" },
  { name: "Blanco", value: "#FFFFFF" },
  { name: "Negro", value: "#000000" },
];

function DisplayTest() {
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [touches, setTouches] = useState<{ x: number; y: number; id: number }[]>([]);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const handleTouch = (e: React.TouchEvent) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const list: { x: number; y: number; id: number }[] = [];
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      list.push({ x: t.clientX - rect.left, y: t.clientY - rect.top, id: t.identifier });
    }
    setTouches(list);
  };

  if (fullscreen) {
    return (
      <div
        onClick={() => setFullscreen(null)}
        className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center pb-8"
        style={{ backgroundColor: fullscreen }}
      >
        <p
          className="rounded-full bg-black/40 px-4 py-2 text-xs text-white backdrop-blur"
          style={{ mixBlendMode: "difference" }}
        >
          Toca para salir · Busca puntos que no cambien de color
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Pantalla"
        title="Prueba de pantalla"
        desc="Detecta píxeles muertos con colores puros, verifica multitouch y la sensibilidad."
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Colores a pantalla completa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toca cada color y busca puntos que no cambien — indican píxeles muertos.
        </p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setFullscreen(c.value)}
              className="aspect-square rounded-2xl border border-border transition-transform hover:scale-105"
              style={{ backgroundColor: c.value }}
              aria-label={c.name}
              title={c.name}
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Prueba de multitouch</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Coloca varios dedos en el área. El iPhone soporta hasta 5 puntos táctiles.
        </p>
        <div
          ref={areaRef}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={handleTouch}
          className="relative mt-4 h-80 touch-none overflow-hidden rounded-2xl border border-border bg-secondary/50 select-none"
        >
          {touches.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Toca aquí con uno o más dedos
            </div>
          )}
          {touches.map((t) => (
            <div
              key={t.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/80"
              style={{ left: t.x, top: t.y, width: 80, height: 80 }}
            />
          ))}
          <div className="absolute top-3 right-3 rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
            {touches.length} punto{touches.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <BackHome />
    </div>
  );
}

export function PageHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <header>
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
    </header>
  );
}

export function BackHome() {
  return (
    <div className="mt-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Volver a todas las pruebas
      </Link>
    </div>
  );
}
