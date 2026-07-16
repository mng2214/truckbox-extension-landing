import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../lib/api";
import { confirmCampaign, createDraft } from "./AgentApi";
import { ConsentCard } from "./ConsentCard";
import type { CampaignDraft as Draft } from "./types";

/**
 * The single consent moment of a campaign: the ranked broker list (agent's pre-checks), the MC
 * gate when the profile has none, and one Start button. After Start the agent runs unattended.
 */
export function CampaignDraftScreen({
  requestId,
  connected,
  onConnected,
  onStarted,
  onBack,
}: {
  requestId: number;
  connected: boolean;
  onConnected: () => void;
  onStarted: (campaignId: number) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [mc, setMc] = useState("");
  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    createDraft(requestId)
      .then((d) => {
        if (!alive) return;
        setDraft(d);
        setChecked(new Set(d.brokers.filter((b) => b.preChecked).map((b) => b.brokerId)));
      })
      .catch((e) =>
        alive ? setError(e instanceof ApiError && e.message ? e.message : "Failed to load") : null,
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [requestId]);

  const overLimit = useMemo(
    () => (draft ? checked.size > draft.maxBrokers : false),
    [draft, checked],
  );

  const toggle = (brokerId: number, available: boolean) => {
    if (!available) return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(brokerId) ? next.delete(brokerId) : next.add(brokerId);
      return next;
    });
  };

  const start = async () => {
    if (!draft) return;
    setStarting(true);
    setError(null);
    try {
      const summary = await confirmCampaign(
        draft.campaignId,
        [...checked],
        draft.mcRequired ? mc.trim() || null : null,
        draft.companyRequired ? company.trim() || null : null,
        draft.firstNameRequired ? firstName.trim() || null : null,
      );
      onStarted(summary.id);
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : "Could not start the campaign.");
      setStarting(false);
    }
  };

  if (loading) return <p style={{ color: "var(--muted)" }}>Preparing the broker list…</p>;
  if (!draft) return <p style={{ color: "var(--danger)" }}>{error ?? "Failed to load."}</p>;

  const startDisabled =
    starting ||
    checked.size === 0 ||
    overLimit ||
    !connected ||
    (draft.mcRequired && !mc.trim()) ||
    (draft.companyRequired && !company.trim()) ||
    (draft.firstNameRequired && !firstName.trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
        <button className="ed-btn" onClick={onBack} style={{ fontSize: "0.8rem" }}>
          ← Back
        </button>
        <h3 className="ed-display" style={{ fontSize: "1.2rem", margin: 0 }}>
          Agent · pick brokers to contact
        </h3>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
        The Agent emails each selected broker from your address, asks about frequency, price and
        pickup/delivery details, and builds you a report. Info-gathering only — it never quotes a
        rate or books anything.
      </p>

      <ConsentCard connected={connected} onConnected={onConnected} />

      {(draft.firstNameRequired || draft.companyRequired || draft.mcRequired) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span className="ed-label" style={{ color: "var(--muted)" }}>
            Your details
          </span>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {draft.firstNameRequired && (
              <input
                className="ed-input"
                placeholder="Your first name"
                title="The agent signs emails with this name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ maxWidth: 180 }}
              />
            )}
            {draft.companyRequired && (
              <input
                className="ed-input"
                placeholder="Company name"
                title="Used in your reply address, e.g. smart-freight_…@truckbox.app"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            )}
            {draft.mcRequired && (
              <input
                className="ed-input"
                placeholder="Your MC #"
                value={mc}
                onChange={(e) => setMc(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {draft.brokers.map((b) => {
          const on = checked.has(b.brokerId);
          return (
            <label
              key={`${b.brokerId}-${b.origin}-${b.destination}`}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                background: "var(--bg-2)",
                borderRadius: 10,
                padding: "0.6rem 0.9rem",
                opacity: b.available ? 1 : 0.45,
                cursor: b.available ? "pointer" : "not-allowed",
                border: on
                  ? "1px solid var(--accent)"
                  : "1px solid var(--hairline, rgba(255,255,255,0.06))",
              }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={!b.available}
                onChange={() => toggle(b.brokerId, b.available)}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{b.brokerName || "Unnamed broker"}</span>
                {b.mcNumber && (
                  <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: "0.8rem" }}>
                    MC {b.mcNumber}
                  </span>
                )}
                <span style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem" }}>
                  {b.origin} → {b.destination} · active {b.activeDays30d}d · {b.totalReposted30d}{" "}
                  posts
                </span>
                <span style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem" }}>
                  {b.available
                    ? `→ ${b.plannedEmail ?? ""} ${
                        b.plannedReason?.startsWith("ROUTING_PROBE")
                          ? "(will ask who runs the lane)"
                          : b.plannedReason
                            ? `(${b.plannedReason.toLowerCase()})`
                            : ""
                      }`
                    : "recently contacted or opted out — unavailable"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <span
          className="ed-label"
          style={{ color: overLimit ? "var(--danger)" : "var(--muted)" }}
        >
          {draft.maxBrokers >= 100000
            ? `${checked.size} brokers`
            : `${checked.size}/${draft.maxBrokers} brokers`}
        </span>
        <button className="ed-btn ed-btn-accent" onClick={start} disabled={startDisabled}>
          {starting ? "Starting…" : "Start the Agent"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>}
    </div>
  );
}
