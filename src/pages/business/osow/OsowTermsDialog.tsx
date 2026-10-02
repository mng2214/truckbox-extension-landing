/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, FileX, FlaskConical, Route, ShieldAlert } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** What "estimate" means, one block per point so none of them reads as fine print. */
const POINTS = [
  {
    icon: BookOpen,
    label: "Public sources",
    text: "State rules and fees come from public sources and may be outdated, incomplete or wrong.",
  },
  {
    icon: Route,
    label: "Approximate",
    text: "The route, trip days and escort counts are approximate — the state sets the real ones on your permit.",
  },
  {
    icon: FileX,
    label: "Not a permit",
    text: "It is not a permit and does not order one. Verify with each state's permit office before you quote, bid or move a load.",
  },
  {
    icon: ShieldAlert,
    label: "No liability",
    text: "TruckBox is not responsible for fines, delays or losses from relying on these numbers.",
  },
] as const;

/**
 * Shown before the calculator can be used, and again whenever the terms version changes. It can't
 * be dismissed by clicking outside: the user either agrees or leaves.
 */
export function OsowTermsDialog({
  busy,
  error,
  onAccept,
  onLeave,
}: {
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onLeave: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const checkboxId = useId();
  const titleId = useId();
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkboxRef.current?.focus();
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: EASE }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: EASE }}
        style={{
          width: "min(520px, 100%)",
          maxHeight: "calc(100vh - 2rem)",
          overflowY: "auto",
          background: "var(--bg-2)",
          border: "1px solid var(--hairline)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4)",
          padding: "1.5rem",
        }}
      >
        <span className="tb-chip is-accent-o" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FlaskConical size={12} /> Beta feature
        </span>
        <h3 id={titleId} className="ed-display" style={{ fontSize: "1.2rem", margin: "12px 0 0" }}>
          Before you use the OS/OW calculator
        </h3>
        <p style={{ margin: "10px 0 0", fontSize: "0.9rem", color: "var(--sub)", lineHeight: 1.55 }}>
          This calculator is in beta. Everything it shows is an <b style={{ color: "var(--ink)" }}>estimate</b>:
        </p>
        <ul
          style={{
            margin: "12px 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 1,
            background: "var(--hairline)",
            border: "1px solid var(--hairline)",
          }}
        >
          {POINTS.map(({ icon: Icon, label, text }) => (
            <li
              key={label}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 12px",
                background: "var(--bg-2)",
              }}
            >
              <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2, color: "var(--accent)" }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="ed-label" style={{ color: "var(--ink)" }}>
                  {label}
                </span>
                <span style={{ fontSize: "0.86rem", color: "var(--sub)", lineHeight: 1.5 }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>

        <label
          htmlFor={checkboxId}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            marginTop: 16,
            padding: "12px",
            border: "1px solid var(--hairline)",
            cursor: "pointer",
            fontSize: "0.88rem",
            color: "var(--ink)",
            lineHeight: 1.5,
          }}
        >
          <input
            ref={checkboxRef}
            id={checkboxId}
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            style={{ marginTop: 3, accentColor: "var(--accent)", width: 16, height: 16, flexShrink: 0 }}
          />
          <span>
            I understand these are estimates and I agree to the{" "}
            <a className="ed-accent" href="/privacy#terms-osow" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Terms &amp; Conditions
            </a>{" "}
            and{" "}
            <a className="ed-accent" href="/privacy#privacy-osow" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Privacy Policy
            </a>
            , including the OS/OW calculator sections.
          </span>
        </label>

        {error && (
          <p role="alert" style={{ margin: "10px 0 0", fontSize: "0.84rem", color: "var(--osw-danger, #c0392b)" }}>
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2" style={{ marginTop: 18 }}>
          <button type="button" className="ed-btn" onClick={onLeave} disabled={busy}>
            Not now
          </button>
          <button type="button" className="ed-btn ed-btn-accent" onClick={onAccept} disabled={!agreed || busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
