import { api } from "./api";

export type AuthProviders = { microsoft: boolean; microsoftClientId: string | null };

let providersPromise: Promise<AuthProviders> | null = null;

export function getAuthProviders(): Promise<AuthProviders> {
  providersPromise ??= api
    .get<AuthProviders>("/api/v1/auth/providers")
    .catch(() => ({ microsoft: false, microsoftClientId: null }));
  return providersPromise;
}

export const MICROSOFT_REDIRECT_URI = `${window.location.origin}/business/oauth/microsoft`;
export const MICROSOFT_RESULT_KEY = "tb-ms-oauth-result";
const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const SCOPES = "openid profile email offline_access User.Read Mail.Send";

type Result = { code: string | null; state: string | null; error: string | null };

function takeResult(): Result | null {
  try {
    const raw = localStorage.getItem(MICROSOFT_RESULT_KEY);
    if (!raw) return null;
    localStorage.removeItem(MICROSOFT_RESULT_KEY);
    return JSON.parse(raw) as Result;
  } catch {
    return null;
  }
}

export function microsoftAuthCode(clientId: string): Promise<string> {
  const state = crypto.randomUUID();
  takeResult();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    prompt: "select_account",
    state,
  });
  const popup = window.open(`${AUTHORIZE_URL}?${params}`, "tb-ms-oauth", "width=520,height=680");
  if (!popup) return Promise.reject(new Error("popup_blocked"));

  return new Promise((resolve, reject) => {
    const finish = (r: Result | null) => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      if (!r) return reject(new Error("cancelled"));
      if (r.state !== state || !r.code) return reject(new Error(r.error || "failed"));
      resolve(r.code);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === MICROSOFT_RESULT_KEY && e.newValue) finish(takeResult());
    };
    const timer = window.setInterval(() => {
      if (popup.closed) finish(takeResult());
    }, 500);
    window.addEventListener("storage", onStorage);
  });
}
