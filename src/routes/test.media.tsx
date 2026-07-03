import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader, BackHome } from "./test.display";

export const Route = createFileRoute("/test/media")({
  head: () => ({
    meta: [
      { title: "Prueba de audio, cámara y conectividad — iPhone Diagnostics" },
      { name: "description", content: "Prueba micrófono, altavoces, cámaras, vibración, WiFi y Bluetooth de tu iPhone." },
    ],
  }),
  component: MediaTest,
});

function MediaTest() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="Audio, cámara y conectividad"
        title="Audio, cámara y conectividad"
        desc="Verifica altavoces, micrófono, cámaras frontal/trasera, vibración y conexiones inalámbricas."
      />

      <div className="mt-10 space-y-4">
        <SpeakerCard />
        <MicCard />
        <CameraCard />
        <VibrationCard />
        <ConnectivityCard />
      </div>

      <BackHome />
    </main>
  );
}

function SpeakerCard() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  const play = (freq: number, channel: "left" | "right" | "both") => {
    stop();
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    osc.frequency.value = freq;
    const panner = ctx.createStereoPanner();
    panner.pan.value = channel === "left" ? -1 : channel === "right" ? 1 : 0;
    osc.connect(gain).connect(panner).connect(ctx.destination);
    osc.start();
    ctxRef.current = ctx;
    oscRef.current = osc;
    setPlaying(true);
  };

  const stop = () => {
    oscRef.current?.stop();
    ctxRef.current?.close();
    oscRef.current = null;
    ctxRef.current = null;
    setPlaying(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <Card title="Altavoces" desc="Reproduce tonos de prueba en cada canal para verificar los altavoces estéreo.">
      <div className="flex flex-wrap gap-2">
        <TestBtn onClick={() => play(440, "left")}>Izquierdo</TestBtn>
        <TestBtn onClick={() => play(440, "right")}>Derecho</TestBtn>
        <TestBtn onClick={() => play(440, "both")}>Ambos</TestBtn>
        {playing && (
          <button
            onClick={stop}
            className="rounded-full border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Detener
          </button>
        )}
      </div>
    </Card>
  );
}

function MicCard() {
  const [level, setLevel] = useState(0);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rafRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(avg / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setActive(true);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo acceder al micrófono");
    }
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close();
    setActive(false);
    setLevel(0);
  };

  useEffect(() => () => stop(), []);

  return (
    <Card title="Micrófono" desc="Habla o haz ruido — la barra debe reaccionar en tiempo real.">
      <div className="flex items-center gap-4">
        {!active ? (
          <TestBtn onClick={start}>Activar micrófono</TestBtn>
        ) : (
          <button onClick={stop} className="rounded-full border border-input bg-background px-4 py-2 text-sm hover:bg-accent">
            Detener
          </button>
        )}
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${level * 100}%` }} />
        </div>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </Card>
  );
}

function CameraCard() {
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [active, setActive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async (mode: "user" | "environment") => {
    stop();
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFacing(mode);
      setActive(true);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo acceder a la cámara");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <Card title="Cámaras" desc="Verifica cámara frontal y trasera.">
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TestBtn onClick={() => start("environment")}>Trasera</TestBtn>
        <TestBtn onClick={() => start("user")}>Frontal</TestBtn>
        {active && (
          <button onClick={stop} className="rounded-full border border-input bg-background px-4 py-2 text-sm hover:bg-accent">
            Detener
          </button>
        )}
        {active && <span className="self-center text-xs text-muted-foreground">Activa: {facing === "user" ? "Frontal" : "Trasera"}</span>}
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </Card>
  );
}

function VibrationCard() {
  const supported = typeof navigator !== "undefined" && "vibrate" in navigator;
  return (
    <Card title="Vibración (Taptic Engine)" desc="Nota: Safari en iOS no soporta la Vibration API. Funciona en Android y algunos navegadores.">
      <div className="flex flex-wrap gap-2">
        <TestBtn onClick={() => navigator.vibrate?.(200)} disabled={!supported}>
          Corta (200ms)
        </TestBtn>
        <TestBtn onClick={() => navigator.vibrate?.([100, 50, 100, 50, 100])} disabled={!supported}>
          Patrón
        </TestBtn>
        <TestBtn onClick={() => navigator.vibrate?.(1000)} disabled={!supported}>
          Larga (1s)
        </TestBtn>
      </div>
      {!supported && <p className="mt-2 text-sm text-muted-foreground">Vibration API no disponible en este dispositivo.</p>}
    </Card>
  );
}

function ConnectivityCard() {
  const [bt, setBt] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const scanBluetooth = async () => {
    const nav: any = navigator;
    if (!nav.bluetooth) {
      setBt("Bluetooth Web API no disponible (Safari iOS no la soporta).");
      return;
    }
    try {
      const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true });
      setBt(`Detectado: ${device.name ?? device.id}`);
    } catch (e: any) {
      setBt(e?.message ?? "Cancelado");
    }
  };

  return (
    <Card title="Conectividad" desc="Estado de red y detección de dispositivos Bluetooth cercanos.">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
          WiFi / Datos: {online ? "Conectado" : "Sin conexión"}
        </span>
        <TestBtn onClick={scanBluetooth}>Buscar Bluetooth</TestBtn>
      </div>
      {bt && <p className="mt-3 text-sm text-muted-foreground">{bt}</p>}
    </Card>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TestBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
