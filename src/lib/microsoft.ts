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

type Result = { code: string | null; state: string | null; error: string | null; at?: number };

export type MicrosoftAuthReason = "cancelled" | "denied" | "popup_blocked" | "failed";

export class MicrosoftAuthError extends Error {
  constructor(
    public reason: MicrosoftAuthReason,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "MicrosoftAuthError";
  }
}

const RESULT_TTL_MS = 120_000;

function takeResult(): Result | null {
  try {
    const raw = localStorage.getItem(MICROSOFT_RESULT_KEY);
    if (!raw) return null;
    localStorage.removeItem(MICROSOFT_RESULT_KEY);
    const result = JSON.parse(raw) as Result;
    if (result.at && Date.now() - result.at > RESULT_TTL_MS) return null;
    return result;
  } catch {
    return null;
  }
}

export function clearStaleMicrosoftResult(): void {
  try {
    const raw = localStorage.getItem(MICROSOFT_RESULT_KEY);
    if (!raw) return;
    const { at } = JSON.parse(raw) as Result;
    if (!at || Date.now() - at > RESULT_TTL_MS) localStorage.removeItem(MICROSOFT_RESULT_KEY);
  } catch {
    try {
      localStorage.removeItem(MICROSOFT_RESULT_KEY);
    } catch {
      /* storage blocked */
    }
  }
}

export function microsoftFailure(e: unknown): string | null {
  if (!(e instanceof MicrosoftAuthError)) return null;
  if (e.reason === "popup_blocked") {
    return "The Microsoft window was blocked by the browser. Allow pop-ups for truckbox.app and try again.";
  }
  if (e.reason === "denied") {
    return `Microsoft refused the request: ${e.message}`;
  }
  if (e.reason === "cancelled") {
    return "The Microsoft window closed before it came back, so nothing was connected. If it showed \u201cNeed admin approval\u201d, your Microsoft administrator has to approve TruckBox first.";
  }
  return "Microsoft sent back an answer we could not read. Try again.";
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
  if (!popup) return Promise.reject(new MicrosoftAuthError("popup_blocked"));

  return new Promise((resolve, reject) => {
    const finish = (r: Result | null) => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      if (!r) return reject(new MicrosoftAuthError("cancelled"));
      if (r.error) return reject(new MicrosoftAuthError("denied", r.error));
      if (r.state !== state || !r.code) return reject(new MicrosoftAuthError("failed"));
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
