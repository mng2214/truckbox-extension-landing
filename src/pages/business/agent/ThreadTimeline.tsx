import { useState } from "react";
import type { AgentMessage, ThreadStatus } from "./types";
import { isTerminal } from "./types";

/**
 * The agreed progress UX: grey track with event dots, green fill up to the current step, hover a
 * dot to read that email. NEEDS_USER pulses orange; NO_REPLY / final BOUNCED end with a grey ✕.
 */
export function ThreadTimeline({
  messages,
  status,
}: {
  messages: AgentMessage[];
  status: ThreadStatus;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Dots = actual events (each message) + one ghost dot for the expected next step while alive.
  const alive = !isTerminal(status);
  const failedEnd = status === "NO_REPLY" || status === "BOUNCED";
  const dots: { label: string; message?: AgentMessage }[] = messages.map((m) => ({
    label: m.direction === "OUT" ? "sent" : "reply",
    message: m,
  }));
  if (alive) dots.push({ label: status === "NEEDS_USER" ? "you" : "…" });

  const total = Math.max(dots.length, 2);
  const doneCount = messages.length;
  const fillPct = Math.min(100, (Math.max(doneCount - (alive ? 0 : 1), 0) / (total - 1)) * 100);

  return (
    <div style={{ position: "relative", padding: "0.75rem 0 0.25rem" }}>
      <div
        style={{
          position: "relative",
          height: 2,
          background: "var(--hairline, rgba(255,255,255,0.12))",
          borderRadius: 2,
          margin: "0 8px",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct}%`,
            background: "#4caf82",
            borderRadius: 2,
            transition: "width 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "-9px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {dots.map((d, i) => {
            const isGhost = !d.message;
            const needsUser = isGhost && status === "NEEDS_USER";
            const isCross = isGhost && failedEnd;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => d.message && setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => d.message && setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={d.message ? `${d.label}: ${d.message.subject ?? ""}` : d.label}
                style={{
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: d.message ? "pointer" : "default",
                }}
              >
                <span
                  className={needsUser ? "tb-agent-pulse" : undefined}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: d.message
                      ? d.message.direction === "IN"
                        ? "#4caf82"
                        : "var(--accent)"
                      : needsUser
                        ? "#f0a35e"
                        : "transparent",
                    border: d.message
                      ? "none"
                      : needsUser
                        ? "none"
                        : `2px solid var(--hairline, rgba(255,255,255,0.25))`,
                  }}
                >
                  {isCross && (
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: 12,
                        lineHeight: "10px",
                        position: "relative",
                        top: -3,
                        left: 1,
                      }}
                    >
                      ✕
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {hover !== null && dots[hover]?.message && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: "1.6rem",
            left: `${(hover / (total - 1)) * 80}%`,
            maxWidth: 340,
            background: "var(--bg-2)",
            border: "1px solid var(--hairline, rgba(255,255,255,0.12))",
            borderRadius: 10,
            padding: "0.7rem 0.9rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="ed-label" style={{ marginBottom: 4 }}>
            {dots[hover].message!.direction === "OUT" ? "Agent → broker" : "Broker → agent"}
          </div>
          {dots[hover].message!.subject && (
            <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: 4 }}>
              {dots[hover].message!.subject}
            </div>
          )}
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.78rem",
              color: "var(--muted)",
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {dots[hover].message!.body}
          </div>
        </div>
      )}
    </div>
  );
}
