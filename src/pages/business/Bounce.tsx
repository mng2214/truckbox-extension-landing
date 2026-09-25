/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { Link } from "react-router-dom";
import type { BounceReason } from "./types";

const INSTALL_URL =
  "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd";

const COPY: Record<BounceReason, { title: string; body: string; cta: string; href: string }> = {
  INSTALL: {
    title: "Get started with TruckBox",
    body: "Install the extension to start sending broker emails in one click.",
    cta: "Install the extension",
    href: INSTALL_URL,
  },
  PAYMENT: {
    title: "Your plan has ended",
    body: "Renew your subscription to pick up where you left off.",
    cta: "Renew plan",
    href: "/#pricing",
  },
  NO_ACCOUNT: {
    title: "Install TruckBox first",
    body: "There's no TruckBox account for this email yet. Install the extension and sign in there — then come back here.",
    cta: "Install the extension",
    href: INSTALL_URL,
  },
  USE_EXTENSION: {
    title: "You are on a team",
    body: "Your access is managed by your team. Open the extension to keep working.",
    cta: "Open the extension",
    href: INSTALL_URL,
  },
};

export function Bounce({
  reason,
  onSignOut,
  telegram,
  ctaOverride,
  signOutLabel = "Sign out",
}: {
  reason: BounceReason;
  onSignOut?: () => void;
  telegram?: string;
  ctaOverride?: { label: string; onClick: () => void };
  signOutLabel?: string;
}) {
  const c = COPY[reason];
  const external = c.href.startsWith("http");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6">
      <h1 className="ed-display text-[10vw] lg:text-[4rem]">{c.title}</h1>
      <p className="lg:whitespace-nowrap" style={{ color: "var(--muted)" }}>
        {ctaOverride ? "Complete your subscription to activate your team." : c.body}
      </p>
      {ctaOverride ? (
        <button className="ed-btn ed-btn-accent" onClick={ctaOverride.onClick}>
          <span>{ctaOverride.label}</span>
        </button>
      ) : external ? (
        <a className="ed-btn ed-btn-accent" href={c.href} target="_blank" rel="noreferrer">
          <span>{c.cta}</span>
        </a>
      ) : (
        <Link className="ed-btn ed-btn-accent" to={c.href}>
          <span>{c.cta}</span>
        </Link>
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
