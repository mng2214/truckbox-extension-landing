import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Swiss-styled confirmation dialog — replaces native confirm()/alert() in the cabinet. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Keep it",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: EASE }}
      onClick={busy ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: EASE }}
        style={{
          width: "min(400px, 100%)",
          background: "var(--bg-2)",
          border: "1px solid var(--hairline)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4)",
          padding: "1.5rem",
        }}
      >
        <h3 className="ed-display" style={{ fontSize: "1.15rem", margin: 0 }}>
          {title}
        </h3>
        <p style={{ color: "var(--sub)", fontSize: "0.875rem", lineHeight: 1.5, margin: "0.7rem 0 1.5rem" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button ref={keepRef} type="button" className="ed-btn" disabled={busy} onClick={onClose}>
            <span>{cancelLabel}</span>
          </button>
          <button
            type="button"
            className={"ed-btn" + (destructive ? " is-danger" : " ed-btn-accent")}
            disabled={busy}
            onClick={onConfirm}
          >
            <span>{busy ? "Working…" : confirmLabel}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
