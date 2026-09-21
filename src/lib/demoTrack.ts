const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://api.truckbox.app";
const DEVICE_KEY = "tb-device-id";
const SESSION_KEY = "tb-demo-session";

export type DemoEventName =
  | "open"
  | "signin"
  | "template"
  | "email"
  | "save"
  | "credit"
  | "tour_done";

const sentThisLoad = new Set<DemoEventName>();

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

function payload(event: DemoEventName) {
  const q = params();
  return {
    event,
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

export function trackDemo(event: DemoEventName, once = true): void {
  if (!enabled) return;
  if (once && sentThisLoad.has(event)) return;
  sentThisLoad.add(event);

  try {
    const body = JSON.stringify(payload(event));
    const url = BASE + "/api/v1/public/demo/visit";

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
