import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { auth } from "../../lib/auth";

const INSTALL_URL =
  "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd";
const SUPPORT_TELEGRAM = "https://t.me/mngartur";

// Smaller, centered action button (overrides the default full-width ed-btn in a flex column).
const ctaStyle: React.CSSProperties = {
  alignSelf: "center",
  padding: "13px 34px",
  fontSize: "0.74rem",
};

type Country = { iso: string; name: string; dial: string };

// Freight-first ordering (US/CA/MX), then a broad common set.
const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "MX", name: "Mexico", dial: "+52" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "NL", name: "Netherlands", dial: "+31" },
  { iso: "PL", name: "Poland", dial: "+48" },
  { iso: "UA", name: "Ukraine", dial: "+380" },
  { iso: "RO", name: "Romania", dial: "+40" },
  { iso: "PT", name: "Portugal", dial: "+351" },
  { iso: "RU", name: "Russia", dial: "+7" },
  { iso: "GE", name: "Georgia", dial: "+995" },
  { iso: "AM", name: "Armenia", dial: "+374" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "PK", name: "Pakistan", dial: "+92" },
  { iso: "PH", name: "Philippines", dial: "+63" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "AR", name: "Argentina", dial: "+54" },
  { iso: "CO", name: "Colombia", dial: "+57" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
  { iso: "NG", name: "Nigeria", dial: "+234" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "TR", name: "Turkey", dial: "+90" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "KR", name: "South Korea", dial: "+82" },
];

const flagOf = (iso: string) =>
  iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

// Pretty-print the national number as you type. +1 → (312) 555-0134; others → groups of 3.
function formatNational(raw: string, dial: string): string {
  const d = raw.replace(/\D/g, "");
  if (dial === "+1") {
    const a = d.slice(0, 3);
    const b = d.slice(3, 6);
    const c = d.slice(6, 10);
    if (d.length > 6) return `(${a}) ${b}-${c}`;
    if (d.length > 3) return `(${a}) ${b}`;
    if (d.length > 0) return `(${a}`;
    return "";
  }
  return (d.match(/.{1,3}/g) ?? []).join(" ");
}

/**
 * Phone verification step shown when login returns a verification-scoped token (unverified user).
 * Uses the verification token (already in storage) to call /auth/phone/start then /confirm; the
 * confirm response carries the full token, after which the cabinet loads normally.
 */
export function PhoneVerify({
  onVerified,
  onSignOut,
}: {
  onVerified: () => void;
  onSignOut?: () => void;
}) {
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = country.dial + national.replace(/\D/g, "");

  const sendCode = async () => {
    if (national.replace(/\D/g, "").length < 5) {
      setError("Enter your phone number.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/v1/auth/phone/start", { phone: e164 });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : "Couldn't send the code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!code.trim()) {
      setError("Enter the code from the SMS.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ token: string }>("/api/v1/auth/phone/confirm", {
        phone: e164,
        code: code.trim(),
      });
      auth.setToken(res.token);
      onVerified();
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full" style={{ maxWidth: "26rem" }}>
        <span className="ed-label">One last step</span>
        <h1
          className="ed-display mt-3"
          style={{ fontSize: "clamp(2rem, 7vw, 2.6rem)", color: "var(--ink)" }}
        >
          Verify your phone
        </h1>
        <div className="mt-7 flex flex-col gap-4">
          {!sent ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="ed-label" style={{ color: "var(--ink)" }}>
                  Phone number
                </span>
                <div className="flex items-stretch gap-2">
                  <CountrySelect value={country} onChange={setCountry} />
                  <input
                    className="ed-input tb-sharp"
                    type="tel"
                    inputMode="numeric"
                    value={formatNational(national, country.dial)}
                    onChange={(e) => setNational(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => {
                      // Allow only digits + control/navigation keys.
                      if (
                        e.key.length === 1 &&
                        !/\d/.test(e.key) &&
                        !e.ctrlKey &&
                        !e.metaKey
                      ) {
                        e.preventDefault();
                      }
                    }}
                    placeholder={country.dial === "+1" ? "(312) 555-0134" : "312 555 0134"}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <button
                className="ed-btn ed-btn-accent"
                style={ctaStyle}
                disabled={loading}
                onClick={sendCode}
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-2">
                <span className="ed-label" style={{ color: "var(--ink)" }}>
                  Verification code
                </span>
                <input
                  className="ed-input tb-sharp"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                />
              </label>
              <button
                className="ed-btn ed-btn-accent"
                style={ctaStyle}
                disabled={loading}
                onClick={confirm}
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ← Use a different number
              </button>
            </>
          )}

          {error && (
            <span style={{ color: "var(--danger, #ef6b6b)", fontSize: "0.85rem" }}>{error}</span>
          )}
        </div>

        <p
          className="mt-6 pt-5"
          style={{
            color: "var(--muted)",
            fontSize: "0.82rem",
            lineHeight: 1.5,
            textAlign: "center",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          Prefer the extension?{" "}
          <a href={INSTALL_URL} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            Install TruckBox
          </a>{" "}
          and verify your phone there.
        </p>

        <p
          className="mt-3"
          style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5, textAlign: "center" }}
        >
          Need help?{" "}
          <a href={SUPPORT_TELEGRAM} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            Message us on Telegram
          </a>
        </p>

        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 mx-auto block"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              fontSize: "0.82rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
}: {
  value: Country;
  onChange: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase() === q
    );
  }, [query]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ed-input tb-sharp"
        style={{
          width: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{flagOf(value.iso)}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{value.dial}</span>
        <ChevronDown size={14} style={{ color: "var(--muted)" }} />
      </button>

      {open && (
        <div className="tb-ac-menu" style={{ width: "16rem", maxHeight: "300px", padding: "8px" }}>
          <input
            className="ed-input tb-sharp"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country or code"
            style={{ marginBottom: "6px" }}
          />
          {filtered.map((c) => (
            <button
              key={c.iso}
              type="button"
              className="tb-ac-item"
              onClick={() => {
                onChange(c);
                setOpen(false);
                setQuery("");
              }}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{flagOf(c.iso)}</span>
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                {c.dial}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
