import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../../lib/api";
import type { OrgRole } from "./types";
import { ConfirmDialog } from "./ConfirmDialog";

type Member = { id: number; email: string; state: string; role: OrgRole; hasSeat: boolean };
type Team = { id: number; name: string; seats: number; members: Member[]; cancelAtPeriodEnd: boolean };

/** Maps backend error codes to human-readable messages. */
function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 1020:
        return "Your subscription is already scheduled to cancel at the end of the billing period.";
      case 1019:
        return "This team has no active subscription.";
      case 1021:
        return "Seat limit reached — add a seat before giving more access.";
      case 1022:
        return "Seat count can’t be below the people who have access.";
      default:
        return `Something went wrong (error ${e.code ?? e.status}).`;
    }
  }
  return "Something went wrong. Please try again.";
}

const initials = (email: string) => email.slice(0, 2).toUpperCase();

export function TeamPanel({ onChanged }: { onChanged: () => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(() => {
    api
      .get<Team>("/api/v1/manager/team")
      .then(setTeam)
      .catch((e) => setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Could not load team."));
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
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!team) return <div style={{ color: "var(--muted)" }}>{err ?? "Loading…"}</div>;

  const owner = team.members.find((m) => m.role === "OWNER");
  const billable = team.members.filter((m) => m.hasSeat).length;
  const dispatchers = team.members.filter((m) => m.role === "MEMBER").length;

  return (
    <section className="flex flex-col gap-7">
      <header>
        <div className="ed-label" style={{ wordBreak: "break-word" }}>{team.name}</div>
        <h1 className="ed-display" style={{ fontSize: "1.7rem", marginTop: 4 }}>Team</h1>
      </header>

      {err && <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{err}</p>}

      {/* Metrics — the state of the team at a glance */}
      <div className="tb-metrics">
        <div>
          <div className="tb-metric-k">Seats used</div>
          <div className="tb-metric-v">
            {billable}
            <small> / {team.seats}</small>
          </div>
          <div className="tb-meter">
            <i style={{ width: `${team.seats ? Math.min(100, (billable / team.seats) * 100) : 0}%` }} />
          </div>
        </div>
        <div>
          <div className="tb-metric-k">Members</div>
          <div className="tb-metric-v">{team.members.length}</div>
        </div>
        <div>
          <div className="tb-metric-k">Dispatchers</div>
          <div className="tb-metric-v">{dispatchers}</div>
        </div>
      </div>

      {/* Members */}
      <div>
        <div className="flex items-center justify-between" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 7 }}>
          <h2 className="ed-label" style={{ color: "var(--ink)" }}>Members</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ed-btn"
              aria-label="Remove a seat"
              style={{ padding: "6px 12px" }}
              onClick={() => guard(() => api.patch("/api/v1/manager/team/seats", { seats: team.seats - 1 }))}
              disabled={busy || team.seats <= billable}
            >
              <span>−</span>
            </button>
            <span
              className="ed-label"
              style={{ color: "var(--ink)", minWidth: "4.5rem", textAlign: "center", fontVariantNumeric: "tabular-nums" }}
            >
              {busy ? <span className="tb-spinner" aria-label="Updating" /> : `${team.seats} seats`}
            </span>
            <button
              type="button"
              className="ed-btn"
              aria-label="Add a seat"
              style={{ padding: "6px 12px" }}
              onClick={() => guard(() => api.patch("/api/v1/manager/team/seats", { seats: team.seats + 1 }))}
              disabled={busy}
            >
              <span>+</span>
            </button>
          </div>
        </div>

        <p style={{ color: "var(--sub)", fontSize: "0.8125rem", margin: "12px 0 4px" }}>
          Access to the TruckBox extension for DAT and Truckstop. Each person with access uses one seat.
        </p>

        <div className="flex flex-col">
          {team.members.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:gap-4"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  aria-hidden
                  style={{
                    width: 32, height: 32, flexShrink: 0,
                    background: "var(--tb-hover)", color: "var(--sub)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.68rem",
                  }}
                >
                  {initials(m.email)}
                </span>
                <div className="min-w-0">
                  <div style={{ fontWeight: 500, color: "var(--ink)", wordBreak: "break-all", lineHeight: 1.3 }}>
                    {m.email}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <span
                      className={
                        "tb-chip" +
                        (m.role === "OWNER" ? " is-accent" : m.role === "MANAGER" ? " is-ink" : "")
                      }
                    >
                      {m.role === "MEMBER" ? "Dispatcher" : m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                    </span>
                    <span style={{ fontSize: "0.73rem", color: m.state === "INVITED" ? "var(--pp-ink)" : "var(--muted)" }}>
                      {m.state === "INVITED" ? "Invited" : "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seat: dispatchers always have it; owners/managers choose (the billed toggle). */}
              <div className="flex items-center gap-2.5 shrink-0" style={{ minWidth: 150 }}>
                {m.role === "MEMBER" ? (
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Access included</span>
                ) : (
                  <>
                    <span style={{ fontSize: "0.75rem", color: "var(--sub)" }}>Extension access</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={m.hasSeat}
                      aria-label={`Extension access for ${m.email}`}
                      className={"tb-switch" + (m.hasSeat ? " is-on" : "")}
                      disabled={busy}
                      onClick={() =>
                        guard(() =>
                          api.patch("/api/v1/manager/team/members/seat", {
                            email: m.email,
                            hasSeat: !m.hasSeat,
                          })
                        )
                      }
                    />
                  </>
                )}
              </div>

              {/* Role / remove — owner is fixed */}
              {m.role !== "OWNER" && (
                <div className="flex gap-2 shrink-0">
                  <button
                    className="ed-btn"
                    style={{ padding: "6px 11px", fontSize: "0.66rem" }}
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
                    <span>{m.role === "MANAGER" ? "Make dispatcher" : "Make manager"}</span>
                  </button>
                  <button
                    className="ed-btn"
                    style={{ padding: "6px 11px", fontSize: "0.66rem", color: "var(--danger)" }}
                    disabled={busy}
                    onClick={() => guard(() => api.del(`/api/v1/manager/team/members?email=${encodeURIComponent(m.email)}`))}
                  >
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add member */}
        <form
          className="flex flex-col sm:flex-row gap-2.5 mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            await guard(() => api.post("/api/v1/manager/team/members", { emails: [newEmail] }));
            setNewEmail("");
          }}
        >
          <input
            className="ed-input"
            style={{ flex: 1, padding: "9px 12px", color: "var(--ink)", background: "var(--bg-2)" }}
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
      </div>

      {/* Billing */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          className="ed-btn"
          disabled={busy || portalLoading}
          aria-busy={portalLoading}
          onClick={async () => {
            if (busy || portalLoading) return;
            setErr(null);
            setBusy(true);
            setPortalLoading(true);
            try {
              const { url } = await api.post<{ url: string }>("/api/v1/billing/portal");
              window.location.href = url; // navigating away; state stays locked until unload
            } catch (e) {
              setErr(e instanceof ApiError ? `Error ${e.code ?? e.status}` : "Error opening billing portal");
              setBusy(false);
              setPortalLoading(false);
            }
          }}
        >
          {portalLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="tb-spinner" aria-hidden />
              Opening…
            </span>
          ) : (
            "Billing & invoices"
          )}
        </button>
        {owner &&
          (team.cancelAtPeriodEnd ? (
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Subscription will cancel at the end of the billing period.
            </span>
          ) : (
            <button
              className="ed-btn"
              style={{ color: "var(--danger)" }}
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel team subscription
            </button>
          ))}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        message="Your team keeps full access until the end of the current billing period. After that, extension access ends for everyone on the team."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        destructive
        busy={busy}
        onConfirm={async () => {
          await guard(() => api.post("/api/v1/billing/cancel-team-subscription"));
          setConfirmCancel(false);
        }}
        onClose={() => setConfirmCancel(false)}
      />
    </section>
  );
}
