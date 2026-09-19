import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";

type EmailState = {
  /** Null when the account has no usable address (emailMissing). */
  email: string | null;
  pendingEmail: string | null;
  emailVerified: boolean;
  /** Its unconfirmed address was claimed by a verified account; a real one must be confirmed. */
  emailMissing: boolean;
};

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 1045) return "Enter a valid new email address.";
    if (e.code === 1046) return "This email is already used by another TruckBox account.";
    if (e.code === 1047) return "Wrong code. Check the email and try again.";
    if (e.code === 1048) return "The code expired. Request a new one.";
    if (e.code === 1058) return "Too many codes requested. Try again in an hour.";
  }
  return "Something went wrong. Please try again.";
}

/** Contact email (billing + notifications). Changing it needs a code sent to the new address. */
export function ContactEmail() {
  const [state, setState] = useState<EmailState | null>(null);
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .get<EmailState>("/api/v1/account/email")
      .then(setState)
      .catch(() => setError("Failed to load your email."));
  }, []);

  const run = (p: Promise<EmailState>, after?: (s: EmailState) => void) => {
    setBusy(true);
    setError(null);
    p.then((s) => {
      setState(s);
      after?.(s);
    })
      .catch((e) => setError(messageFor(e)))
      .finally(() => setBusy(false));
  };

  const sendCode = () =>
    run(api.post<EmailState>("/api/v1/account/email/change", { email: newEmail }), () => setCode(""));

  const verifyCurrent = () => {
    if (!state?.email) return;
    setEditing(true);
    setDone(false);
    run(api.post<EmailState>("/api/v1/account/email/change", { email: state.email }), () => setCode(""));
  };

  const confirm = () =>
    run(api.post<EmailState>("/api/v1/account/email/confirm", { code }), (s) => {
      if (!s.pendingEmail) {
        setEditing(false);
        setNewEmail("");
        setDone(true);
      }
    });

  const LABEL: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--muted)", marginBottom: 7,
  };
  const FIELD: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.7rem", fontSize: "0.9rem",
    color: "var(--ink)", background: "transparent",
    border: "1px solid var(--hairline)", outline: "none",
  };
  const awaitingCode = editing && !!state?.pendingEmail;
  const missing = !!state?.emailMissing;

  return (
    <div>
      <label style={LABEL}>Contact email</label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.9rem", color: missing ? "var(--danger)" : undefined }}>
          {missing ? "Confirm your email" : (state?.email ?? "…")}
        </span>
        {!editing && state && (
          <button type="button" className="ed-btn" onClick={() => { setEditing(true); setDone(false); }}>
            {missing ? "Add email" : "Change"}
          </button>
        )}
      </div>
      {missing && !editing && (
        <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 6 }}>
          Your previous email was confirmed by another TruckBox account, so it was removed from this
          one. Your sign-in still works — add and confirm an email you own to get receipts and team
          invites.
        </p>
      )}
      {state && !missing && !state.emailVerified && !editing && (
        <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 6 }}>
          Not confirmed — team invites won't apply until you confirm it.{" "}
          <button type="button" className="ed-btn" onClick={verifyCurrent} disabled={busy}>
            Confirm email
          </button>
        </p>
      )}
      <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 6 }}>
        Receipts and TruckBox notifications go here. Sign-in accounts don't change.
      </p>

      {editing && !awaitingCode && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={newEmail}
            maxLength={254}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@company.com"
            type="email"
            style={FIELD}
          />
          <button type="button" className="ed-btn" disabled={busy || !newEmail} onClick={sendCode}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </div>
      )}

      {awaitingCode && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: "0.82rem", marginBottom: 6 }}>
            We sent a 6-digit code to <b>{state?.pendingEmail}</b>.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              style={FIELD}
            />
            <button type="button" className="ed-btn" disabled={busy || code.length !== 6} onClick={confirm}>
              {busy ? "Checking…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {done && <p style={{ color: "var(--ink)", fontSize: "0.8rem", marginTop: 8 }}>Email updated ✓</p>}
      {error && <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
