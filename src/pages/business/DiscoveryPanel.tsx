import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Copy, MapPin, Mail, Phone, Search } from "lucide-react";
import { api, ApiError } from "../../lib/api";

const EASE = [0.16, 1, 0.3, 1] as const;

type SideMode = "city" | "state";

const STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

type BrokerRow = {
  origin: string;
  destination: string;
  equipment: string | null;
  brokerId: number | null;
  brokerName: string | null;
  mcNumber: string | null;
  activeDays30d: number;
  totalReposted30d: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  lastPrice: number | null;
  avgRatePerMile: number | null;
  brokerEmails: string | null;
  brokerPhones: string | null;
};

type BrokerGroup = {
  key: string;
  name: string;
  mcNumber: string | null;
  emails: string | null;
  phones: string | null;
  lanes: BrokerRow[];
  totalReposts: number;
  activeDays: number;
  minPrice: number | null;
  maxPrice: number | null;
};

type Quota = { used: number; limit: number | null; unlimited: boolean };

const usd = (n: number | null) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");

// Fire-and-forget usage analytics (broker opens, contact copies). Never blocks the UI and
// swallows errors — the backend endpoint is gated + fail-safe, and a lost event is harmless.
function trackEvent(payload: {
  eventType: string;
  brokerId?: number | null;
  mcNumber?: string | null;
  origin?: string;
  destination?: string;
  equipment?: string | null;
}) {
  api.post("/api/v1/discovery/event", payload).catch(() => {});
}

function groupByBroker(rows: BrokerRow[]): BrokerGroup[] {
  const map = new Map<string, BrokerGroup>();
  for (const r of rows) {
    const key = r.brokerId != null ? `id:${r.brokerId}` : `name:${r.brokerName ?? "?"}`;
    let g = map.get(key);
    if (!g) {
      const fallbackName =
        r.brokerName ??
        (r.mcNumber ? `MC ${r.mcNumber}` : null) ??
        r.brokerEmails?.split(",")[0].trim() ??
        "Unknown broker";
      g = {
        key,
        name: fallbackName,
        mcNumber: r.mcNumber,
        emails: r.brokerEmails,
        phones: r.brokerPhones,
        lanes: [],
        totalReposts: 0,
        activeDays: 0,
        minPrice: null,
        maxPrice: null,
      };
      map.set(key, g);
    }
    g.lanes.push(r);
    g.totalReposts += r.totalReposted30d;
    g.activeDays = Math.max(g.activeDays, r.activeDays30d);
    if (r.minPrice != null) g.minPrice = g.minPrice == null ? r.minPrice : Math.min(g.minPrice, r.minPrice);
    if (r.maxPrice != null) g.maxPrice = g.maxPrice == null ? r.maxPrice : Math.max(g.maxPrice, r.maxPrice);
  }
  return [...map.values()].sort(
    (a, b) => b.activeDays - a.activeDays || b.totalReposts - a.totalReposts
  );
}

