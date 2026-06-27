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
}: {
  reason: BounceReason;
  onSignOut?: () => void;
  telegram?: string;
}) {
  const c = COPY[reason];
  const external = c.href.startsWith("http");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6">
      <h1 className="ed-display text-[10vw] lg:text-[4rem]">{c.title}</h1>
      <p className="max-w-md" style={{ color: "var(--muted)" }}>
        {c.body}
      </p>
      {external ? (
        <a className="ed-btn ed-btn-accent" href={c.href} target="_blank" rel="noreferrer">
          <span>{c.cta}</span>
        </a>
      ) : (
        <Link className="ed-btn ed-btn-accent" to={c.href}>
          <span>{c.cta}</span>
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
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Need help?
            </a>
          )}
          {onSignOut && (
            <button className="ed-btn" style={{ justifyContent: "center" }} onClick={onSignOut}>
              <span>Sign out</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
