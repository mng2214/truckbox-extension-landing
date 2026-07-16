import { useRef, useState } from "react";
import { sendGoogleConsent } from "./AgentApi";

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * One-time gmail.send consent via the GIS popup code flow. The agent sends emails FROM the
 * user's own Gmail, so this is the "connect Google" moment; the backend stores the refresh
 * token encrypted and resumes any PAUSED_AUTH campaigns.
 */
export function ConsentCard({ connected, onConnected }: { connected: boolean; onConnected: () => void }) {
  const clientRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = () => {
    setError(null);
    const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google?.accounts?.oauth2 || !id) {
      setError("Google is unavailable. Reload the page and try again.");
      return;
    }
    if (!clientRef.current) {
      clientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: id,
        scope: "https://www.googleapis.com/auth/gmail.send",
        ux_mode: "popup",
        access_type: "offline",
        prompt: "consent",
        callback: async (resp: { code?: string; error?: string }) => {
          if (resp.error || !resp.code) {
            setBusy(false);
            setError("Google connection was cancelled.");
            return;
          }
          try {
            await sendGoogleConsent(resp.code);
            onConnected();
          } catch {
            setError("Connection failed. Make sure you grant the email permission.");
          } finally {
            setBusy(false);
          }
        },
      });
    }
    setBusy(true);
    clientRef.current.requestCode();
  };

  if (connected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "var(--muted)",
          fontSize: "0.85rem",
        }}
      >
        <span style={{ color: "#4caf82" }}>●</span> Gmail connected — the Agent sends from your
        address
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--hairline, rgba(255,255,255,0.08))",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ fontWeight: 600 }}>Connect Gmail to launch</div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
        We can only send; we never read your mailbox.
      </p>
      <div>
        <button className="ed-btn ed-btn-accent" onClick={connect} disabled={busy}>
          {busy ? "Connecting…" : "Connect Google"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
    </div>
  );
}
