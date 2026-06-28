import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Win = { emailsSent: number; mapsOpened: number; callsPlaced: number };
type Dispatcher = {
  email: string;
  today: Win;
  weekToDate: Win;
  monthToDate: Win;
  total: Win;
};
type TeamStats = { organizationName: string; seats: number; dispatchers: Dispatcher[] };

// Same basis as the popup: 30s saved per action.
function timeSaved(w: Win): string {
  const totalMin = Math.floor(((w.emailsSent + w.mapsOpened + w.callsPlaced) * 30) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function StatsPanel() {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<TeamStats>("/api/v1/manager/team-stats")
      .then(setStats)
      .catch(() => setErr("Could not load statistics."));
  }, []);

  if (err) return <p style={{ color: "var(--danger, #c0392b)" }}>{err}</p>;
  if (!stats) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  // Grand total across every team member (all-time).
  const grand: Win = stats.dispatchers.reduce(
    (a, d) => ({
      emailsSent: a.emailsSent + d.total.emailsSent,
      mapsOpened: a.mapsOpened + d.total.mapsOpened,
      callsPlaced: a.callsPlaced + d.total.callsPlaced,
    }),
    { emailsSent: 0, mapsOpened: 0, callsPlaced: 0 }
  );

  return (
    <section className="flex flex-col gap-6">
      <h1 className="ed-display text-[6vw] lg:text-[2.5rem]" style={{ color: "var(--ink)" }}>
        Statistics
      </h1>

      {stats.dispatchers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Whole team · all time
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total emails" value={String(grand.emailsSent)} />
            <StatCard label="Total maps" value={String(grand.mapsOpened)} />
            <StatCard label="Total calls" value={String(grand.callsPlaced)} />
            <StatCard label="Company saved time" value={timeSaved(grand)} accent />
          </div>
        </div>
      )}

      {stats.dispatchers.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No activity yet. Stats appear once your dispatchers sign in to the extension and start
          working.
        </p>
      ) : (
        stats.dispatchers.map((d) => (
          <div
            key={d.email}
            style={{ borderTop: "1px solid var(--hairline)", paddingTop: "0.85rem" }}
          >
            <div
              style={{
                color: "var(--ink)",
                fontWeight: 600,
                marginBottom: "0.5rem",
                wordBreak: "break-all",
              }}
            >
              {d.email}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th className="text-left font-normal py-1"></th>
                  <th className="text-right font-normal py-1">Emails</th>
                  <th className="text-right font-normal py-1">Maps</th>
                  <th className="text-right font-normal py-1">Calls</th>
                  <th className="text-right font-normal py-1">Time saved</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Today", d.today],
                    ["This week", d.weekToDate],
                    ["This month", d.monthToDate],
                    ["Total", d.total],
                  ] as const
                ).map(([label, w]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td className="py-1" style={{ color: "var(--muted)" }}>{label}</td>
                    <td className="text-right py-1" style={{ color: "var(--ink)" }}>{w.emailsSent}</td>
                    <td className="text-right py-1" style={{ color: "var(--ink)" }}>{w.mapsOpened}</td>
                    <td className="text-right py-1" style={{ color: "var(--ink)" }}>{w.callsPlaced}</td>
                    <td className="text-right py-1" style={{ color: "var(--accent)" }}>{timeSaved(w)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-lg border" style={{ borderColor: "var(--hairline)" }}>
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
