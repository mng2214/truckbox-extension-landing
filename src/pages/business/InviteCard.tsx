/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { api } from "../../lib/api";

type ReferralSummary = { link: string; invited: number; paid: number; monthsEarned: number };

export function InviteCard() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<ReferralSummary>("/api/v1/referrals/me")
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const copy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The link stays selectable in the field.
    }
  };

  if (failed) return null;

  return (
    <div className="flex flex-col gap-3 p-6 border" style={{ borderColor: "var(--hairline)" }}>
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        Invite a dispatcher
      </h2>
      <p style={{ margin: 0, color: "var(--ink)", fontSize: "0.95rem" }}>
        They get 14 days free instead of 7. When they subscribe, you get a free month.
      </p>
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          readOnly
          value={summary?.link ?? "Loading…"}
          aria-label="Your invite link"
          onFocus={(event) => event.currentTarget.select()}
          className="ed-input"
          style={{ flex: "1 1 260px", minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}
        />
        <button type="button" className="ed-btn ed-btn-accent" onClick={copy} disabled={!summary}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          <span>{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>
      {summary && (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
          {summary.invited} signed up · {summary.paid} subscribed · {summary.monthsEarned}{" "}
          {summary.monthsEarned === 1 ? "free month" : "free months"} earned
        </p>
      )}
    </div>
  );
}
