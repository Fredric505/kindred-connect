import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader, BackHome } from "./test.display";

export const Route = createFileRoute("/test/sensors")({
  head: () => ({
    meta: [
      { title: "Prueba de sensores — iPhone Diagnostics" },
      { name: "description", content: "Verifica giroscopio, acelerómetro, orientación y cámara frontal (Face ID)." },
    ],
  }),
  component: SensorsTest,
});

type Motion = { x: number; y: number; z: number };
type Orient = { alpha: number; beta: number; gamma: number };

function SensorsTest() {
  const [motion, setMotion] = useState<Motion | null>(null);
  const [orient, setOrient] = useState<Orient | null>(null);
  const [permState, setPermState] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const [faceIdActive, setFaceIdActive] = useState(false);
  const [faceIdError, setFaceIdError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestMotion = async () => {
    try {
      const DME = (window as any).DeviceMotionEvent;
      const DOE = (window as any).DeviceOrientationEvent;
      if (DME?.requestPermission) {
        const r = await DME.requestPermission();
        if (r !== "granted") return setPermState("denied");
      }
      if (DOE?.requestPermission) {
        await DOE.requestPermission();
      }
      setPermState("granted");
    } catch {
      setPermState("unsupported");
    }
  };

  useEffect(() => {
    if (permState !== "granted") return;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a) setMotion({ x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 });
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      setOrient({ alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 });
    };
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [permState]);

  const startFaceId = async () => {
    setFaceIdError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFaceIdActive(true);
    } catch (e: any) {
      setFaceIdError(e?.message ?? "No se pudo acceder a la cámara frontal");
    }
  };

  const stopFaceId = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setFaceIdActive(false);
  };

  useEffect(() => () => stopFaceId(), []);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Sensores"
        title="Prueba de sensores"
        desc="Verifica el giroscopio, acelerómetro y la cámara frontal (usada como Face ID)."
      />

      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Face ID · Cámara frontal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El navegador no accede al módulo TrueDepth directamente. Usamos la cámara frontal para
          verificar que el sensor de imagen funciona.
        </p>
        <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        </div>
        <div className="mt-4 flex gap-2">
          {!faceIdActive ? (
            <button
              onClick={startFaceId}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Activar cámara frontal
            </button>
          ) : (
            <button
              onClick={stopFaceId}
              className="rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Detener
            </button>
          )}
        </div>
        {faceIdError && <p className="mt-3 text-sm text-destructive">{faceIdError}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Movimiento y orientación</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          En iOS necesitas dar permiso explícito. Mueve el iPhone para ver los valores.
        </p>
        {permState === "idle" && (
          <button
            onClick={requestMotion}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Solicitar permiso
          </button>
        )}
        {permState === "denied" && <p className="mt-4 text-sm text-destructive">Permiso denegado</p>}
        {permState === "unsupported" && (
          <p className="mt-4 text-sm text-muted-foreground">No soportado en este navegador</p>
        )}
        {permState === "granted" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SensorCard title="Acelerómetro (m/s²)" data={motion} keys={["x", "y", "z"]} />
            <SensorCard title="Orientación (°)" data={orient} keys={["alpha", "beta", "gamma"]} />
          </div>
        )}
      </section>

      <BackHome />
    </div>
  );
}

function SensorCard({
  title,
  data,
  keys,
}: {
  title: string;
  data: Record<string, number> | null;
  keys: string[];
}) {
  return (
    <div className="rounded-xl bg-secondary/50 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-1 font-mono text-sm">
        {keys.map((k) => (
          <div key={k} className="flex justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span>{data ? data[k].toFixed(2) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
