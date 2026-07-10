import { useEffect, useState } from "react";
import { probeAgent } from "./agent/AgentApi";
import { AgentSection } from "./agent/AgentSection";

/**
 * Standalone "Agent" cabinet tab (admin-only, for testing). Shows the campaign list and
 * dashboards. New campaigns are launched from Oracle's "Start outreach with Agent" button
 * (a campaign must anchor to a discovery search), so this tab has no search of its own.
 */
export function AgentPanel() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    probeAgent().then((r) => setConnected(r.connected));
  }, []);

  return (
    <AgentSection
      initialRequestId={null}
      connected={connected}
      onConnected={() => setConnected(true)}
    />
  );
}
