import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AccountContext } from "./types";

// TODO: map MyStatsResponse fields once backend shape confirmed
// The backend shape of GET /api/v1/analytics/my-stats is not yet known.
// We render the stats generically using Object.entries until the real fields are confirmed.
type MyStats = Record<string, unknown>;

export function PersonalPanel({ ctx }: { ctx: AccountContext }) {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MyStats>("/api/v1/analytics/my-stats")
      .then(setStats)
      .catch(() => {
        setStats({});
        setStatsError(true);
      });
  }, []);

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

  const statEntries = stats ? Object.entries(stats) : [];

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="ed-display text-[6vw] lg:text-[2.5rem]">Overview</h1>
        <p style={{ color: "var(--muted)" }}>
          {ctx.email}
          {ctx.effectiveStatus ? ` · ${ctx.effectiveStatus}` : ""}
        </p>
      </header>

      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--muted)" }}
        >
          Your activity
        </h2>
        {stats === null ? (
          <p style={{ color: "var(--muted)" }}>Loading stats…</p>
        ) : statsError ? (
          <p style={{ color: "var(--muted)" }}>Stats unavailable.</p>
        ) : statEntries.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No stats yet.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* TODO: map MyStatsResponse fields once backend shape confirmed */}
            {statEntries.map(([key, value]) => (
              <StatCard
                key={key}
                label={key.replace(/_/g, " ")}
                value={String(value ?? "—")}
              />
            ))}
          </div>
        )}
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
            Billing &amp; invoices
          </button>
          <button className="ed-btn" onClick={cancel}>
            Cancel subscription
          </button>
        </div>
        {error && (
          <p style={{ color: "var(--danger, #c0392b)" }}>{error}</p>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
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
      <span
        className="text-2xl font-bold"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}
