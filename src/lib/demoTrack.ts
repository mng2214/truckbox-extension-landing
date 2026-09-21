import { API_BASE } from "./api";
const DEVICE_KEY = "tb-device-id";
const SESSION_KEY = "tb-demo-session";

export type DemoEventName =
  | "open"
  | "signin"
  | "template"
  | "email"
  | "save"
  | "credit"
  | "load_open"
  | "tab"
  | "map"
  | "phone"
  | "tour_step"
  | "tour_done";

const sentThisLoad = new Set<string>();

const nativeFetch =
  typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : fetch;

let enabled = false;

export function enableDemoTracking(on: boolean): void {
  enabled = on;
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return String(Date.now()) + Math.random().toString(16).slice(2);
  }
}

function stored(key: string, store: Storage): string | null {
  try {
    let id = store.getItem(key);
    if (!id) {
      id = uuid();
      store.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

const SOURCE_KEY = "tb-source";

const SOURCE_PARAMS = ["from", "ref", "src", "source", "utm_source"];

type Source = { source: string; medium: string | null; campaign: string | null; at: string };

function read(key: string): Source | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Source) : null;
  } catch {
    return null;
  }
}

/**
 * Remembers where a visitor came from the first time they arrive anywhere on the site, so the demo
 * can still name the source after they have clicked around and the parameter is long gone from the
 * address bar. First touch wins: a later visit does not overwrite it.
 */
export function captureSource(): void {
  try {
    const q = new URLSearchParams(location.search);
    const key = SOURCE_PARAMS.find((name) => (q.get(name) || "").trim());
    if (!key) return;
    if (read(SOURCE_KEY)) return;

    const value: Source = {
      source: (q.get(key) || "").trim().slice(0, 120),
      medium: (q.get("utm_medium") || "").trim().slice(0, 120) || null,
      campaign: (q.get("utm_campaign") || "").trim().slice(0, 120) || null,
      at: new Date().toISOString(),
    };
    localStorage.setItem(SOURCE_KEY, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

function params() {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
}

function payload(event: DemoEventName, detail?: string) {
  const q = params();
  const first = read(SOURCE_KEY);
  const direct = SOURCE_PARAMS.map((name) => q.get(name)).find((v) => (v || "").trim());

  return {
    event,
    detail: detail ? detail.slice(0, 160) : null,
    deviceId: stored(DEVICE_KEY, localStorage),
    sessionId: stored(SESSION_KEY, sessionStorage),
    path: location.pathname + location.search.slice(0, 80),
    referrer: document.referrer || null,
    utmSource: (direct || first?.source || null)?.slice(0, 120) ?? null,
    utmMedium: q.get("utm_medium") || first?.medium || null,
    utmCampaign: q.get("utm_campaign") || first?.campaign || null,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    touch: navigator.maxTouchPoints > 0,
  };
}

export function trackDemo(event: DemoEventName, detail?: string): void {
  if (!enabled) return;

  const key = event + "|" + (detail ?? "");
  if (sentThisLoad.has(key)) return;
  sentThisLoad.add(key);

  try {
    const body = JSON.stringify(payload(event, detail));
    const url = API_BASE + "/api/v1/public/demo/visit";

    void nativeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the demo */
  }
}
