import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { getAuthProviders, microsoftAuthCode, MICROSOFT_REDIRECT_URI, type AuthProviders } from "../../lib/microsoft";
import { ProviderLogo } from "../../components/ProviderLogo";

type Mailbox = {
  id: number;
  provider: "GOOGLE" | "MICROSOFT";
  address: string;
  status: "ACTIVE" | "DISCONNECTED";
  createdAt: string | null;
  lastUsedAt: string | null;
  loginMailbox: boolean;
};
type Mailboxes = { maxMailboxes: number; mailboxes: Mailbox[] };

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 1050) return "You've reached your mailbox limit. Remove one to add another.";
    if (e.code === 1052) return "Couldn't connect this Gmail. Try again and make sure to allow sending email.";
    if (e.code === 1064) return e.message || "This mailbox is used by a template. Pick another sender for it first.";
  }
  return "Something went wrong. Please try again.";
}

export function MailboxesPanel() {
  const [data, setData] = useState<Mailboxes | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<{ requestCode: () => void } | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => {
    getAuthProviders().then(setProviders);
  }, []);

  const load = useCallback(() => {
    api.get<Mailboxes>("/api/v1/mailboxes").then(setData).catch(() => setError("Failed to load mailboxes."));
  }, []);
  useEffect(load, [load]);

  const addGmail = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google?.accounts?.oauth2 || !clientId) {
      setError("Google is unavailable. Reload the page and try again.");
      return;
    }
    setError(null);
    if (!clientRef.current) {
      clientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: "openid email https://www.googleapis.com/auth/gmail.send",
        ux_mode: "popup",
        access_type: "offline",
        prompt: "consent select_account",
        callback: (resp: { code?: string; error?: string }) => {
          if (resp.error || !resp.code) {
            setBusy(false);
            return;
          }
          api
            .post<Mailboxes>("/api/v1/mailboxes/google", { code: resp.code, redirectUri: "postmessage" })
            .then(setData)
            .catch((e) => setError(messageFor(e)))
            .finally(() => setBusy(false));
        },
        error_callback: () => setBusy(false),
      });
    }
    setBusy(true);
    clientRef.current?.requestCode();
  };

  const addOutlook = async () => {
    if (!providers?.microsoftClientId) return;
    setBusy(true);
    setError(null);
    try {
      const code = await microsoftAuthCode(providers.microsoftClientId);
      setData(
        await api.post<Mailboxes>("/api/v1/mailboxes/microsoft", { code, redirectUri: MICROSOFT_REDIRECT_URI }),
      );
    } catch (e) {
      if (!(e instanceof Error && e.message === "cancelled")) setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: number) => {
    setError(null);
    api
      .del<Mailboxes>(`/api/v1/mailboxes/${id}`)
      .then(setData)
      .catch((e) => setError(messageFor(e)));
  };

  const extra = data ? data.mailboxes.filter((m) => !m.loginMailbox).length : 0;
  const full = !!data && extra >= data.maxMailboxes;
  const ROW: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "0.75rem 0.9rem", borderBottom: "1px solid var(--hairline)",
  };

  return (
    <section style={{ maxWidth: 720 }}>
      <h1 className="ed-display">Mailboxes</h1>
      <p style={{ color: "var(--muted)", marginTop: 8 }}>
        Connect extra mailboxes, then pick the sender of each template in the extension popup (Template →
        Send from). Your sign-in mailbox is always available and isn't counted.
      </p>

      <div style={{ marginTop: 20, border: "1px solid var(--hairline)" }}>
        {data === null && !error && <div style={ROW}>Loading…</div>}
        {data?.mailboxes.length === 0 && (
          <div style={{ ...ROW, color: "var(--muted)" }}>No extra mailboxes yet.</div>
        )}
        {data?.mailboxes.map((m) => (
          <div key={m.id} style={ROW}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ProviderLogo provider={m.provider === "MICROSOFT" ? "MICROSOFT" : "GOOGLE"} size={18} />
              <div>
                <div style={{ fontWeight: 600 }}>{m.address}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  {m.provider === "MICROSOFT" ? "Outlook" : "Gmail"}
                  {m.loginMailbox ? " · sign-in mailbox" : ""} ·{" "}
                  {m.status === "ACTIVE" ? (
                    "Connected"
                  ) : (
                    <span style={{ color: "var(--danger)" }}>Disconnected — reconnect to keep sending</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {m.status === "DISCONNECTED" && (
                <button
                  type="button"
                  className="ed-btn ed-btn-accent"
                  disabled={busy}
                  onClick={m.provider === "MICROSOFT" ? addOutlook : addGmail}
                >
                  Reconnect
                </button>
              )}
              {!m.loginMailbox && (
                <button type="button" className="ed-btn" onClick={() => remove(m.id)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="ed-btn ed-btn-accent"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          disabled={busy || full || data === null}
          onClick={addGmail}
        >
          <ProviderLogo provider="GOOGLE" size={12} chip />
          {busy ? "Connecting…" : "Add Gmail"}
        </button>
        {providers?.microsoft && (
          <button
            type="button"
            className="ed-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            disabled={busy || full || data === null}
            onClick={addOutlook}
          >
            <ProviderLogo provider="MICROSOFT" size={14} />
            Add Outlook
          </button>
        )}
        {data && (
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {extra} of {data.maxMailboxes} used
          </span>
        )}
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: 10 }}>{error}</p>}
    </section>
  );
}
