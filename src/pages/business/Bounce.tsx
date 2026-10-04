/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { Link } from "react-router-dom";
import type { BounceReason } from "./types";
import { INSTALL_URL } from "./installLink";

type Copy = {
  title: string;
  body: string;
  cta: string;
  href: string;
  /** Step-by-step for the screens where installing alone is not enough: the user must sign in. */
  steps?: (email: string | null) => string[];
};

/** "as you@company.com — …" when we know who is signed in here, otherwise the generic wording. */
function sameAccount(email: string | null): string {
  return email ? `as ${email} — the same account you use here` : "with the same Google account you use here";
}

const OPEN_EXTENSION = "Open it (puzzle-piece icon in Chrome's toolbar → TruckBox)";

const COPY: Record<BounceReason, Copy> = {
  INSTALL: {
    title: "Get started with TruckBox",
    body: "The back office opens after you sign in to the TruckBox extension once.",
    cta: "Install the extension",
    href: INSTALL_URL,
    steps: (email) => [
      "Install the TruckBox extension from the Chrome Web Store.",
      `${OPEN_EXTENSION} and sign in with Google ${sameAccount(email)}.`,
      "Your 7-day free trial starts with that sign-in. Come back here and press Refresh.",
    ],
  },
  PAYMENT: {
    title: "Your plan has ended",
    body: "Renew your subscription to pick up where you left off.",
    cta: "Renew plan",
    href: "/#pricing",
  },
  NO_ACCOUNT: {
    title: "Install TruckBox first",
    body: "There's no TruckBox account for this email yet.",
    cta: "Install the extension",
    href: INSTALL_URL,
    steps: (email) => [
      "Install the TruckBox extension from the Chrome Web Store.",
      `${OPEN_EXTENSION} and sign in with Google ${sameAccount(email)}.`,
      "Come back here and sign in again.",
    ],
  },
  USE_EXTENSION: {
    title: "You are on a team",
    body: "Your access is managed by your team — you work in the extension.",
    cta: "Install the extension",
    href: INSTALL_URL,
    steps: (email) => [
      "Install the TruckBox extension from the Chrome Web Store, if you haven't yet.",
      `${OPEN_EXTENSION} and sign in with Google ${sameAccount(email)}. Your team seat is tied to this email.`,
    ],
  },
};

export function Bounce({
  reason,
  email = null,
  onRefresh,
  onSignOut,
  telegram,
  ctaOverride,
  signOutLabel = "Sign out",
}: {
  reason: BounceReason;
  /** The signed-in email, so the steps can name the account to use in the extension. */
  email?: string | null;
  /** Re-checks access after the user has signed in to the extension. */
  onRefresh?: () => void;
  onSignOut?: () => void;
  telegram?: string;
  ctaOverride?: { label: string; onClick: () => void };
  signOutLabel?: string;
}) {
  const c = COPY[reason];
  const external = c.href.startsWith("http");
  const steps = ctaOverride || !c.steps ? null : c.steps(email);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6">
      <h1 className="ed-display text-[10vw] lg:text-[4rem]">{c.title}</h1>
      <p className="lg:whitespace-nowrap" style={{ color: "var(--muted)" }}>
        {ctaOverride ? "Complete your subscription to activate your team." : c.body}
      </p>
      {steps && (
        <ol
          className="flex flex-col gap-3 text-left"
          style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: 520, width: "100%" }}
        >
          {steps.map((step, stepIndex) => (
            <li key={step} className="flex items-start gap-3" style={{ fontSize: "0.95rem", lineHeight: 1.45 }}>
              <span
                aria-hidden="true"
                style={{
                  flex: "none",
                  display: "inline-grid",
                  placeItems: "center",
                  width: 24,
                  height: 24,
                  marginTop: 1,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--bg)",
                  background: "var(--accent)",
                }}
              >
                {stepIndex + 1}
              </span>
              <span style={{ color: "var(--ink)" }}>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {ctaOverride ? (
        <button className="ed-btn ed-btn-accent" onClick={ctaOverride.onClick}>
          <span>{ctaOverride.label}</span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {external ? (
            <a className="ed-btn ed-btn-accent" href={c.href} target="_blank" rel="noreferrer">
              <span>{c.cta}</span>
            </a>
          ) : (
            <Link className="ed-btn ed-btn-accent" to={c.href}>
              <span>{c.cta}</span>
            </Link>
          )}
          {onRefresh && reason === "INSTALL" && (
            <button className="ed-btn" onClick={onRefresh}>
              <span>I've signed in — Refresh</span>
            </button>
          )}
        </div>
      )}

      {reason === "NO_ACCOUNT" && (
        <Link to="/business/start" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Setting up a company? <span className="ed-accent">Start a team →</span>
        </Link>
      )}

      {(telegram || onSignOut) && (
        <div className="flex flex-col items-center gap-3 mt-2">
          {telegram && (
            <a
              href={telegram}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "var(--muted)",
                fontSize: "0.82rem",
                textDecoration: "none",
              }}
            >
              Need help?
            </a>
          )}
          {onSignOut && (
            <button className="ed-btn" style={{ justifyContent: "center" }} onClick={onSignOut}>
              <span>{signOutLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
