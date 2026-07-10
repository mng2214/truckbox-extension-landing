import { useEffect, useState } from "react";
import { listCampaigns } from "./AgentApi";
import { CampaignDashboard } from "./CampaignDashboard";
import { CampaignDraftScreen } from "./CampaignDraft";
import type { CampaignSummary } from "./types";

type View =
  | { kind: "list" }
  | { kind: "draft"; requestId: number }
  | { kind: "dashboard"; campaignId: number };

/**
 * The Agent area inside the Discovery panel: campaign history, the draft/confirm screen (entered
 * from a search result) and the live dashboard. Rendered only after the stealth probe passed.
 */
export function AgentSection({
  initialRequestId,
  connected,
  onConnected,
  onClose,
}: {
  initialRequestId: number | null;
  connected: boolean;
  onConnected: () => void;
  onClose?: () => void; // absent = standalone Agent tab (no "back to search")
}) {
  const [view, setView] = useState<View>(
    initialRequestId != null ? { kind: "draft", requestId: initialRequestId } : { kind: "list" },
  );
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);

  useEffect(() => {
    if (view.kind === "list") {
      listCampaigns()
        .then(setCampaigns)
        .catch(() => setCampaigns([]));
    }
  }, [view.kind]);

  if (view.kind === "draft") {
    return (
      <CampaignDraftScreen
        requestId={view.requestId}
        connected={connected}
        onConnected={onConnected}
        onStarted={(id) => setView({ kind: "dashboard", campaignId: id })}
        onBack={onClose ?? (() => setView({ kind: "list" }))}
      />
    );
  }

  if (view.kind === "dashboard") {
    return (
      <CampaignDashboard
        campaignId={view.campaignId}
        onBack={() => setView({ kind: "list" })}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {onClose && (
          <button className="ed-btn" onClick={onClose} style={{ fontSize: "0.8rem" }}>
            ← Search
          </button>
        )}
        <h3 className="ed-display" style={{ fontSize: "1.2rem", margin: 0 }}>
          Agent · my campaigns
        </h3>
      </div>
      {campaigns === null && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {campaigns?.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          No campaigns yet. Run an Oracle search and hit “Start outreach with Agent”.
        </p>
      )}
      {campaigns?.map((c) => (
        <button
          key={c.id}
          onClick={() => setView({ kind: "dashboard", campaignId: c.id })}
          style={{
            textAlign: "left",
            background: "var(--bg-2)",
            border: "1px solid var(--hairline, rgba(255,255,255,0.06))",
            borderRadius: 10,
            padding: "0.7rem 1rem",
            cursor: "pointer",
            color: "var(--ink)",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {c.origin} → {c.destination}
          </span>
          <span style={{ color: "var(--muted)", marginLeft: 10, fontSize: "0.78rem" }}>
            {c.brokerCount} brokers · {c.status}
            {c.startedAt ? ` · ${new Date(c.startedAt).toLocaleDateString()}` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
