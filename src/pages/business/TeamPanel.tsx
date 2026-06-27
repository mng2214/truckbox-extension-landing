import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../../lib/api";
import type { OrgRole } from "./types";

type Member = { id: number; email: string; state: string; role: OrgRole };
type Team = { id: number; name: string; seats: number; members: Member[]; cancelAtPeriodEnd: boolean };

export function TeamPanel({ onChanged }: { onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Team>("/api/v1/manager/team").then(setTeam).catch(() => setErr("Could not load team."));
  }, []);
  useEffect(load, [load]);

  const guard = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      load();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Error");
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
            disabled={team.seats <= team.members.length}
          >
            −
          </button>
          <span style={{ color: "var(--ink)" }}>{team.seats} seats</span>
          <button
            className="ed-btn"
            aria-label="Add seat"
            onClick={() => guard(() => api.patch("/api/v1/manager/team/seats", { seats: team.seats + 1 }))}
          >
            +
          </button>
        </div>
      </header>

      {err && <p style={{ color: "var(--danger, #c0392b)" }}>{err}</p>}

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          guard(() => api.post("/api/v1/manager/team/members", { emails: [newEmail] }));
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
        <button className="ed-btn ed-btn-accent" type="submit">
          Add member
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
              <td className="text-right" style={{ whiteSpace: "nowrap" }}>
                {m.role !== "OWNER" && (
                  <>
                    <button
                      className="ed-btn"
                      onClick={() =>
                        guard(() =>
                          api.patch("/api/v1/manager/team/members/role", {
                            email: m.email,
                            role: m.role === "MANAGER" ? "MEMBER" : "MANAGER",
                          })
                        )
                      }
                    >
                      {m.role === "MANAGER" ? "Make member" : "Make manager"}
                    </button>
                    <button
                      className="ed-btn"
                      style={{ marginLeft: "0.5rem", color: "var(--danger, #c0392b)" }}
                      onClick={() =>
                        guard(() => api.del(`/api/v1/manager/team/members?email=${encodeURIComponent(m.email)}`))
                      }
                    >
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
