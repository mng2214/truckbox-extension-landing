/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import {
  getAuthProviders,
  microsoftAuthCode,
  microsoftFailure,
  MICROSOFT_REDIRECT_URI,
  type AuthProviders,
} from "../../lib/microsoft";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProviderLogo } from "../../components/ProviderLogo";

type Identity = {
  id: number;
  provider: "GOOGLE" | "MICROSOFT";
  email: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
};

const MERGE_CONFIRMATION_REQUIRED = 1060;

type PendingMerge =
  | { provider: "google"; sourceEmail: string; googleToken: string }
  | { provider: "microsoft"; sourceEmail: string };

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 1042) return "You can't remove your only sign-in account.";
    if (e.code === 1044 || e.code === 1059)
      return "That sign-in belongs to another TruckBox account with a plan, team or billing history. Contact support to merge them.";
    if (e.code === 1054) return "Microsoft sign-in failed. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

function mergeSource(e: unknown): string | null {
  if (e instanceof ApiError && e.code === MERGE_CONFIRMATION_REQUIRED) {
    const email = e.details?.sourceEmail;
    return typeof email === "string" ? email : "another TruckBox account";
  }
  return null;
}

export function LinkedAccounts() {
  const [items, setItems] = useState<Identity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [merge, setMerge] = useState<PendingMerge | null>(null);
  useEffect(() => {
    getAuthProviders().then(setProviders);
  }, []);

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
        const googleToken = resp.access_token;
        api
          .post<Identity[]>("/api/v1/account/identities/google", { googleToken })
          .then(setItems)
          .catch((e) => {
            const sourceEmail = mergeSource(e);
            if (sourceEmail) setMerge({ provider: "google", sourceEmail, googleToken });
            else setError(messageFor(e));
          })
          .finally(() => setBusy(false));
      },
      error_callback: () => setBusy(false),
    });
    client.requestAccessToken();
  };

  const linkMicrosoft = async () => {
    if (!providers?.microsoftClientId) return;
    setBusy(true);
    setError(null);
    try {
      const code = await microsoftAuthCode(providers.microsoftClientId);
      setItems(
        await api.post<Identity[]>("/api/v1/account/identities/microsoft", {
          code,
          redirectUri: MICROSOFT_REDIRECT_URI,
        }),
      );
    } catch (e) {
      const sourceEmail = mergeSource(e);
      if (sourceEmail) setMerge({ provider: "microsoft", sourceEmail });
      else setError(microsoftFailure(e) ?? messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmMerge = async () => {
    if (!merge) return;
    setBusy(true);
    setError(null);
    try {
      if (merge.provider === "google") {
        setItems(
          await api.post<Identity[]>("/api/v1/account/identities/google", {
            googleToken: merge.googleToken,
            confirmMerge: true,
            mergeSourceEmail: merge.sourceEmail,
          }),
        );
      } else {
        if (!providers?.microsoftClientId) {
          setMerge(null);
          return;
        }
        const code = await microsoftAuthCode(providers.microsoftClientId);
        setItems(
          await api.post<Identity[]>("/api/v1/account/identities/microsoft", {
            code,
            redirectUri: MICROSOFT_REDIRECT_URI,
            confirmMerge: true,
            mergeSourceEmail: merge.sourceEmail,
          }),
        );
      }
      setMerge(null);
    } catch (e) {
      const sourceEmail = mergeSource(e);
      if (sourceEmail && merge.provider === "microsoft") {
        setMerge({ provider: "microsoft", sourceEmail });
      } else {
        setMerge(null);
        setError(microsoftFailure(e) ?? messageFor(e));
      }
    } finally {
      setBusy(false);
    }
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <ProviderLogo provider={i.provider === "MICROSOFT" ? "MICROSOFT" : "GOOGLE"} />
              <span>{i.email ?? "Account"}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                {i.provider === "MICROSOFT" ? "Microsoft" : "Google"}
              </span>
            </span>
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
        style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8 }}
        disabled={busy || items === null}
        onClick={link}
      >
        <ProviderLogo provider="GOOGLE" size={14} />
        {busy ? "Linking…" : "Link another Google account"}
      </button>
      {providers?.microsoft && (
        <button
          type="button"
          className="ed-btn"
          style={{ marginTop: 10, marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 8 }}
          disabled={busy || items === null}
          onClick={linkMicrosoft}
        >
          <ProviderLogo provider="MICROSOFT" size={14} />
          Link Microsoft account
        </button>
      )}
      {error && (
        <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 8 }}>{error}</p>
      )}
      <ConfirmDialog
        open={merge !== null}
        title="Merge accounts?"
        message={
          <>
            Account <b>{merge?.sourceEmail}</b> will be closed and its login moved here — continue?
            {merge?.provider === "microsoft" && " You'll be asked to sign in to Microsoft once more."}
          </>
        }
        confirmLabel="Close it and move the login"
        cancelLabel="Cancel"
        destructive
        busy={busy}
        onConfirm={confirmMerge}
        onClose={() => setMerge(null)}
      />
    </div>
  );
}
