import { useRef, useState } from "react";
import { exchangeGoogleAccessToken, type GoogleAuthResult } from "../lib/google";

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleSignIn({ onSignedIn }: { onSignedIn: (res: GoogleAuthResult) => void }) {
  const clientRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ensureClient = () => {
    const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!window.google?.accounts?.oauth2 || !id) return null;
    if (!clientRef.current) {
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: "openid email profile",
        callback: async (resp: { access_token?: string; error?: string }) => {
          if (resp.error || !resp.access_token) {
            setBusy(false);
            setError("Sign-in was cancelled or failed. Please try again.");
            return;
          }
          try {
            const res = await exchangeGoogleAccessToken(resp.access_token);
            onSignedIn(res);
          } catch (err) {
            console.error("Google sign-in exchange failed:", err);
            setError("Sign-in failed. Please try again.");
          } finally {
            setBusy(false);
          }
        },
      });
    }
    return clientRef.current;
  };

  const signIn = () => {
    setError(null);
    const client = ensureClient();
    if (!client) {
      setError("Google sign-in is unavailable. Check configuration and reload.");
      return;
    }
    setBusy(true);
    client.requestAccessToken();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button className="ed-btn ed-btn-accent" onClick={signIn} disabled={busy}>
        {busy ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && (
        <p style={{ color: "var(--danger, #c0392b)", fontSize: "0.875rem" }}>{error}</p>
      )}
    </div>
  );
}
