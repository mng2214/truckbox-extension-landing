import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../../lib/api";
import type { OrgRole } from "./types";

type Member = { id: number; email: string; state: string; role: OrgRole };
type Team = { id: number; name: string; seats: number; members: Member[]; cancelAtPeriodEnd: boolean };

export function TeamPanel({ onChanged }: { onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<Team>("/api/v1/manager/team").then(setTeam).catch((e) => setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Could not load team."));
  }, []);
  useEffect(load, [load]);

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="ed-display text-[7vw] sm:text-[6vw] lg:text-[2.5rem]" style={{ wordBreak: "break-word" }}>{team.name}</h1>
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

      <div className="flex flex-col">
        {team.members.map((m) => (
          <div
            key={m.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            style={{ borderTop: "1px solid var(--hairline)" }}
          >
            <div className="min-w-0 flex flex-col gap-1">
              <span style={{ color: "var(--ink)", wordBreak: "break-all" }}>{m.email}</span>
              <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                {m.state} · {m.role}
              </span>
            </div>
            {m.role !== "OWNER" && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  className="ed-btn"
                  style={{ padding: "8px 14px", fontSize: "0.6rem" }}
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
                  style={{ padding: "8px 14px", fontSize: "0.6rem", color: "var(--danger, #c0392b)" }}
                  disabled={busy}
                  onClick={() =>
                    guard(() => api.del(`/api/v1/manager/team/members?email=${encodeURIComponent(m.email)}`))
                  }
                >
                  <span>Remove</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

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
