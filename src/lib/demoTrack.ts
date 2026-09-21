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

function params() {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
}

function payload(event: DemoEventName, detail?: string) {
  const q = params();
  return {
    event,
    detail: detail ? detail.slice(0, 160) : null,
    deviceId: stored(DEVICE_KEY, localStorage),
    sessionId: stored(SESSION_KEY, sessionStorage),
    path: location.pathname + location.search.slice(0, 80),
    referrer: document.referrer || null,
    utmSource: q.get("utm_source"),
    utmMedium: q.get("utm_medium"),
    utmCampaign: q.get("utm_campaign"),
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

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the demo */
  }
}
