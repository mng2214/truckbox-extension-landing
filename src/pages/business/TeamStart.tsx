/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { mcDigits, plainText } from "../../lib/inputGuards";
import { usePageMeta } from "../../lib/meta";
import { auth } from "../../lib/auth";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import { MicrosoftSignIn } from "../../components/MicrosoftSignIn";
import type { GoogleAuthResult } from "../../lib/google";
import { PhoneVerify } from "./PhoneVerify";

type Step = "loading" | "signin" | "phone" | "company" | "redirecting";

const PHONE_VERIFICATION_REQUIRED = 1023;
const SEAT_PRICE = 7;

async function sessionStep(): Promise<{ step: Step; email: string }> {
  try {
    const ctx = await api.get<{ email: string }>("/api/v1/account/context");
    return { step: "company", email: ctx.email };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && e.code === PHONE_VERIFICATION_REQUIRED) {
      return { step: "phone", email: "" };
    }
    auth.clearToken();
    return { step: "signin", email: "" };
  }
}

export default function TeamStart() {
  usePageMeta({
    title: "Start a team — TruckBox",
    description: "Set up TruckBox for your dispatch team: one bill, a manager back office, $7 per seat.",
    path: "/business/start",
  });
  const [step, setStep] = useState<Step>(() => (auth.isAuthed() ? "loading" : "signin"));
  const [company, setCompany] = useState({
    companyName: "",
    mcNumber: "",
    dispatcherSeats: 1,
    ownerUsesDat: false,
    billingEmail: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [authedEmail, setAuthedEmail] = useState("");

  const gateAfterAuth = () =>
    sessionStep().then((r) => {
      setAuthedEmail(r.email);
      setStep(r.step);
    });

  const onGoogleSignedIn = (res: GoogleAuthResult) => {
    setAuthedEmail(res.email);
    setStep(res.phoneVerificationRequired ? "phone" : "company");
  };

  const signOut = () => {
    auth.clearToken();
    setAuthedEmail("");
    setStep("signin");
  };

  const signOutLink =
    authedEmail !== "" ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          flexWrap: "wrap",
          marginTop: "0.6rem",
        }}
      >
        <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
          Signed in as {authedEmail}
        </span>
        <button
          className="ed-btn"
          onClick={signOut}
          style={{ padding: "0.28rem 0.7rem", fontSize: "0.76rem" }}
        >
          Sign out
        </button>
      </div>
    ) : null;

  useEffect(() => {
    if (!auth.isAuthed()) return;
    sessionStep().then((r) => {
      setAuthedEmail(r.email);
      setStep(r.step);
    });
  }, []);

  const submitCompany = async () => {
    setError(null);
    setStep("redirecting");
    try {
      await api.post("/api/v1/org/onboard", {
        companyName: company.companyName,
        mcNumber: company.mcNumber,
        dispatcherSeats: Number(company.dispatcherSeats),
        ownerUsesDat: company.ownerUsesDat,
        billingEmail: company.billingEmail,
      });
      const { url } = await api.post<{ url: string }>("/api/v1/manager/team/checkout", {});
      window.location.href = url;
    } catch (e) {
      setStep("company");
      const code = e instanceof ApiError ? e.code : undefined;
      setError(
        code === 1066
          ? "Confirm your email first: open your account → Accounts → Contact email, then come back."
          : code === 1034
            ? "You're already on a team. Ask its owner to remove you first, or manage it in your account."
            : "Something went wrong. Please try again."
      );
    }
  };

  if (step === "loading") return <Center>Loading…</Center>;

  if (step === "signin")
    return (
      <Center>
        <h1 className="ed-display" style={{ fontSize: "2.5rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
          Start your team
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1rem", textAlign: "center", maxWidth: "24rem" }}>
          Sign in with the account you'll manage the team from. ${SEAT_PRICE} per seat per month, one bill.
        </p>
        <GoogleSignIn signup onSignedIn={onGoogleSignedIn} />
        <MicrosoftSignIn signup onSignedIn={() => gateAfterAuth()} />
      </Center>
    );

  if (step === "phone")
    return (
      <PhoneVerify
        onVerified={() => {
          setStep("loading");
          gateAfterAuth();
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
            maxLength={120}
            onChange={(e) => setCompany({ ...company, companyName: plainText(e.target.value) })}
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
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => setCompany({ ...company, mcNumber: mcDigits(e.target.value) })}
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
            How many dispatchers will work in DAT or Truckstop?
          </label>
          <input
            id="iw-seats"
            className="ed-input"
            type="number"
            min={1}
            placeholder="1"
            value={company.dispatcherSeats}
            max={100}
            onChange={(e) => setCompany({ ...company, dispatcherSeats: Math.min(100, Number(e.target.value)) })}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={company.ownerUsesDat}
              onChange={(e) => setCompany({ ...company, ownerUsesDat: e.target.checked })}
            />
            <span style={{ fontSize: "0.85rem" }}>I will work in DAT/Truckstop too</span>
          </label>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>
            Leave unchecked if you only manage the team and read reports — no seat, no charge.
          </p>
          {(() => {
            const billable =
              (isNaN(company.dispatcherSeats) ? 0 : Number(company.dispatcherSeats)) +
              (company.ownerUsesDat ? 1 : 0);
            return (
              <p style={{ margin: "0.25rem 0 0", fontWeight: 700, color: "var(--ink)" }}>
                {billable} seat{billable === 1 ? "" : "s"} × ${SEAT_PRICE} = ${billable * SEAT_PRICE}/mo
              </p>
            );
          })()}
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
            maxLength={254}
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
          disabled={
            !company.companyName.trim() ||
            !company.mcNumber.trim() ||
            company.dispatcherSeats < 1 ||
            isNaN(company.dispatcherSeats)
          }
          style={{ marginTop: "0.5rem", justifyContent: "center" }}
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
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "1.5rem",
      }}
    >
      <Link
        to="/"
        className="ed-btn tb-back-btn"
        style={{ position: "absolute", top: "1.25rem", left: "1.25rem", display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to site
      </Link>
      {children}
    </div>
  );
}
