import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AccountContext } from "./types";
import { ConfirmDialog } from "./ConfirmDialog";

type PlatformStats = {
  platform: string;
  emailSentCount: number;
  mapViewedCount: number;
  phoneCallCount: number;
};
type MyStats = {
  emailSentCount: number;
  mapViewedCount: number;
  phoneCallCount: number;
  platforms: PlatformStats[];
};

type Win = { emailsSent: number; mapsOpened: number; callsPlaced: number };
type TeamStats = { dispatchers: { total: Win }[] };

function fmtTimeSaved(actions: number): string {
  const totalMin = Math.floor((actions * 30) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PersonalPanel({ ctx }: { ctx: AccountContext }) {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Win | null>(null);
  const [busy, setBusy] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isManager = ctx.panels.includes("team") && !!ctx.org;

  useEffect(() => {
    api
      .get<MyStats>("/api/v1/analytics/my-stats")
      .then(setStats)
      .catch(() => setStatsError(true));
  }, []);

  useEffect(() => {
    if (!isManager) return;
    api
      .get<TeamStats>("/api/v1/manager/team-stats")
      .then((s) =>
        setCompany(
          s.dispatchers.reduce(
            (a, d) => ({
              emailsSent: a.emailsSent + d.total.emailsSent,
              mapsOpened: a.mapsOpened + d.total.mapsOpened,
              callsPlaced: a.callsPlaced + d.total.callsPlaced,
            }),
            { emailsSent: 0, mapsOpened: 0, callsPlaced: 0 }
          )
        )
      )
      .catch(() => setCompany(null));
  }, [isManager]);

  const openPortal = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setPortalLoading(true);
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/portal");
      window.location.href = url; // navigating away; stays locked until unload
    } catch {
      setError("Could not open billing portal. Please try again.");
      setBusy(false);
      setPortalLoading(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/v1/billing/cancel-subscription");
      setNotice("Your subscription will cancel at the end of the billing period.");
    } catch {
      setError("Could not cancel subscription. Please try again.");
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  const totalActions = stats
    ? stats.emailSentCount + stats.mapViewedCount + stats.phoneCallCount
    : 0;

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="ed-display text-[6vw] lg:text-[2.5rem]">Overview</h1>
        <p style={{ color: "var(--muted)" }}>
          {ctx.email}
          {ctx.effectiveStatus ? ` · ${ctx.effectiveStatus}` : ""}
        </p>
      </header>

      {company && (
        <div className="flex flex-col gap-3">
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Whole team · all time
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total emails" value={String(company.emailsSent)} />
            <StatCard label="Total maps" value={String(company.mapsOpened)} />
            <StatCard label="Total calls" value={String(company.callsPlaced)} />
            <StatCard
              label="Company saved time"
              value={fmtTimeSaved(company.emailsSent + company.mapsOpened + company.callsPlaced)}
              accent
            />
          </div>
        </div>
      )}

      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--muted)" }}
        >
          Your activity
        </h2>
        {!stats && !statsError ? (
          <p style={{ color: "var(--muted)" }}>Loading stats…</p>
        ) : statsError ? (
          <p style={{ color: "var(--muted)" }}>Stats unavailable.</p>
        ) : stats ? (
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            <StatLine label="Emails sent" value={String(stats.emailSentCount)} />
            <StatLine label="Maps opened" value={String(stats.mapViewedCount)} />
            <StatLine label="Calls placed" value={String(stats.phoneCallCount)} />
            <StatLine label="Time saved" value={fmtTimeSaved(totalActions)} accent />
          </div>
        ) : null}
      </div>

      {/* Individual billing only — org members/owners manage billing in the Team tab,
          where the subscription actually lives (this user has no personal subscription). */}
      {!ctx.org && (
        <div
          className="flex flex-col gap-2 p-6 rounded-lg border"
          style={{ borderColor: "var(--hairline)" }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted)" }}
          >
            Billing
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button
              className="ed-btn ed-btn-accent"
              disabled={busy}
              aria-busy={portalLoading}
              onClick={openPortal}
            >
              {portalLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="tb-spinner"
                    style={{ borderColor: "rgba(255,255,255,0.45)", borderTopColor: "#fff" }}
                    aria-hidden
                  />
                  Opening…
                </span>
              ) : (
                <span>Billing &amp; invoices</span>
              )}
            </button>
            <button
              className="ed-btn"
              disabled={busy || !!notice}
              onClick={() => setConfirmCancel(true)}
            >
              <span>Cancel subscription</span>
            </button>
          </div>
          {error && <p style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}
          {notice && <p style={{ color: "var(--sub)", fontSize: "0.85rem" }}>{notice}</p>}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        message="You keep full access until the end of the current billing period. After that, your extension access ends."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        destructive
        busy={busy}
        onConfirm={cancel}
        onClose={() => setConfirmCancel(false)}
      />
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-lg border"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

function StatLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}