export function DiscoveryPanel() {
  const [oMode, setOMode] = useState<SideMode>("city");
  const [oValue, setOValue] = useState("");
  const [oRadius, setORadius] = useState(100);
  const [dMode, setDMode] = useState<SideMode>("city");
  const [dValue, setDValue] = useState("");
  const [dRadius, setDRadius] = useState(100);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [minActiveDays, setMinActiveDays] = useState(2);

  const [rows, setRows] = useState<BrokerRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [quota, setQuota] = useState<Quota | null>(null);
  const reduce = useReducedMotion();

  const fetchQuota = () =>
    api
      .get<Quota>("/api/v1/discovery/quota")
      .then(setQuota)
      .catch(() => {});

  useEffect(() => {
    fetchQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showDemo, setShowDemo] = useState(() => {
    try {
      return sessionStorage.getItem("oracle_demo_seen") !== "1";
    } catch {
      return true;
    }
  });
  const dismissDemo = () => {
    try {
      sessionStorage.setItem("oracle_demo_seen", "1");
    } catch {
      /* ignore */
    }
    setShowDemo(false);
  };

  const groups = useMemo(() => (rows ? groupByBroker(rows) : []), [rows]);

  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  // Toggle a broker card; log an OPEN_BROKER event only on the open transition.
  const toggleBroker = (g: BrokerGroup) => {
    const wasOpen = expanded.has(g.key);
    toggle(g.key);
    if (!wasOpen) {
      trackEvent({
        eventType: "OPEN_BROKER_ORACLE",
        brokerId: g.lanes[0]?.brokerId ?? null,
        mcNumber: g.mcNumber,
        origin: oValue.trim(),
        destination: dValue.trim(),
        equipment: g.lanes[0]?.equipment ?? null,
      });
    }
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oValue.trim() || !dValue.trim()) {
      setError("Choose both an origin and a destination.");
      return;
    }
    setLoading(true);
    setError(null);
    const started = Date.now();
    try {
      const result = await api.post<BrokerRow[]>("/api/v1/discovery/search", {
        origin: oValue.trim(),
        destination: dValue.trim(),
        originRadius: oMode === "city" ? oRadius : null,
        destRadius: dMode === "city" ? dRadius : null,
        equipment: equipment.length ? equipment : null,
        minActiveDays,
      });
      // Hold the "thinking" loader for at least 3s, even if the API is faster.
      const wait = 3000 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setRows(result);
      setExpanded(new Set());
      fetchQuota();
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : "Search failed. Try again.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col">
      {showDemo && (
        <div
          onClick={dismissDemo}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            background: "rgba(3, 6, 12, 0.66)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "420px",
              width: "100%",
              background: "var(--bg-2)",
              border: "1px solid var(--hairline)",
              padding: "1.8rem",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <span className="ed-label">Heads up</span>
            <h2
              className="ed-display"
              style={{ fontSize: "1.7rem", color: "var(--ink)", marginTop: "0.55rem" }}
            >
              Demo feature
            </h2>
            <p style={{ color: "var(--muted)", marginTop: "0.8rem", lineHeight: 1.55 }}>
              Oracle is an early demo. It may work intermittently or be temporarily unavailable
              while we refine it.
            </p>
            <button
              className="ed-btn ed-btn-accent"
              style={{ marginTop: "1.5rem" }}
              onClick={dismissDemo}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ---- header ---- */}

      <h1 className="ed-display mt-3" style={{ fontSize: "clamp(2.2rem, 6vw, 3rem)", color: "var(--ink)" }}>
        Oracle
      </h1>
      <p className="ed-label mt-2.5">Dedicated lanes discovery</p>
      {quota && (
        <span
          className="mt-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            color: "var(--muted)",
            border: "1px solid var(--hairline)",
            padding: "3px 9px",
            alignSelf: "flex-start",
          }}
        >
          {quota.unlimited ? (
            <>Searches today: <span style={{ color: "var(--accent)" }}>Unlimited</span></>
          ) : (
            <>
              Searches today:{" "}
              <span style={{ color: "var(--accent)" }}>
                {quota.used} / {quota.limit ?? "—"}
              </span>
            </>
          )}
        </span>
      )}

      {/* ---- query ---- */}
      <form onSubmit={run} className="mt-9 flex flex-col gap-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
          <CorridorSide
            label="Origin"
            mode={oMode}
            setMode={setOMode}
            value={oValue}
            setValue={setOValue}
            radius={oRadius}
            setRadius={setORadius}
          />
          <CorridorSide
            label="Destination"
            mode={dMode}
            setMode={setDMode}
            value={dValue}
            setValue={setDValue}
            radius={dRadius}
            setRadius={setDRadius}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <div className="flex flex-col gap-2.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="ed-label" style={{ color: "var(--ink)" }}>Equipment (optional )</span>
            </span>
            <EquipmentSelect value={equipment} onChange={setEquipment} />
          </div>
          <Field label="Min active days" hint="reposted on ≥ N days · 30d">
            <input
              type="number"
              min={1}
              max={30}
              className="ed-input tb-sharp"
              value={minActiveDays}
              onChange={(e) => setMinActiveDays(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        </div>

        <div className="flex items-center gap-5 pt-1">
          <button type="submit" className="ed-btn ed-btn-accent" disabled={loading}>
            <Search size={15} strokeWidth={2.4} />
            <span>{loading ? "Searching" : "Search lanes"}</span>
          </button>
          {error && (
            <span style={{ color: "var(--danger, #ef6b6b)", fontSize: "0.85rem" }}>{error}</span>
          )}
        </div>
      </form>

      {/* ---- thinking loader ---- */}
      {loading && (
        <div
          className="flex flex-col items-center justify-center gap-6"
          style={{ padding: "4rem 0" }}
        >
          <span className="tb-oracle-loader" />
          <span className="ed-label">Reading the lanes…</span>
        </div>
      )}

      {/* ---- results ---- */}
      {!loading && rows && (
        <div className="mt-12">
          <div
            className="flex items-baseline justify-between pb-3"
            style={{ borderBottom: "1px solid var(--ink)" }}
          >
            <span className="ed-label" style={{ color: "var(--ink)" }}>
              {groups.length} broker{groups.length === 1 ? "" : "s"}
            </span>
            <span className="ed-label">
              {rows.length} lane{rows.length === 1 ? "" : "s"}
            </span>
          </div>

          {groups.length === 0 && (
            <p className="pt-5" style={{ color: "var(--muted)" }}>
              No reachable brokers on this corridor. Widen the radius or lower min active days.
            </p>
          )}

          {groups.map((g, i) => {
            const open = expanded.has(g.key);
            const emails = g.emails ? g.emails.split(",").map((s) => s.trim()).filter(Boolean) : [];
            const phones = g.phones ? g.phones.split(",").map((s) => s.trim()).filter(Boolean) : [];
            return (
              <motion.div
                key={g.key}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? { duration: 0 } : { duration: 0.35, ease: EASE, delay: Math.min(i * 0.025, 0.25) }}
                style={{ borderBottom: "1px solid var(--hairline)" }}
              >
                <button
                  onClick={() => toggleBroker(g)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-4 text-left"
                  style={{
                    background: "transparent",
                    cursor: "pointer",
                    padding: "1.05rem 0.25rem 1.05rem 1rem",
                    borderLeft: `2px solid ${open ? "var(--accent)" : "transparent"}`,
                    transition: "border-color .25s var(--ease)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.72rem",
                      color: "var(--muted)",
                      width: "1.8rem",
                      flexShrink: 0,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2.5 flex-wrap">
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                          fontSize: "1.06rem",
                          color: "var(--ink)",
                        }}
                      >
                        {g.name}
                      </span>
                      {g.mcNumber && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.82rem",
                            letterSpacing: "0.04em",
                            color: "var(--muted)",
                          }}
                        >
                          MC {g.mcNumber}
                        </span>
                      )}
                    </span>
                    <span
                      className="flex items-center gap-2.5 mt-1.5 flex-wrap"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted)" }}
                    >
                      <span>{g.lanes.length} lane{g.lanes.length === 1 ? "" : "s"}</span>
                      <Dot />
                      <span>{g.totalReposts} reposts</span>
                      <Dot />
                      <span>{g.activeDays}d active</span>
                      {g.minPrice != null && (
                        <>
                          <Dot />
                          <span style={{ color: "var(--accent)" }}>
                            {usd(g.minPrice)}–{usd(g.maxPrice)}
                          </span>
                        </>
                      )}
                    </span>
                  </span>

                  <ChevronDown
                    size={17}
                    style={{
                      color: open ? "var(--accent)" : "var(--muted)",
                      transition: "transform .25s var(--ease), color .25s var(--ease)",
                      transform: open ? "rotate(180deg)" : "none",
                      flexShrink: 0,
                    }}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="flex flex-col gap-4 pb-5 pl-4 sm:pl-[3.8rem]">
                        <ContactList
                          emails={emails}
                          phones={phones}
                          onCopy={() =>
                            trackEvent({
                              eventType: "COPY_CONTACT",
                              brokerId: g.lanes[0]?.brokerId ?? null,
                              mcNumber: g.mcNumber,
                              origin: oValue.trim(),
                              destination: dValue.trim(),
                            })
                          }
                        />

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" style={{ minWidth: "30rem" }}>
                            <thead>
                              <tr style={{ color: "var(--muted)" }}>
                                <th className="text-left font-normal py-1.5" style={thLabel}>Lane</th>
                                <th className="text-right font-normal py-1.5" style={thLabel}>Days</th>
                                <th className="text-right font-normal py-1.5" style={thLabel}>Reposts</th>
                                <th className="text-right font-normal py-1.5" style={thLabel}>Avg</th>
                                <th className="text-right font-normal py-1.5" style={thLabel}>Last</th>
                                <th className="text-right font-normal py-1.5" style={thLabel}>RPM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.lanes.map((l, j) => (
                                <tr key={j} style={{ borderTop: "1px solid var(--hairline)" }}>
                                  <td className="py-1.5" style={{ color: "var(--ink)" }}>
                                    <span className="inline-flex items-center gap-1.5">
                                      <MapPin size={12} style={{ color: "var(--accent)" }} />
                                      {l.origin} → {l.destination}
                                      {l.equipment && (
                                        <span style={{ color: "var(--muted)" }}>· {l.equipment}</span>
                                      )}
                                      <CopyButton
                                        text={`${l.origin} → ${l.destination}`}
                                        label="Copy lane"
                                      />
                                    </span>
                                  </td>
                                  <td className="text-right py-1.5" style={mono("var(--ink)")}>{l.activeDays30d}</td>
                                  <td className="text-right py-1.5" style={mono("var(--ink)")}>{l.totalReposted30d}</td>
                                  <td className="text-right py-1.5" style={mono("var(--ink)")}>{usd(l.avgPrice)}</td>
                                  <td className="text-right py-1.5" style={mono("var(--accent)")}>{usd(l.lastPrice)}</td>
                                  <td className="text-right py-1.5" style={mono("var(--muted)")}>
                                    {l.avgRatePerMile == null ? "—" : l.avgRatePerMile.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CorridorSide({
  label,
  mode,
  setMode,
  value,
  setValue,
  radius,
  setRadius,
}: {
  label: string;
  mode: SideMode;
  setMode: (m: SideMode) => void;
  value: string;
  setValue: (v: string) => void;
  radius: number;
  setRadius: (n: number) => void;
}) {
  const isState = mode === "state";
  const switchMode = (m: SideMode) => {
    if (m !== mode) {
      setMode(m);
      setValue("");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="ed-label" style={{ color: "var(--ink)" }}>{label}</span>
        <div className="tb-seg" role="tablist" aria-label={`${label} type`}>
          <button type="button" className={mode === "city" ? "is-active" : ""} onClick={() => switchMode("city")}>
            City
          </button>
          <button type="button" className={isState ? "is-active" : ""} onClick={() => switchMode("state")}>
            State
          </button>
        </div>
      </div>

      {isState ? (
        <select className="ed-input tb-sharp" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Select state…</option>
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      ) : (
        <CityAutocomplete value={value} onChange={setValue} placeholder={`${label} city, e.g. Chicago, IL`} />
      )}

      <div style={{ opacity: isState ? 0.4 : 1, transition: "opacity .2s ease" }}>
        <div className="flex items-baseline justify-between mb-1.5">
          <span style={miniLabel}>Radius</span>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            {isState ? (
              "whole state"
            ) : (
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{radius} mi</span>
            )}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={250}
          value={radius}
          disabled={isState}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="tb-range"
          style={
            {
              width: "100%",
              cursor: isState ? "not-allowed" : "pointer",
              "--val": `${((radius - 1) / 249) * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}

function CityAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const skip = useRef(false); // skip the fetch triggered by selecting a suggestion

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get<string[]>(`/api/v1/discovery/cities?q=${encodeURIComponent(q)}`);
        setSuggestions(res);
        setOpen(res.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div style={{ position: "relative" }}>
      <input
        className="ed-input tb-sharp"
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && suggestions.length > 0 && (
        <ul className="tb-ac-menu">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="tb-ac-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  skip.current = true;
                  onChange(s);
                  setOpen(false);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const EQ_COMMON = ["V", "VR", "R", "F", "SD", "LO", "RG"];
const EQ_MORE = [
  "AC", "C", "CI", "CR", "DD", "LA", "DT", "FA", "BT", "F2", "FZ", "FR", "MX", "FS", "FT", "FM",
  "FD", "HB", "LB", "MV", "NU", "PQ", "RM", "ST", "TA", "TM", "TS", "TT", "VI", "VA", "VS", "VC",
  "V2", "VH", "VN", "VG", "VL", "OT", "VB", "IR", "RW", "FC", "RP", "VF", "LR", "VP", "SR", "CV",
  "FO", "CN", "FN", "SN", "SB",
];

function EquipmentSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  const chip = (code: string) => (
    <button
      key={code}
      type="button"
      className={"tb-eq" + (value.includes(code) ? " is-on" : "")}
      onClick={() => toggle(code)}
    >
      {code}
    </button>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((code) => (
          <span key={code} className="tb-eq is-on">
            {code}
            <button
              type="button"
              className="tb-eq-x"
              aria-label={`Remove ${code}`}
              onClick={() => toggle(code)}
            >
              ×
            </button>
          </span>
        ))}
        <button type="button" className="tb-eq-add" onClick={() => setOpen((o) => !o)}>
          {value.length ? "+ Add" : "+ Equipment"}
        </button>
      </div>

      {open && (
        <div className="tb-ac-menu" style={{ padding: "14px", maxHeight: "320px" }}>
          <div className="ed-label">Common</div>
          <div className="flex flex-wrap gap-2 mt-2.5">{EQ_COMMON.map(chip)}</div>
          <div className="ed-label mt-4 block" style={{ marginTop: "1rem" }}>
            All types
          </div>
          <div className="flex flex-wrap gap-2 mt-2.5">{EQ_MORE.map(chip)}</div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="ed-label" style={{ color: "var(--ink)" }}>{label}</span>
        {hint && <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function CopyButton({ text, label, onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
      onCopied?.();
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      className={"tb-copy" + (done ? " is-done" : "")}
      onClick={copy}
      aria-label={label ?? "Copy"}
      title={label ?? "Copy"}
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function ContactList({
  emails,
  phones,
  onCopy,
}: {
  emails: string[];
  phones: string[];
  onCopy?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 3;
  const all = [
    ...emails.map((value) => ({ kind: "email" as const, value })),
    ...phones.map((value) => ({ kind: "phone" as const, value })),
  ];
  if (all.length === 0) return null;

  const visible = showAll ? all : all.slice(0, PREVIEW);
  const hidden = all.length - PREVIEW;

  return (
    <div className="flex flex-col gap-1.5" style={{ fontSize: "0.83rem" }}>
      {visible.map((c) => (
        <ContactItem
          key={c.kind + c.value}
          icon={c.kind === "email" ? <Mail size={13} /> : <Phone size={13} />}
          value={c.value}
          onCopy={onCopy}
        />
      ))}
      {all.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="flex items-center gap-1.5 self-start mt-0.5"
          style={{
            background: "transparent",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            letterSpacing: "0.04em",
            color: "var(--muted)",
            transition: "color .2s var(--ease)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
        >
          <ChevronDown
            size={13}
            style={{
              transform: showAll ? "rotate(180deg)" : "none",
              transition: "transform .2s var(--ease)",
            }}
          />
          {showAll ? "Show less" : `+${hidden} more contact${hidden === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function ContactItem({
  icon,
  value,
  onCopy,
}: {
  icon: React.ReactNode;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <span className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <span style={{ color: "var(--ink)", wordBreak: "break-word", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
        {value}
      </span>
      <CopyButton text={value} label={`Copy ${value}`} onCopied={onCopy} />
    </span>
  );
}

function Dot() {
  return <span style={{ color: "var(--hairline)" }}>·</span>;
}

const miniLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.62rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--muted)",
};

const thLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.64rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const mono = (color: string): React.CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontSize: "0.82rem",
  color,
});
