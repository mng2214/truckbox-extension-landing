import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CampaignList } from "./agent/CampaignList";
import { CampaignDashboard } from "./agent/CampaignDashboard";

/** One-per-session notice that the Agent is free during beta and will become paid. */
function BetaNotice({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agent beta"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 100%)",
          background: "var(--bg-2)",
          border: "1px solid var(--hairline, rgba(255,255,255,0.1))",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          padding: "1.3rem 1.4rem 1.4rem",
        }}
      >
        <h4 className="ed-display" style={{ fontSize: "1.05rem", margin: "0 0 0.6rem" }}>
          Agent is in free beta
        </h4>
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 1.1rem" }}>
          You're using the Agent for free while it's in beta. Pricing is coming soon — enjoy it
          while it lasts.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="ed-btn" style={{ fontSize: "0.8rem" }} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Standalone "Agent" cabinet tab (admin-only). URL-driven: /business/agent shows the campaign
 * list, /business/agent/:campaignId shows that dashboard (shareable, refresh-safe). New campaigns
 * are still launched from Oracle's "Start outreach with Agent"; this tab has no search of its own.
 */
export function AgentPanel({ campaignId }: { campaignId: number | null }) {
  const navigate = useNavigate();
  const [showBeta, setShowBeta] = useState(
    () =>
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem("tb-agent-beta-seen") !== "1",
  );
  const dismissBeta = () => {
    sessionStorage.setItem("tb-agent-beta-seen", "1");
    setShowBeta(false);
  };

  const beta = showBeta ? <BetaNotice onClose={dismissBeta} /> : null;

  if (campaignId != null && !Number.isNaN(campaignId)) {
    return (
      <>
        {beta}
        <CampaignDashboard campaignId={campaignId} onBack={() => navigate("/business/agent")} />
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {beta}
      <h3 className="ed-display" style={{ fontSize: "1.2rem", margin: 0 }}>
        Agent · my campaigns
      </h3>
      <CampaignList onOpen={(id) => navigate(`/business/agent/${id}`)} />
    </div>
  );
}
