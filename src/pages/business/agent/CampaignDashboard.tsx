import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelCampaign, getCampaign, stopThread } from "./AgentApi";
import { ConsentCard } from "./ConsentCard";
import { ThreadTimeline } from "./ThreadTimeline";
import type { AgentThread, CampaignDetail, ThreadStatus } from "./types";
import { isTerminal, stripQuotedTail } from "./types";

const STATUS_LABEL: Record<ThreadStatus, string> = {
  QUEUED: "queued",
  DRAFTING: "writing",
  SENT: "sent",
  AWAITING_REPLY: "awaiting reply",
  FOLLOW_UP_SENT: "bumped",
  REPLIED: "replied",
  ANALYZING: "analyzing",
  NEEDS_USER: "needs you",
  DONE: "done",
  NO_REPLY: "no reply",
  BOUNCED: "bounced",
  RETRY_NEXT_CONTACT: "retrying",
  STOPPED: "stopped",
};

function chipColor(s: ThreadStatus): string {
  if (s === "DONE") return "#4caf82";
  if (s === "NEEDS_USER") return "#f0a35e";
  if (s === "NO_REPLY" || s === "BOUNCED" || s === "STOPPED") return "var(--muted)";
  return "var(--accent)";
}

function ExtractedTable({ raw }: { raw: string }) {
  const fields = useMemo(() => {
    try {
      const obj = JSON.parse(raw) as Record<string, string>;
      return Object.entries(obj).filter(([, v]) => v && String(v).trim());
    } catch {
      return [];
    }
  }, [raw]);
  if (!fields.length) return null;
  return (
    <table style={{ fontSize: "0.78rem", marginTop: 6 }}>
      <tbody>
        {fields.map(([k, v]) => (
          <tr key={k}>
            <td className="ed-label" style={{ paddingRight: 12, whiteSpace: "nowrap" }}>
              {k.replace(/_/g, " ")}
            </td>
            <td style={{ color: "var(--ink)" }}>{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Styled confirm popup (mobile-friendly) — used where an action cannot be undone. */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
          padding: "1.2rem 1.3rem 1.3rem",
        }}
      >
        <h4 className="ed-display" style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
          {title}
        </h4>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.45, margin: "0 0 1rem" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="ed-btn" style={{ fontSize: "0.8rem" }} onClick={onClose}>
            Keep it
          </button>
          <button
            className="ed-btn"
            style={{ fontSize: "0.8rem", color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThreadCard({ thread, onStopped }: { thread: AgentThread; onStopped: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  return (
    <div
      style={{
        background: "var(--bg-2)",
        borderRadius: 12,
        padding: "0.8rem 1rem",
        border: "1px solid var(--hairline, rgba(255,255,255,0.06))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600 }}>{thread.brokerName || thread.contactEmail}</span>
        <span
          style={{
            fontSize: "0.72rem",
            color: chipColor(thread.status),
            border: `1px solid ${chipColor(thread.status)}`,
            borderRadius: 999,
            padding: "1px 8px",
          }}
        >
          {STATUS_LABEL[thread.status]}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
          {thread.contactEmail}
          {thread.contactReason?.startsWith("LANE_POSTER")
            ? ` · ${thread.contactReason.toLowerCase()}`
            : thread.contactReason === "ROUTING_PROBE"
              ? " · asking who runs the lane"
              : ""}
        </span>
        <span style={{ flex: 1 }} />
        {!isTerminal(thread.status) && (
          <button
            className="ed-btn"
            style={{ fontSize: "0.72rem" }}
            onClick={() => setConfirmStop(true)}
          >
            Stop
          </button>
        )}
        {confirmStop && (
          <ConfirmDialog
            title="Stop this conversation?"
            message={`The agent will stop emailing ${thread.brokerName || thread.contactEmail}. A stopped conversation cannot be resumed.`}
            confirmLabel="Stop conversation"
            onConfirm={() => stopThread(thread.id).then(onStopped)}
            onClose={() => setConfirmStop(false)}
          />
        )}
        <button className="ed-btn" style={{ fontSize: "0.72rem" }} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Conversation"}
        </button>
      </div>

      <ThreadTimeline messages={thread.messages} status={thread.status} />
      {thread.extracted && <ExtractedTable raw={thread.extracted} />}

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {thread.messages.map((m, i) => (
            <div
              key={i}
              style={{
                borderLeft: `2px solid ${m.direction === "IN" ? "#4caf82" : "var(--accent)"}`,
                paddingLeft: 10,
              }}
            >
              <div className="ed-label">
                {m.direction === "OUT" ? "Agent" : "Broker"}
                {m.sentAt ? ` · ${new Date(m.sentAt).toLocaleString()}` : ""}
              </div>
              {m.subject && <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{m.subject}</div>}
              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.78rem", color: "var(--muted)" }}>
                {stripQuotedTail(m.body)}
              </div>
            </div>
          ))}
          {!thread.messages.length && (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Nothing sent yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CampaignDashboard({
  campaignId,
  onBack,
}: {
  campaignId: number;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [tab, setTab] = useState<"threads" | "report">("threads");
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(
    () =>
      getCampaign(campaignId)
        .then((d) => {
          setDetail(d);
          setError(null);
        })
        .catch(() => setError("Failed to load the campaign.")),
    [campaignId],
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000); // poll while the tab is open
    return () => clearInterval(t);
  }, [load]);

  if (!detail) {
    return <p style={{ color: error ? "var(--danger)" : "var(--muted)" }}>{error ?? "Loading…"}</p>;
  }

  const { summary, threads, reportMd } = detail;
  const terminal = threads.filter((t) => isTerminal(t.status)).length;
  const pct = threads.length ? Math.round((terminal / threads.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <style>{`
        .tb-agent-pulse { animation: tbAgentPulse 1.6s ease-in-out infinite; }
        @keyframes tbAgentPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @media (prefers-reduced-motion: reduce) { .tb-agent-pulse { animation: none } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="ed-btn" onClick={onBack} style={{ fontSize: "0.8rem" }}>
          ← Campaigns
        </button>
        <h3 className="ed-display" style={{ fontSize: "1.15rem", margin: 0 }}>
          {summary.origin} → {summary.destination}
        </h3>
        <span
          style={{
            fontSize: "0.72rem",
            color: summary.status === "RUNNING" ? "#4caf82" : "var(--muted)",
            border: "1px solid currentColor",
            borderRadius: 999,
            padding: "1px 8px",
          }}
        >
          {summary.status === "PAUSED_AUTH" ? "PAUSED — reconnect Google" : summary.status}
        </span>
        {summary.status === "RUNNING" && (
          <button
            className="ed-btn"
            style={{ fontSize: "0.75rem" }}
            onClick={() => setConfirmCancel(true)}
          >
            Cancel campaign
          </button>
        )}
        {confirmCancel && (
          <ConfirmDialog
            title="Cancel this campaign?"
            message="All conversations will be stopped and cannot be resumed. Brokers already contacted stay under the cooldown."
            confirmLabel="Cancel campaign"
            onConfirm={() => cancelCampaign(campaignId).then(load)}
            onClose={() => setConfirmCancel(false)}
          />
        )}
      </div>

      {summary.status === "PAUSED_AUTH" && (
        <ConsentCard connected={false} onConnected={load} />
      )}

      <div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--hairline, rgba(255,255,255,0.1))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "#4caf82",
              transition: "width 400ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
        <div className="ed-label" style={{ marginTop: 4 }}>
          {terminal}/{threads.length} conversations finished
          {summary.status === "RUNNING" && " · you'll get an email when the report is ready"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          className="ed-btn"
          style={{ fontSize: "0.78rem", opacity: tab === "threads" ? 1 : 0.6 }}
          onClick={() => setTab("threads")}
        >
          Conversations
        </button>
        <button
          className="ed-btn"
          style={{ fontSize: "0.78rem", opacity: tab === "report" ? 1 : 0.6 }}
          onClick={() => setTab("report")}
          disabled={!reportMd}
        >
          Report{reportMd ? "" : " (pending)"}
        </button>
      </div>

      {tab === "threads" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {threads.map((t) => (
            <ThreadCard key={t.id} thread={t} onStopped={load} />
          ))}
          {!threads.length && <p style={{ color: "var(--muted)" }}>No conversations yet.</p>}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.6rem" }}>
            <button
              className="ed-btn"
              style={{ fontSize: "0.75rem" }}
              onClick={() => window.print()}
              disabled={!reportMd}
            >
              Download PDF
            </button>
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              background: "var(--bg-2)",
              borderRadius: 12,
              padding: "1rem 1.25rem",
              margin: 0,
            }}
          >
            {reportMd}
          </pre>
          <div id="tb-report-print">
            {`${summary.origin} to ${summary.destination}\n\n${reportMd ?? ""}`}
          </div>
        </div>
      )}
    </div>
  );
}
