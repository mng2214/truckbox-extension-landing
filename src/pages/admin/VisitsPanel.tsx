import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { auth } from "../../lib/auth";
import { usePageMeta } from "../../lib/meta";
import "./visits.css";

type Visitor = {
  visitorKey: string;
  firstSeen: string;
  lastSeen: string;
  events: number;
  visits: number;
  days: number;
  ip: string;
  ipHost: string | null;
  userAgent: string | null;
  device: string;
  timezone: string | null;
  language: string | null;
  screen: string | null;
  referrer: string | null;
  utmSource: string | null;
  eventsSeen: string[];
};

type VisitorEvent = {
  at: string;
  event: string;
  path: string | null;
  ip: string;
  ipHost: string | null;
  sessionId: string | null;
  deviceId: string | null;
  referrer: string | null;
  userAgent: string | null;
  viewport: string | null;
};

const RANGES = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

const when = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const host = (value: string | null) => {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return value.slice(0, 40);
  }
};

export default function VisitsPanel() {
  usePageMeta({
    title: "Demo traffic — TruckBox",
    description: "Internal view of who opens the public demo.",
    path: "/admin/visits",
    noindex: true,
  });

  const [days, setDays] = useState(30);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Visitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, VisitorEvent[]>>({});

  const load = useCallback(() => {
    if (!auth.getToken()) {
      setError("signin");
      setRows([]);
      return;
    }
    setBusy(true);
    setError(null);
    const q = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
    api
      .get<Visitor[]>(`/api/v1/admin/demo-visits?days=${days}&limit=300${q}`)
      .then((data) => setRows(data))
      .catch((e: unknown) => {
        setRows([]);
        setError(e instanceof ApiError && e.status === 403 ? "forbidden" : "failed");
      })
      .finally(() => setBusy(false));
  }, [days, query]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: string) => {
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    if (events[key]) return;
    api
      .get<VisitorEvent[]>(`/api/v1/admin/demo-visits/${encodeURIComponent(key)}`)
      .then((data) => setEvents((prev) => ({ ...prev, [key]: data })))
      .catch(() => setEvents((prev) => ({ ...prev, [key]: [] })));
  };

  const repeat = rows?.filter((r) => r.visits > 1).length ?? 0;

  return (
    <div className="vx">
      <div className="vx-bar">
        <Link className="vx-back" to="/">
          ← TruckBox
        </Link>
        <b className="vx-title">Demo traffic</b>
        <span className="vx-sub">Who opens truckbox.app/demo</span>
      </div>

      <div className="vx-controls">
        <div className="vx-ranges">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={"vx-range" + (days === r.days ? " is-on" : "")}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <input
          className="vx-search"
          value={query}
          placeholder="IP, host, user agent, referrer, time zone"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
        />

        <button type="button" className="vx-refresh" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error === "signin" && (
        <p className="vx-note">
          Sign in as an admin first — <Link to="/business">open the cabinet</Link>, then come back.
        </p>
      )}
      {error === "forbidden" && <p className="vx-note">This account is not an admin.</p>}
      {error === "failed" && <p className="vx-note">Could not load the list. Try again.</p>}

      {rows && rows.length > 0 && (
        <p className="vx-count">
          {rows.length} visitors · {repeat} came back more than once
        </p>
      )}

      {rows && rows.length === 0 && !error && <p className="vx-note">Nothing in this window yet.</p>}

      {rows && rows.length > 0 && (
        <div className="vx-table">
          <div className="vx-head">
            <span>Last seen</span>
            <span>Visits</span>
            <span>Days</span>
            <span>IP</span>
            <span>Network</span>
            <span>Device</span>
            <span>Locale</span>
            <span>From</span>
            <span>Did</span>
          </div>

          {rows.map((r) => (
            <div key={r.visitorKey} className={"vx-row" + (open === r.visitorKey ? " is-open" : "")}>
              <button type="button" className="vx-line" onClick={() => toggle(r.visitorKey)}>
                <span>{when(r.lastSeen)}</span>
                <span className={r.visits > 1 ? "vx-hot" : ""}>{r.visits}</span>
                <span>{r.days}</span>
                <span className="vx-mono">{r.ip}</span>
                <span className="vx-host">{r.ipHost || "—"}</span>
                <span>{r.device}</span>
                <span>
                  {r.timezone || "—"}
                  {r.language ? ` · ${r.language}` : ""}
                </span>
                <span className="vx-host">{host(r.referrer) || r.utmSource || "direct"}</span>
                <span className="vx-events">
                  {r.eventsSeen.map((e) => (
                    <i key={e}>{e}</i>
                  ))}
                </span>
              </button>

              {open === r.visitorKey && (
                <div className="vx-detail">
                  <div className="vx-detail-meta">
                    <span>First seen {when(r.firstSeen)}</span>
                    <span>{r.events} events</span>
                    <span>{r.screen || "—"}</span>
                    <span className="vx-ua">{r.userAgent || "—"}</span>
                  </div>

                  {!events[r.visitorKey] && <p className="vx-note">Loading…</p>}
                  {events[r.visitorKey]?.length === 0 && <p className="vx-note">No rows.</p>}

                  {events[r.visitorKey]?.map((e, i) => (
                    <div className="vx-event" key={i}>
                      <span>{when(e.at)}</span>
                      <span className="vx-tag">{e.event}</span>
                      <span className="vx-mono">{e.ip}</span>
                      <span>{e.viewport || "—"}</span>
                      <span className="vx-host">{e.path || "—"}</span>
                      <span className="vx-mono">{e.sessionId?.slice(0, 8) || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
