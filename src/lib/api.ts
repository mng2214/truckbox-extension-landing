import { auth } from "./auth";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://api.truckbox.app";

export class ApiError extends Error {
  constructor(public status: number, public code?: number, msg?: string) {
    super(msg ?? `HTTP ${status}`);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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
  if (!res.ok) throw new ApiError(res.status, json?.code, json?.message);
  return json as T;
}

export const api = {
  get: <T>(p: string) => req<T>("GET", p),
  post: <T>(p: string, b?: unknown) => req<T>("POST", p, b),
  patch: <T>(p: string, b?: unknown) => req<T>("PATCH", p, b),
  del: <T>(p: string) => req<T>("DELETE", p),
};
