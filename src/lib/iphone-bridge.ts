// Tipos del puente Electron ↔ React inyectado por electron/preload.cjs.
export type BridgeResult<T = unknown> =
  | { ok: true; data?: T; raw?: string; stdout?: string; stderr?: string }
  | { ok: false; error?: string; stderr?: string; stdout?: string };

export type DetectResult =
  | { ok: true; devices: string[] }
  | { ok: false; error?: string; devices: string[] };

export type BridgeInfo = {
  platform: string;
  arch: string;
  binDir: string | null;
  appVersion: string;
};

export type IPhoneBridge = {
  isElectron: true;
  bridgeInfo: () => Promise<BridgeInfo>;
  detect: () => Promise<DetectResult>;
  info: (opts?: { udid?: string; domain?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  battery: (opts?: { udid?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  storage: (opts?: { udid?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  diagnostics: (opts?: { udid?: string }) => Promise<BridgeResult>;
  openExternal: (url: string) => Promise<void>;
};

declare global {
  interface Window {
    iphoneBridge?: IPhoneBridge;
  }
}

export function getBridge(): IPhoneBridge | null {
  if (typeof window === "undefined") return null;
  return window.iphoneBridge ?? null;
}
