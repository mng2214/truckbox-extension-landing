/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useState } from "react";
import { BROKER_MODE_ENABLED } from "./econModel";
import { FolderOpen, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../ConfirmDialog";
import { usd } from "./format";
import type { QuoteSummary } from "./types";

function when(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function SavedQuotes({
  quotes,
  error,
  openingId,
  onOpen,
  onDelete,
}: {
  quotes: QuoteSummary[] | null;
  error: string | null;
  openingId: number | null;
  onOpen: (id: number) => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<QuoteSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <section className="osw-card" id="osw-saved">
      <div className="osw-card-head">
        <span className="osw-card-title">Saved quotes</span>
        <span className="osw-card-sub">{quotes ? `${quotes.length} saved` : ""}</span>
      </div>
      {error && (
        <p style={{ margin: 0, padding: "12px 18px", fontSize: "0.82rem", color: "var(--osw-danger)" }}>{error}</p>
      )}
      {!quotes && !error && (
        <p style={{ margin: 0, padding: "12px 18px", fontSize: "0.82rem", color: "var(--muted)" }}>Loading…</p>
      )}
      {quotes && quotes.length === 0 && (
        <p style={{ margin: 0, padding: "14px 18px", fontSize: "0.82rem", color: "var(--muted)" }}>
          Nothing saved yet — calculate a lane and press Save quote.
        </p>
      )}
      {quotes && quotes.length > 0 && (
        <div>
          {quotes.map((q) => (
            <div className="osw-quote" key={q.id}>
              <div className="min-w-0">
                <div style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.name}
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--muted)" }} className="md:hidden">
                  {q.origin} → {q.destination}
                </div>
                {q.brokerName && (
                  <div style={{ fontSize: "0.74rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.brokerName}
                    {q.brokerPhone ? ` · ${q.brokerPhone}` : ""}
                  </div>
                )}
              </div>
              <div className="hidden md:block min-w-0" style={{ fontSize: "0.8rem", color: "var(--sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {q.origin} → {q.destination}
              </div>
              <div className="flex items-center gap-2.5 col-start-1 md:col-start-auto md:justify-end" style={{ fontSize: "0.8rem" }}>
                {BROKER_MODE_ENABLED && (
                  <span className="tb-chip is-muted">{q.mode === "broker" ? "Broker" : "Carrier"}</span>
                )}
                <span style={{ fontWeight: 700, minWidth: "4.5rem", textAlign: "right" }}>{usd(q.total)}</span>
                <span className="hidden sm:inline" style={{ color: "var(--muted)", minWidth: "6.5rem", textAlign: "right" }}>{when(q.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end col-start-2 row-start-1 row-span-2 md:col-start-auto md:row-start-auto md:row-span-1">
                <button
                  type="button"
                  className="osw-icon-btn"
                  aria-label={`Open ${q.name}`}
                  title="Open"
                  disabled={openingId != null}
                  onClick={() => onOpen(q.id)}
                >
                  {openingId === q.id ? <span className="tb-spinner" style={{ width: 12, height: 12 }} /> : <FolderOpen size={14} />}
                </button>
                <button
                  type="button"
                  className="osw-icon-btn is-danger"
                  aria-label={`Delete ${q.name}`}
                  title="Delete"
                  onClick={() => setConfirm(q)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirm != null}
        title="Delete this quote?"
        message={confirm ? `“${confirm.name}” will be removed for good.` : ""}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        busy={deleting}
        onConfirm={async () => {
          if (!confirm) return;
          setDeleting(true);
          try {
            await onDelete(confirm.id);
          } finally {
            setDeleting(false);
            setConfirm(null);
          }
        }}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}
