import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AccountContext } from "./types";

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

// Same basis as the popup: 30s saved per action.
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

  const isManager = ctx.panels.includes("team") && !!ctx.org;

  useEffect(() => {
    api
      .get<MyStats>("/api/v1/analytics/my-stats")
      .then(setStats)
      .catch(() => setStatsError(true));
  }, []);

  // Company-wide all-time totals (managers only), mirrored from the Statistics tab.
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
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/portal");
      window.location.href = url;
    } catch {
      setError("Could not open billing portal. Please try again.");
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel your subscription at the end of the current period?")) return;
    try {
      await api.post("/api/v1/billing/cancel-subscription");
      alert("Your subscription will cancel at period end.");
    } catch {
      setError("Could not cancel subscription. Please try again.");
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
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Emails sent" value={String(stats.emailSentCount)} />
              <StatCard label="Maps opened" value={String(stats.mapViewedCount)} />
              <StatCard label="Calls placed" value={String(stats.phoneCallCount)} />
              <StatCard label="Time saved" value={fmtTimeSaved(totalActions)} accent />
            </div>

            {stats.platforms.length > 0 && (
              <table className="w-full text-sm mt-6">
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th className="text-left font-normal py-1">Platform</th>
                    <th className="text-right font-normal py-1">Emails</th>
                    <th className="text-right font-normal py-1">Maps</th>
                    <th className="text-right font-normal py-1">Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.platforms.map((p) => (
                    <tr key={p.platform} style={{ borderTop: "1px solid var(--hairline)" }}>
                      <td className="py-1" style={{ color: "var(--ink)" }}>{p.platform}</td>
                      <td className="text-right py-1" style={{ color: "var(--ink)" }}>{p.emailSentCount}</td>
                      <td className="text-right py-1" style={{ color: "var(--ink)" }}>{p.mapViewedCount}</td>
                      <td className="text-right py-1" style={{ color: "var(--ink)" }}>{p.phoneCallCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : null}
      </div>

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
          <button className="ed-btn ed-btn-accent" onClick={openPortal}>
            <span>Billing &amp; invoices</span>
          </button>
          <button className="ed-btn" onClick={cancel}>
            <span>Cancel subscription</span>
          </button>
        </div>
        {error && <p style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}
      </div>
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
