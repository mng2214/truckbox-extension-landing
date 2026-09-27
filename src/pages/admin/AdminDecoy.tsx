/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { usePageMeta } from "../../lib/meta";
import { reportPageView } from "../../lib/pageView";
import "./admin-decoy.css";

const VIDEO = "/gallery/louvre.mp4";
const END_FRAME = "/gallery/louvre-end.jpg";
const CALLBACK = "/admin/sso/callback";
const CHECK_MS = 3000;
const BLACK_MS = 1400;
const STEPS = ["Checking credentials…", "Establishing secure session…", "Loading console…"];
const DESCRIPTION = "A gorilla Mona Lisa at the Louvre, with a visitor deep in thought";

function fakeState(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const DEVTOOLS_GAP = 160;

function useVisitTelemetry() {
  useEffect(() => {
    const startedAt = Date.now();
    let left = false;
    let copied = false;
    let inspected = false;

    const reportLeave = () => {
      if (left) return;
      left = true;
      reportPageView("leave", window.location.pathname, Math.round((Date.now() - startedAt) / 1000));
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") reportLeave();
    };
    const onCopy = () => {
      if (copied) return;
      copied = true;
      reportPageView("copy");
    };

    const precisePointer = window.matchMedia?.("(pointer: fine)").matches ?? false;
    const devtoolsCheck = precisePointer
      ? window.setInterval(() => {
          const docked =
            window.outerWidth - window.innerWidth > DEVTOOLS_GAP ||
            window.outerHeight - window.innerHeight > DEVTOOLS_GAP;
          if (!docked || inspected) return;
          inspected = true;
          reportPageView("devtools");
        }, 1000)
      : null;

    window.addEventListener("pagehide", reportLeave);
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("copy", onCopy);
    return () => {
      if (Date.now() - startedAt > 1000) reportLeave();
      window.removeEventListener("pagehide", reportLeave);
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("copy", onCopy);
      if (devtoolsCheck != null) window.clearInterval(devtoolsCheck);
    };
  }, []);
}

export default function AdminDecoy() {
  usePageMeta({
    title: "Admin — TruckBox",
    description: "Restricted area.",
    path: "/admin",
    noindex: true,
  });

  const { pathname } = useLocation();
  const onCallback = pathname.toLowerCase().startsWith(CALLBACK);
  useVisitTelemetry();

  return onCallback ? <DecoyCallback key={pathname} /> : <DecoyLogin />;
}

function DecoyCallback() {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [fallback, setFallback] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stepMs = CHECK_MS / STEPS.length;
    const pending = STEPS.slice(1).map((_, index) =>
      window.setTimeout(() => setStep(index + 1), stepMs * (index + 1)),
    );
    pending.push(
      window.setTimeout(() => {
        setRevealed(true);
        reportPageView("reveal");
      }, CHECK_MS),
    );
    pending.push(
      window.setTimeout(() => {
        const player = video.current;
        if (!player) return;
        player.muted = true;
        player.play().catch(() => setFallback(true));
      }, CHECK_MS + BLACK_MS),
    );
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <>
      <div className={"gw-reveal" + (revealed ? " is-on" : "")} aria-hidden={!revealed}>
        {fallback ? (
          <img className="gw-reveal-media" src={END_FRAME} alt={DESCRIPTION} />
        ) : (
          <video
            ref={video}
            className="gw-reveal-media"
            src={VIDEO}
            muted
            playsInline
            preload="auto"
            aria-label={DESCRIPTION}
            onError={() => setFallback(true)}
          />
        )}
        <Link className="gw-reveal-back" to="/">
          ← truckbox.app
        </Link>
      </div>

      {!revealed && (
        <div className="gw-page">
          <div className="gw-loader" role="status" aria-live="polite">
            <div className="gw-loader-text">{STEPS[step]}</div>
            <div className="gw-loader-bar" aria-hidden>
              <span style={{ animationDuration: CHECK_MS + "ms" }} />
            </div>
            <div className="gw-meta gw-loader-meta">TLS 1.3 · SSO · Audit on</div>
          </div>
        </div>
      )}
    </>
  );
}

function DecoyLogin() {
  const navigate = useNavigate();
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportPageView("open");
  }, []);

  const logIn = () => {
    reportPageView("login");
    navigate(`${CALLBACK}?state=${fakeState()}`);
  };

  return (
    <div className="gw-page">
      <div className="gw-card">
        <h1 className="gw-title">Restricted area</h1>
        <p className="gw-text">Authorized personnel only. All access is logged.</p>
        <button type="button" className="gw-btn" onClick={logIn}>
          Log in
        </button>
        <div className="gw-meta">TLS 1.3 · SSO · Audit on</div>
      </div>
    </div>
  );
}
