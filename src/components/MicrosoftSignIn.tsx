import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { auth } from "../lib/auth";
import {
  getAuthProviders,
  microsoftAuthCode,
  MICROSOFT_REDIRECT_URI,
  type AuthProviders,
} from "../lib/microsoft";
import { ProviderLogo } from "./ProviderLogo";
import { isNoAccount } from "../lib/authErrors";

export function MicrosoftSignIn({
  onSignedIn,
  onNoAccount,
  signup = false,
}: {
  onSignedIn: () => void;
  onNoAccount?: () => void;
  signup?: boolean;
}) {
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuthProviders().then(setProviders);
  }, []);

  if (!providers?.microsoft || !providers.microsoftClientId) return null;
  const clientId = providers.microsoftClientId;

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await microsoftAuthCode(clientId);
      const res = await api.post<{ token: string }>("/api/v1/auth/microsoft", {
        code,
        redirectUri: MICROSOFT_REDIRECT_URI,
        ...(signup ? { signup: true } : {}),
      });
      auth.setToken(res.token);
      onSignedIn();
    } catch (e) {
      if (isNoAccount(e) && onNoAccount) {
        onNoAccount();
      } else if (e instanceof ApiError && e.code === 1055) {
        setError("This email already has a TruckBox account. Sign in with Google, then link Microsoft in Accounts.");
      } else if (!(e instanceof Error && e.message === "cancelled")) {
        setError("Microsoft sign-in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2" style={{ marginTop: 10 }}>
      <button
        className="ed-btn"
        onClick={signIn}
        disabled={busy}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, minWidth: 250 }}
      >
        <ProviderLogo provider="MICROSOFT" size={14} />
        {busy ? "Signing in…" : "Sign in with Microsoft"}
      </button>
      {error && <p style={{ color: "var(--danger, #c0392b)", fontSize: "0.875rem" }}>{error}</p>}
    </div>
  );
}
