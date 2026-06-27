import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../../lib/api";
import type { OrgRole } from "./types";

type Member = { id: number; email: string; state: string; role: OrgRole };
type Team = { id: number; name: string; seats: number; members: Member[]; cancelAtPeriodEnd: boolean };

type Win = { emailsSent: number; mapsOpened: number; callsPlaced: number };
type Dispatcher = { email: string; today: Win; weekToDate: Win; monthToDate: Win; total: Win };
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

export function TeamPanel({ onChanged }: { onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<Team>("/api/v1/manager/team").then(setTeam).catch((e) => setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Could not load team."));
    api.get<TeamStats>("/api/v1/manager/team-stats").then(setStats).catch(() => setStats(null));
  }, []);
  useEffect(load, [load]);

  // Serializes mutations and blocks the controls while one is in flight, so a
  // seat +/- (or any action) can't be fired repeatedly before it resolves.
  const guard = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      await fn();
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Error");
    } finally {
      setBusy(false);
    }
  };

  if (!team) return <div>{err ?? "Loading…"}</div>;
  const owner = team.members.find((m) => m.role === "OWNER");

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h1 className="ed-display text-[6vw] lg:text-[2.5rem]">{team.name}</h1>
        <div className="flex items-center gap-3">
          <button
            className="ed-btn"
            aria-label="Remove seat"
            onClick={() => guard(() => api.patch("/api/v1/manager/team/seats", { seats: team.seats - 1 }))}
            disabled={busy || team.seats <= team.members.length}
          >
            <span>−</span>
          </button>
          <span style={{ color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: "0.5rem", minWidth: "5.5rem", justifyContent: "center" }}>
            {busy ? <span className="tb-spinner" aria-label="Updating" /> : `${team.seats} seats`}
          </span>
          <button
            className="ed-btn"
            aria-label="Add seat"
            onClick={() => guard(() => api.patch("/api/v1/manager/team/seats", { seats: team.seats + 1 }))}
            disabled={busy}
          >
            <span>+</span>
          </button>
        </div>
      </header>

      {err && <p style={{ color: "var(--danger, #c0392b)" }}>{err}</p>}

      <form
        className="flex gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await guard(() => api.post("/api/v1/manager/team/members", { emails: [newEmail] }));
          setNewEmail("");
        }}
      >
        <input
          className="border px-3 py-2 flex-1"
          style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
          type="email"
          placeholder="dispatcher@company.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
        />
        <button className="ed-btn ed-btn-accent" type="submit" disabled={busy}>
          <span>{busy ? "Working…" : "Add member"}</span>
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
            <th className="py-2 text-left" style={{ color: "var(--muted)" }}>Email</th>
            <th className="py-2 text-left" style={{ color: "var(--muted)" }}>Status</th>
            <th className="py-2 text-left" style={{ color: "var(--muted)" }}>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {team.members.map((m) => (
            <tr key={m.id} style={{ borderTop: "1px solid var(--hairline)" }}>
              <td className="py-3" style={{ color: "var(--ink)" }}>{m.email}</td>
              <td style={{ color: "var(--muted)" }}>{m.state}</td>
              <td style={{ color: "var(--muted)" }}>{m.role}</td>
              <td className="text-right py-2" style={{ whiteSpace: "nowrap" }}>
                {m.role !== "OWNER" && (
                  <>
                    <button
                      className="ed-btn"
                      style={{ padding: "6px 14px", fontSize: "0.6rem" }}
                      disabled={busy}
                      onClick={() =>
                        guard(() =>
                          api.patch("/api/v1/manager/team/members/role", {
                            email: m.email,
                            role: m.role === "MANAGER" ? "MEMBER" : "MANAGER",
                          })
                        )
                      }
                    >
                      <span>{m.role === "MANAGER" ? "Make member" : "Make manager"}</span>
                    </button>
                    <button
                      className="ed-btn"
                      style={{ marginLeft: "0.5rem", padding: "6px 14px", fontSize: "0.6rem", color: "var(--danger, #c0392b)" }}
                      disabled={busy}
                      onClick={() =>
                        guard(() => api.del(`/api/v1/manager/team/members?email=${encodeURIComponent(m.email)}`))
                      }
                    >
                      <span>Remove</span>
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {stats && stats.dispatchers.length > 0 && (
        <div className="flex flex-col gap-5">
          <h2 className="ed-display" style={{ fontSize: "1.4rem", color: "var(--ink)" }}>
            Team activity
          </h2>
          {stats.dispatchers.map((d) => (
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
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          className="ed-btn"
          onClick={async () => {
            try {
              const { url } = await api.post<{ url: string }>("/api/v1/billing/portal");
              window.location.href = url;
            } catch (e) {
              setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Error opening billing portal");
            }
          }}
        >
          Billing &amp; invoices
        </button>
        {owner && (
          <button
            className="ed-btn"
            style={{ color: "var(--danger, #c0392b)" }}
            onClick={() =>
              guard(() => api.post("/api/v1/billing/cancel-team-subscription"))
            }
          >
            Cancel team subscription
          </button>
        )}
      </div>
    </section>
  );
}
