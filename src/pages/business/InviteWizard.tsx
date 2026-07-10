import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { usePageMeta } from "../../lib/meta";
import { auth } from "../../lib/auth";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import type { GoogleAuthResult } from "../../lib/google";
import { PhoneVerify } from "./PhoneVerify";

type Step = "loading" | "invalid" | "google" | "wrong" | "phone" | "company" | "redirecting";

// Backend ErrorCode.PHONE_VERIFICATION_REQUIRED — a distinct 403 that means "verify your phone"
// (vs a generic 403/expired token, which means "log in again"). Same contract as the cabinet.
const PHONE_VERIFICATION_REQUIRED = 1023;

export default function InviteWizard() {
  usePageMeta({ title: "Team invite — TruckBox", description: "Activate your TruckBox seat.", path: "/business/invite", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [step, setStep] = useState<Step>("loading");
  const [company, setCompany] = useState({ companyName: "", mcNumber: "", seats: 1, billingEmail: "" });
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [authedEmail, setAuthedEmail] = useState("");
  const norm = (e: string) => e.trim().toLowerCase();
  const gateAfterAuth = async (invite: string) => {
    try {
      const ctx = await api.get<{ email: string }>("/api/v1/account/context");
      setAuthedEmail(ctx.email);
      setStep(norm(ctx.email) === norm(invite) ? "company" : "wrong");
    } catch (e) {
      // Verification-scoped token (phone not confirmed yet): show the phone step, keep the token —
      // it is exactly what the phone endpoints need. Anything else: session is unusable, re-login.
      if (e instanceof ApiError && e.status === 403 && e.code === PHONE_VERIFICATION_REQUIRED) {
        setStep("phone");
        return;
      }
      auth.clearToken();
      setStep("google");
    }
  };

  // Fresh Google sign-in: the auth response tells us both who signed in and whether the backend
  // still requires phone verification — no extra round-trip needed.
  const onSignedIn = (res: GoogleAuthResult) => {
    setAuthedEmail(res.email);
    if (norm(res.email) !== norm(inviteEmail)) {
      setStep("wrong");
      return;
    }
    setStep(res.phoneVerificationRequired ? "phone" : "company");
  };

  const signOut = () => {
    auth.clearToken();
    setAuthedEmail("");
    setStep("google");
  };

  const signOutLink =
    authedEmail !== "" ? (
      <button
        onClick={signOut}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          fontSize: "0.78rem",
          cursor: "pointer",
          marginTop: "0.5rem",
        }}
      >
        Signed in as {authedEmail} — Sign out
      </button>
    ) : null;

  useEffect(() => {
    if (!token) { setStep("invalid"); return; }
    api
      .get<{ email: string }>(`/api/v1/org/invites/${token}`)
      .then((r) => {
        setInviteEmail(r.email);
        if (auth.isAuthed()) gateAfterAuth(r.email);
        else setStep("google");
      })
      .catch(() => setStep("invalid"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitCompany = async () => {
    setError(null);
    setStep("redirecting");
    try {
      await api.post("/api/v1/org/onboard", {
        token,
        companyName: company.companyName,
        mcNumber: company.mcNumber,
        seats: Number(company.seats),
        billingEmail: company.billingEmail,
      });
      const { url } = await api.post<{ url: string }>("/api/v1/manager/team/checkout", { token });
      window.location.href = url;
    } catch (e) {
      setStep("company");
      setError(
        e instanceof ApiError && e.code === 1033
          ? "This invite is for a different email."
          : "Something went wrong. Please try again."
      );
    }
  };

  if (step === "loading") return <Center>Loading…</Center>;

  if (step === "invalid")
    return (
      <Center>
        <p style={{ color: "var(--ink)", fontSize: "1.1rem", textAlign: "center" }}>
          This invite link is invalid or has expired.
        </p>
      </Center>
    );

  if (step === "google")
    return (
      <Center>
        <h1 className="ed-display" style={{ fontSize: "2.5rem", color: "var(--ink)", marginBottom: "1.5rem" }}>
          Set up your team
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", textAlign: "center" }}>
          Sign in with Google to continue.
        </p>
        <GoogleSignIn onSignedIn={onSignedIn} />
      </Center>
    );

  if (step === "wrong")
    return (
      <Center>
        <h1 className="ed-display" style={{ fontSize: "2rem", color: "var(--ink)", marginBottom: "1rem", textAlign: "center" }}>
          Wrong account
        </h1>
        <p style={{ color: "var(--muted)", textAlign: "center", maxWidth: "22rem" }}>
          This invite is for <strong style={{ color: "var(--ink)" }}>{inviteEmail}</strong>, but you are
          signed in as <strong style={{ color: "var(--ink)" }}>{authedEmail}</strong>.
        </p>
        <button
          className="ed-btn ed-btn-accent"
          onClick={() => { auth.clearToken(); setStep("google"); }}
          style={{ marginTop: "1rem" }}
        >
          Sign in as {inviteEmail}
        </button>
      </Center>
    );

  if (step === "phone")
    // After confirm, PhoneVerify has swapped the verification-scoped token for a full one —
    // re-gate to run the invite-email match (unknown when the phone step was reached with a
    // stored verification token, where /account/context is not accessible yet).
    return (
      <PhoneVerify
        onVerified={() => {
          setStep("loading");
          gateAfterAuth(inviteEmail);
        }}
        onSignOut={signOut}
      />
    );

  if (step === "redirecting")
    return (
      <Center>
        <p style={{ color: "var(--muted)", fontSize: "1rem" }}>Redirecting to payment…</p>
      </Center>
    );

  // step === "company"
  return (
    <Center>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "20rem", width: "100%" }}>
        <h1 className="ed-display" style={{ fontSize: "2.5rem", color: "var(--ink)" }}>
          Company details
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label
            htmlFor="iw-company"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Company name
          </label>
          <input
            id="iw-company"
            className="ed-input"
            type="text"
            placeholder="Acme Freight LLC"
            value={company.companyName}
            onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label
            htmlFor="iw-mc"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            MC number
          </label>
          <input
            id="iw-mc"
            className="ed-input"
            type="text"
            placeholder="123456"
            value={company.mcNumber}
            onChange={(e) => setCompany({ ...company, mcNumber: e.target.value })}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label
            htmlFor="iw-seats"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Seats (Users)
          </label>
          <input
            id="iw-seats"
            className="ed-input"
            type="number"
            min={1}
            placeholder="1"
            value={company.seats}
            onChange={(e) => setCompany({ ...company, seats: Number(e.target.value) })}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label
            htmlFor="iw-billing"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Billing email <span style={{ color: "var(--muted)", fontStyle: "italic" }}>(optional)</span>
          </label>
          <input
            id="iw-billing"
            className="ed-input"
            type="email"
            placeholder="billing@company.com"
            value={company.billingEmail}
            onChange={(e) => setCompany({ ...company, billingEmail: e.target.value })}
          />
        </div>

        {error && (
          <p
            style={{
              color: "var(--danger, #c0392b)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              letterSpacing: "0.04em",
              borderLeft: "2px solid var(--danger, #c0392b)",
              paddingLeft: "12px",
            }}
          >
            {error}
          </p>
        )}

        <button
          className="ed-btn ed-btn-accent"
          onClick={submitCompany}
          disabled={!company.companyName.trim() || !company.mcNumber.trim() || company.seats < 1 || isNaN(company.seats)}
          style={{ marginTop: "0.5rem" }}
        >
          Continue to payment
        </button>

        {signOutLink}
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "1.5rem",
      }}
    >
      {children}
    </div>
  );
}
