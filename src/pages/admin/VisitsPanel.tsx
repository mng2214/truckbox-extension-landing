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
  loadsOpened: number;
  score: number;
  level: "none" | "watch" | "high";
  flags: string[];
  ip: string;
  ipPrefix: string | null;
  blockValue: string | null;
  blocked: boolean;
  ipHost: string | null;
  userAgent: string | null;
  device: string;
  timezone: string | null;
  language: string | null;
  screen: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  eventsSeen: string[];
};

type VisitorEvent = {
  at: string;
  event: string;
  detail: string | null;
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

const blockTarget = (r: Visitor) =>
  r.blockValue || (r.ip.includes(":") ? r.ipPrefix || r.ip : r.ip);

const copy = (text: string) => {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    /* clipboard blocked */
  }
};

const dossier = (r: Visitor, events: VisitorEvent[] | undefined) =>
  [
    `IP            ${r.ip}`,
    `Network       ${r.ipPrefix || "—"}${r.ipHost ? ` (${r.ipHost})` : ""}`,
    `Firewall      ${blockTarget(r)}`,
    `First seen    ${r.firstSeen}`,
    `Last seen     ${r.lastSeen}`,
    `Visits        ${r.visits} across ${r.days} day(s), ${r.events} actions`,
    `Loads opened  ${r.loadsOpened}`,
    `Score         ${r.score} (${r.level})${r.flags.length ? " — " + r.flags.join("; ") : ""}`,
    `Device        ${r.device}`,
    `Locale        ${r.timezone || "—"} · ${r.language || "—"} · ${r.screen || "—"}`,
    `Referrer      ${r.referrer || r.utmSource || "direct"}`,
    `User agent    ${r.userAgent || "—"}`,
    `Used          ${r.eventsSeen.join(", ") || "—"}`,
    "",
    ...(events || []).map(
      (e) => `${e.at}  ${e.event}${e.detail ? "  " + e.detail : ""}  ${e.ip}`,
    ),
  ].join("\n");

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
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [blockList, setBlockList] = useState(false);

  const remember = (what: string) => {
    setCopied(what);
    window.setTimeout(() => setCopied((v) => (v === what ? null : v)), 1600);
  };
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

  const setBlocked = (r: Visitor, blocked: boolean) => {
    const value = blockTarget(r);
    const call = blocked
      ? api.post("/api/v1/admin/demo-visits/blocked", { value, note: r.flags.join("; ") })
      : api.del(`/api/v1/admin/demo-visits/blocked?value=${encodeURIComponent(value)}`);

    setRows(
      (prev) =>
        prev?.map((row) => (blockTarget(row) === value ? { ...row, blocked } : row)) ?? prev,
    );
    call.catch(() => load());
  };

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
  const flagged = rows?.filter((r) => r.level !== "none") ?? [];
  const shown = flaggedOnly ? flagged : (rows ?? []);

  const targets = [...new Set(shown.map(blockTarget))];
  const plainList = targets.join("\n");
  const cloudflareRule = targets.length ? `(ip.src in {${targets.join(" ")}})` : "";

  if (error === "signin" || error === "forbidden") {
    return (
      <div className="vx vx-blank">
        <b className="vx-blank-code">404</b>
        <p className="vx-blank-text">This page does not exist.</p>
        <Link className="vx-back" to="/">
          ← TruckBox
        </Link>
      </div>
    );
  }

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
          placeholder="IP, network, host, user agent, referrer, time zone"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
        />

        <button
          type="button"
          className={"vx-refresh vx-toggle" + (flaggedOnly ? " is-on" : "")}
          onClick={() => setFlaggedOnly((v) => !v)}
        >
          Worth a look{flagged.length ? ` (${flagged.length})` : ""}
        </button>

        {targets.length > 0 && (
          <button
            type="button"
            className={"vx-refresh vx-toggle" + (blockList ? " is-on" : "")}
            onClick={() => setBlockList((v) => !v)}
          >
            Block list ({targets.length})
          </button>
        )}

        <button type="button" className="vx-refresh" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error === "failed" && <p className="vx-note">Could not load the list. Try again.</p>}

      {blockList && targets.length > 0 && (
        <div className="vx-blocklist">
          <div className="vx-blocklist-head">
            <b>Ready to paste</b>
            <span>
              {flaggedOnly ? "flagged visitors" : "everything currently listed"} ·{" "}
              {targets.length} address{targets.length === 1 ? "" : "es"}
            </span>
            <button
              type="button"
              className="vx-action"
              onClick={() => {
                copy(plainList);
                remember("plain");
              }}
            >
              {copied === "plain" ? "Copied" : "Copy list"}
            </button>
            <button
              type="button"
              className="vx-action"
              onClick={() => {
                copy(cloudflareRule);
                remember("cf");
              }}
            >
              {copied === "cf" ? "Copied" : "Copy Cloudflare rule"}
            </button>
          </div>

          <pre className="vx-blocklist-body">{plainList}</pre>

          <p className="vx-blocklist-note">
            Vercel → Firewall → IP Blocking: one entry per line, Host <code>truckbox.app</code>.
            Cloudflare → WAF → Custom rules: paste the expression, action Block. IPv6 is given as
            the /64 because the address itself rotates; IPv4 is given exactly, since a /24 would
            catch unrelated people.
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <p className="vx-count">
          {rows.length} visitors · {repeat} came back more than once · {flagged.length} worth a look
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

          {shown.map((r) => (
            <div
              key={r.visitorKey}
              className={
                "vx-row vx-level-" + r.level + (open === r.visitorKey ? " is-open" : "")
              }
            >
              <button type="button" className="vx-line" onClick={() => toggle(r.visitorKey)}>
                <span className="vx-when">
                  {r.blocked && <i className="vx-mark is-blocked">B</i>}
                  {r.level !== "none" && (
                    <i className="vx-mark" title={r.flags.join(" · ")}>
                      {r.score}
                    </i>
                  )}
                  {when(r.lastSeen)}
                </span>
                <span className={r.visits > 1 ? "vx-hot" : ""}>{r.visits}</span>
                <span>{r.days}</span>
                <span className="vx-ip">
                  <span className="vx-mono" title={r.ip}>
                    {r.ip}
                  </span>
                  <i
                    className="vx-copy"
                    role="button"
                    tabIndex={-1}
                    title={"Copy " + blockTarget(r) + " for a firewall rule"}
                    onClick={(e) => {
                      e.stopPropagation();
                      copy(blockTarget(r));
                      remember(r.visitorKey);
                    }}
                  >
                    {copied === r.visitorKey ? "ok" : "copy"}
                  </i>
                </span>
                <span className="vx-host" title={r.ipHost || r.ipPrefix || ""}>
                  {r.ipHost || r.ipPrefix || "—"}
                </span>
                <span>{r.device}</span>
                <span>
                  {r.timezone || "—"}
                  {r.language ? ` · ${r.language}` : ""}
                </span>
                <span className="vx-host" title={r.utmCampaign || r.referrer || ""}>
                  {r.utmSource || host(r.referrer) || "direct"}
                </span>
                <span className="vx-events">
                  {r.eventsSeen.map((e) => (
                    <i key={e}>{e}</i>
                  ))}
                </span>
              </button>

              {open === r.visitorKey && (
                <div className="vx-detail">
                  {r.flags.length > 0 && (
                    <div className={"vx-why vx-why-" + r.level}>
                      <b>{r.level === "high" ? "Well past normal interest" : "A closer look than most"}</b>
                      <ul>
                        {r.flags.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="vx-actions">
                    {[
                      { id: "ip", label: "Copy IP", value: r.ip },
                      { id: "net", label: "Copy network", value: r.ipPrefix || r.ip },
                      { id: "ua", label: "Copy user agent", value: r.userAgent || "" },
                      { id: "all", label: "Copy everything", value: dossier(r, events[r.visitorKey]) },
                    ].map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="vx-action"
                        onClick={() => {
                          copy(action.value);
                          remember(r.visitorKey + action.id);
                        }}
                      >
                        {copied === r.visitorKey + action.id ? "Copied" : action.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      className={"vx-action" + (r.blocked ? " is-blocked" : "")}
                      onClick={() => setBlocked(r, !r.blocked)}
                    >
                      {r.blocked ? "Unblock" : "Mark blocked"}
                    </button>
                  </div>

                  <div className="vx-block">
                    <span>Firewall value</span>
                    <code>{blockTarget(r)}</code>
                    <span className="vx-block-note">
                      {r.ip.includes(":")
                        ? "the /64 — an IPv6 address rotates daily, the prefix does not"
                        : "the exact address — a /24 would also catch unrelated people"}
                    </span>
                  </div>

                  <div className="vx-detail-meta">
                    <span>First seen {when(r.firstSeen)}</span>
                    <span>{r.events} events</span>
                    <span>{r.loadsOpened} loads opened</span>
                    <span>
                      Source {r.utmSource || "—"}
                      {r.utmMedium ? ` · ${r.utmMedium}` : ""}
                      {r.utmCampaign ? ` · ${r.utmCampaign}` : ""}
                    </span>
                    <span>{r.screen || "—"}</span>
                    <span className="vx-ua">{r.userAgent || "—"}</span>
                  </div>

                  {!events[r.visitorKey] && <p className="vx-note">Loading…</p>}
                  {events[r.visitorKey]?.length === 0 && <p className="vx-note">No rows.</p>}

                  {events[r.visitorKey]?.map((e, i) => (
                    <div className="vx-event" key={i}>
                      <span>{when(e.at)}</span>
                      <span className="vx-tag">{e.event}</span>
                      <span className="vx-what">{e.detail || "—"}</span>
                      <span className="vx-mono">{e.ip}</span>
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
