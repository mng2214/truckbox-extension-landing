import { useState } from "react";
import { api, ApiError } from "../lib/api";

const ERR: Record<number, string> = {
  1024: "This number is already linked to another account.",
  1025: "Virtual or temporary numbers are not supported. Use a real mobile number.",
  1026: "Wrong or expired code.",
  1027: "Enter a valid phone number with country code.",
  1028: "Too many attempts. Please wait and try again.",
};

export function PhoneVerify({ onVerified }: { onVerified: () => void }) {
  const [phone, setPhone] = useState("+1");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const explain = (e: unknown) =>
    e instanceof ApiError && e.code && ERR[e.code] ? ERR[e.code] : "Something went wrong.";

  const send = async () => {
    setMsg(null);
    setLoading(true);
    try {
      await api.post("/api/v1/auth/phone/start", { phone });
      setSent(true);
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setMsg(null);
    setLoading(true);
    try {
      await api.post("/api/v1/auth/phone/confirm", { phone, code });
      onVerified();
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <h2 className="ed-display text-[2rem]" style={{ color: "var(--ink)" }}>
        Verify your phone
      </h2>
      <p style={{ color: "var(--muted)" }}>
        We will text you a code. Virtual or temporary numbers will not work.
      </p>

      {!sent ? (
        <>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="pv-phone"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Phone number
            </label>
            <input
              id="pv-phone"
              className="ed-input"
              type="tel"
              inputMode="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            className="ed-btn ed-btn-accent"
            onClick={send}
            disabled={loading || !phone.trim()}
            style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Sending…" : "Send code"}
          </button>
        </>
      ) : (
        <>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Code sent to <span style={{ color: "var(--ink)" }}>{phone}</span>.{" "}
            <button
              onClick={() => { setSent(false); setMsg(null); setCode(""); }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--accent)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Change
            </button>
          </p>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="pv-code"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Verification code
            </label>
            <input
              id="pv-code"
              className="ed-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              autoFocus
            />
          </div>
          <button
            className="ed-btn ed-btn-accent"
            onClick={confirm}
            disabled={loading || code.length < 4}
            style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </>
      )}

      {msg && (
        <p
          style={{
            color: "var(--danger, #c0392b)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
            letterSpacing: "0.04em",
            borderLeft: "2px solid var(--danger, #c0392b)",
            paddingLeft: "12px",
          }}
        >
          {msg}
        </p>
      )}

      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.78rem",
          borderTop: "1px solid var(--hairline)",
          paddingTop: "12px",
          marginTop: "4px",
        }}
      >
        Standard SMS rates may apply. We never share your number.
      </p>
    </div>
  );
}
