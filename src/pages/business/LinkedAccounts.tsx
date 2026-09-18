import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, ApiError } from "../../lib/api";

type Identity = {
  id: number;
  provider: "GOOGLE";
  email: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
};

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 1042) return "You can't remove your only sign-in account.";
    if (e.code === 1044)
      return "That Google account already has its own TruckBox subscription or team. Contact support to merge them.";
  }
  return "Something went wrong. Please try again.";
}

/** Google accounts that can sign in to this TruckBox account. Link another / unlink. */
export function LinkedAccounts() {
  const [items, setItems] = useState<Identity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Identity[]>("/api/v1/account/identities")
      .then(setItems)
      .catch(() => setError("Failed to load sign-in accounts."));
  }, []);

  const link = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google?.accounts?.oauth2 || !clientId) {
      setError("Google sign-in is unavailable. Reload and try again.");
      return;
    }
    setError(null);
    setBusy(true);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      prompt: "select_account",
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          setBusy(false);
          return;
        }
        api
          .post<Identity[]>("/api/v1/account/identities/google", { googleToken: resp.access_token })
          .then(setItems)
          .catch((e) => setError(messageFor(e)))
          .finally(() => setBusy(false));
      },
      // Popup closed / blocked: GIS reports it here, not via callback.
      error_callback: () => setBusy(false),
    });
    client.requestAccessToken();
  };

  const unlink = (id: number) => {
    setError(null);
    api
      .del<Identity[]>(`/api/v1/account/identities/${id}`)
      .then(setItems)
      .catch((e) => setError(messageFor(e)));
  };

  const LABEL: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--muted)", marginBottom: 7,
  };
  const ROW: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.5rem 0.7rem", border: "1px solid var(--hairline)", fontSize: "0.88rem",
  };
  const onlyOne = (items?.length ?? 0) <= 1;

  return (
    <div>
      <label style={LABEL}>Sign-in accounts</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items === null && !error && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading…</div>}
        {items?.map((i) => (
          <div key={i.id} style={ROW}>
            <span>{i.email ?? "Google account"}</span>
            {!onlyOne && (
              <button
                type="button"
                className="tb-icon-btn"
                aria-label={`Remove ${i.email ?? "this account"}`}
                onClick={() => unlink(i.id)}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ed-btn"
        style={{ marginTop: 10 }}
        disabled={busy || items === null}
        onClick={link}
      >
        {busy ? "Linking…" : "+ Link another Google account"}
      </button>
      {error && (
        <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
