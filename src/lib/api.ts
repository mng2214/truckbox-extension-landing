import { auth } from "./auth";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://api.truckbox.app";

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for non-secure contexts (crypto.randomUUID needs HTTPS/localhost).
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
      const n = Number(c);
      return (n ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))).toString(16);
    });
  }
}

// Persistent device id (localStorage) + per-session id (sessionStorage), sent on every request
// as X-Device-Id / X-Session-Id — the same contract the extension uses, so the backend's
// RequestLoggingFilter + device logic light up for the web with no backend change.
function getDeviceId(): string {
  try {
    let id = localStorage.getItem("tb-device-id");
    if (!id) {
      id = uuid();
      localStorage.setItem("tb-device-id", id);
    }
    return id;
  } catch {
    return "web-unknown";
  }
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("tb-session-id");
    if (!id) {
      id = uuid();
      sessionStorage.setItem("tb-session-id", id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code?: number, msg?: string) {
    super(msg ?? `HTTP ${status}`);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": getDeviceId(),
    "X-Session-Id": getSessionId(),
  };
  const token = auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (res.status === 401) {
    auth.clearToken();
    window.location.href = "/business";
    throw new ApiError(401, json?.code, json?.message);
  }
  if (!res.ok) throw new ApiError(res.status, json?.code, json?.message);
  return json as T;
}

export const api = {
  get: <T>(p: string) => req<T>("GET", p),
  post: <T>(p: string, b?: unknown) => req<T>("POST", p, b),
  put: <T>(p: string, b?: unknown) => req<T>("PUT", p, b),
  patch: <T>(p: string, b?: unknown) => req<T>("PATCH", p, b),
  del: <T>(p: string) => req<T>("DELETE", p),
};
