import { useEffect, useState } from "react";
import { listCampaigns } from "./AgentApi";
import type { CampaignSummary } from "./types";

/** Status colour: green = done, yellow = still running, red = cancelled, orange = needs you. */
function statusColor(status: CampaignSummary["status"]): string {
  if (status === "COMPLETED") return "#4caf82";
  if (status === "RUNNING") return "#e0b341";
  if (status === "CANCELLED") return "var(--danger)";
  if (status === "PAUSED_AUTH") return "#f0a35e";
  return "var(--muted)";
}

/** Campaign history list. Self-contained (fetches on mount); calls onOpen when a row is clicked. */
export function CampaignList({ onOpen }: { onOpen: (campaignId: number) => void }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  return (
    <>
      {campaigns === null && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {campaigns?.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          No campaigns yet. Run an Oracle search and hit “Start outreach with Agent”.
        </p>
      )}
      {campaigns?.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
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
            {c.brokerCount} brokers ·{" "}
            <span style={{ color: statusColor(c.status), fontWeight: 600 }}>{c.status}</span>
            {c.startedAt ? ` · ${new Date(c.startedAt).toLocaleDateString()}` : ""}
          </span>
        </button>
      ))}
    </>
  );
}
