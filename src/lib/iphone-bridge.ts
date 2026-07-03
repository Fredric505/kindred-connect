// Tipos del puente Electron ↔ React.
export type BridgeResult<T = unknown> =
  | { ok: true; data?: T; raw?: string; stdout?: string; stderr?: string; entries?: HistoryEntry[] }
  | { ok: false; error?: string; stderr?: string; stdout?: string };

export type DetectResult =
  | { ok: true; devices: string[] }
  | { ok: false; error?: string; devices: string[] };

export type BridgeInfo = {
  platform: string;
  arch: string;
  binDir: string | null;
  appVersion: string;
  userData: string;
};

export type HistoryEntry = {
  t: number;
  batteryLevel?: number;
  batteryHealth?: number;
  cycles?: number;
  storageUsedPct?: number;
};

export type SyslogPayload = { udid?: string; line: string; err?: boolean };

export type IPhoneBridge = {
  isElectron: true;
  bridgeInfo: () => Promise<BridgeInfo>;
  detect: () => Promise<DetectResult>;
  info: (opts?: { udid?: string; domain?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  battery: (opts?: { udid?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  storage: (opts?: { udid?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  diagnostics: (opts?: { udid?: string }) => Promise<BridgeResult<Record<string, unknown>>>;
  pair: (opts?: { udid?: string }) => Promise<{ ok: boolean; needsTrust?: boolean; message?: string; error?: string }>;
  pairStatus: (opts?: { udid?: string }) => Promise<{ ok: boolean; message?: string }>;
  historyAppend: (opts: { udid: string; snapshot: Omit<HistoryEntry, "t"> }) => Promise<{ ok: true }>;
  historyRead: (opts: { udid: string }) => Promise<BridgeResult<never>>;
  syslogStart: (opts?: { udid?: string }) => Promise<{ ok: true }>;
  syslogStop: (opts?: { udid?: string }) => Promise<{ ok: true }>;
  onSyslog: (fn: (p: SyslogPayload) => void) => () => void;
  crashReports: (opts?: { udid?: string }) => Promise<{ ok: boolean; error?: string; warning?: string; dir?: string; panics?: CrashReport[]; crashes?: CrashReport[] }>;
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
