/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/meta";
import { readAdminTheme, writeAdminTheme } from "./theme";
import "./visits.css";

type Intruder = {
  visitorKey: string;
  firstSeen: string;
  lastSeen: string;
  hits: number;
  days: number;
  ip: string;
  ipPrefix: string | null;
  ipHost: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  asn: number | null;
  networkType: "tor" | "hosting" | "mobile" | "isp" | null;
  secondsOnPage: number;
  device: string;
  userAgent: string | null;
  timezone: string | null;
  language: string | null;
  screen: string | null;
  referrer: string | null;
  userId: number | null;
  userEmail: string | null;
  paths: string[];
  eventsSeen: string[];
  seenInDemo: boolean;
  reviewed: boolean;
  newSinceReview: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type IntrusionEvent = {
  at: string;
  event: string;
  path: string | null;
  ip: string;
  ipHost: string | null;
  country: string | null;
  city: string | null;
  asn: number | null;
  durationSeconds: number | null;
  userEmail: string | null;
  sessionId: string | null;
  deviceId: string | null;
  referrer: string | null;
  userAgent: string | null;
  viewport: string | null;
};

type IntrusionEvents = { total: number; events: IntrusionEvent[] };

const PAGE = 300;
const EVENTS_SHOWN = 200;

const RANGES = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const EVENT_LABELS: Record<string, string> = {
  open: "opened",
  login: "pressed log in",
  reveal: "saw the video",
  admin_denied: "real admin, refused",
  leave: "left",
  copy: "copied text",
  devtools: "opened DevTools",
};

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

const copy = (text: string) => {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    return;
  }
};

const levelOf = (visitor: Intruder) =>
  visitor.userEmail
    ? "high"
    : visitor.eventsSeen.includes("login") || visitor.eventsSeen.includes("admin_denied")
      ? "watch"
      : "none";

const NETWORK_LABELS: Record<string, string> = {
  tor: "Tor",
  hosting: "hosting / VPN",
  mobile: "mobile carrier",
  isp: "home or office ISP",
};

const place = (visitor: Intruder) =>
  [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") || null;

const network = (visitor: Intruder) =>
  [
    place(visitor),
    visitor.networkType ? NETWORK_LABELS[visitor.networkType] : null,
    visitor.asn ? `AS${visitor.asn}` : null,
    visitor.ipHost || visitor.ipPrefix,
  ]
    .filter(Boolean)
    .join(" · ") || "—";

const duration = (seconds: number) =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

const dossier = (visitor: Intruder, events: IntrusionEvent[] | undefined) =>
  [
    `IP            ${visitor.ip}`,
    `Network       ${network(visitor)}`,
    `Account       ${visitor.userEmail ? `${visitor.userEmail} (id ${visitor.userId})` : "not signed in"}`,
    `First seen    ${visitor.firstSeen}`,
    `Last seen     ${visitor.lastSeen}`,
    `Hits          ${visitor.hits} across ${visitor.days} day(s)`,
    `Time on page  ${visitor.secondsOnPage ? duration(visitor.secondsOnPage) : "—"}`,
    `Tried         ${visitor.paths.join(", ") || "—"}`,
    `Did           ${visitor.eventsSeen.map((event) => EVENT_LABELS[event] || event).join(", ") || "—"}`,
    `Seen in demo  ${visitor.seenInDemo ? "yes" : "no"}`,
    `Device        ${visitor.device}`,
    `Locale        ${visitor.timezone || "—"} · ${visitor.language || "—"} · ${visitor.screen || "—"}`,
    `Referrer      ${visitor.referrer || "direct"}`,
    `User agent    ${visitor.userAgent || "—"}`,
    "",
    ...(events || []).map(
      (event) => `${event.at}  ${event.event}  ${event.path || "—"}  ${event.ip}`,
    ),
  ].join("\n");

export default function IntrusionsPanel() {
  usePageMeta({
    title: "Suspicious activity — TruckBox",
    description: "Internal view of people who tried the admin addresses.",
    path: "/admin2214/intrusions",
    noindex: true,
  });

  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Intruder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, IntrusionEvents>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [day, setDay] = useState(readAdminTheme);
  const [hideReviewed, setHideReviewed] = useState(false);
  const [reviewFailed, setReviewFailed] = useState(false);

  const flipTheme = () => {
    setDay((was) => {
      writeAdminTheme(!was);
      return !was;
    });
  };

  const remember = (what: string) => {
    setCopied(what);
    window.setTimeout(() => setCopied((current) => (current === what ? null : current)), 1600);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const requestKey = `${days}|${query.trim()}|${reloads}`;
  const busy = loadedKey !== requestKey;

  useEffect(() => {
    let alive = true;
    const filter = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
    api
      .get<Intruder[]>(`/api/v1/admin/intrusions?days=${days}&limit=${PAGE}${filter}`)
      .then((data) => {
        if (!alive) return;
        setRows(data ?? []);
        setFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setFailed(true);
      })
      .finally(() => {
        if (alive) setLoadedKey(requestKey);
      });
    return () => {
      alive = false;
    };
  }, [days, query, requestKey]);

  const toggle = (key: string) => {
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    if (events[key]) return;
    api
      .get<IntrusionEvents>(
        `/api/v1/admin/intrusions/${encodeURIComponent(key)}?limit=${EVENTS_SHOWN}`,
      )
      .then((data) =>
        setEvents((previous) => ({
          ...previous,
          [key]: { total: data?.total ?? 0, events: data?.events ?? [] },
        })),
      )
      .catch(() => setEvents((previous) => ({ ...previous, [key]: { total: 0, events: [] } })));
  };

  const setReviewed = (visitor: Intruder, reviewed: boolean) => {
    const key = visitor.visitorKey;
    const apply = (value: boolean) =>
      setRows(
        (previous) =>
          previous?.map((row) =>
            row.visitorKey === key
              ? {
                  ...row,
                  reviewed: value,
                  newSinceReview: false,
                  reviewedAt: value ? new Date().toISOString() : null,
                }
              : row,
          ) ?? previous,
      );
    apply(reviewed);
    setReviewFailed(false);
    const path = `/api/v1/admin/intrusions/${encodeURIComponent(key)}/review`;
    (reviewed ? api.put(path) : api.del(path)).catch(() => {
      apply(!reviewed);
      setReviewFailed(true);
    });
  };

  const all = rows ?? [];
  const shown = hideReviewed ? all.filter((visitor) => !visitor.reviewed) : all;
  const unreviewed = all.filter((visitor) => !visitor.reviewed).length;
  const signedIn = all.filter((visitor) => visitor.userEmail).length;
  const pressedLogin = all.filter((visitor) => visitor.eventsSeen.includes("login")).length;
  const alsoDemo = all.filter((visitor) => visitor.seenInDemo).length;

  return (
    <div className={"vx" + (day ? " is-day" : "")}>
      <div className="vx-bar">
        <Link className="vx-back" to="/admin2214">
          ← Admin
        </Link>
        <b className="vx-title">Suspicious activity</b>
        <button type="button" className="vx-theme" onClick={flipTheme}>
          {day ? "night" : "day"}
        </button>
      </div>

      <div className="vx-controls">
        <div className="vx-ranges">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              className={"vx-range" + (days === range.days ? " is-on" : "")}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>

        <input
          className="vx-search"
          value={search}
          placeholder="IP, network, city, AS number, account email, address tried, user agent"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setQuery(event.currentTarget.value);
          }}
        />

        <button
          type="button"
          className={"vx-refresh vx-toggle" + (hideReviewed ? " is-on" : "")}
          onClick={() => setHideReviewed((value) => !value)}
        >
          {hideReviewed ? "Show checked" : "Hide checked"}
        </button>

        <button
          type="button"
          className="vx-refresh"
          onClick={() => setReloads((count) => count + 1)}
          disabled={busy}
        >
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      <p className="vx-note">
        People in a real browser who opened an admin address: the decoy pages, or the real admin
        without access. Bots are stopped earlier by the Vercel firewall and are not in this list.
      </p>

      {failed && <p className="vx-note is-bad">Could not load the list. Try again.</p>}
      {reviewFailed && (
        <p className="vx-note is-bad">The check was not saved — the request failed. Try again.</p>
      )}
      {busy && <div className="vx-progress" aria-label="Loading" />}

      {rows && rows.length >= PAGE && (
        <p className="vx-truncated">
          Showing the latest {PAGE}. Narrow the period or search to see the rest.
        </p>
      )}

      {rows && rows.length > 0 && (
        <p className="vx-count">
          {`${rows.length} visitors · ${unreviewed} not checked · ${signedIn} signed in to TruckBox · ${pressedLogin} pressed Log in · ${alsoDemo} also seen in the demo`}
        </p>
      )}

      {rows && rows.length === 0 && !failed && !busy && (
        <p className="vx-note">Nobody in this window yet.</p>
      )}

      {rows && rows.length > 0 && shown.length === 0 && (
        <p className="vx-note">Everything in this window is checked.</p>
      )}

      {shown.length > 0 && (
        <div className={"vx-table vx-table-intrusions" + (busy ? " is-busy" : "")}>
          <div className="vx-head">
            <span>Last seen</span>
            <span>Hits</span>
            <span>Days</span>
            <span>IP</span>
            <span>Network</span>
            <span>Device</span>
            <span>Account</span>
            <span>Tried</span>
            <span>Did</span>
          </div>

          {shown.map((visitor) => (
            <div
              key={visitor.visitorKey}
              className={
                "vx-row vx-level-" +
                levelOf(visitor) +
                (visitor.reviewed ? " is-reviewed" : "") +
                (open === visitor.visitorKey ? " is-open" : "")
              }
            >
              <button
                type="button"
                className="vx-line"
                onClick={() => toggle(visitor.visitorKey)}
              >
                <span className="vx-when">
                  <i
                    className={"vx-check" + (visitor.reviewed ? " is-on" : "")}
                    role="checkbox"
                    aria-checked={visitor.reviewed}
                    aria-label="Checked"
                    tabIndex={-1}
                    title={visitor.reviewed ? "Checked — click to uncheck" : "Mark as checked"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setReviewed(visitor, !visitor.reviewed);
                    }}
                  >
                    ✓
                  </i>
                  {visitor.newSinceReview && (
                    <i className="vx-mark is-new" title="New activity since you last checked">
                      new
                    </i>
                  )}
                  {(visitor.networkType === "tor" || visitor.networkType === "hosting") && (
                    <i
                      className="vx-mark"
                      title={NETWORK_LABELS[visitor.networkType]}
                    >
                      {visitor.networkType === "tor" ? "tor" : "vpn"}
                    </i>
                  )}
                  {visitor.seenInDemo && (
                    <i className="vx-mark" title="Same network or device opened the demo">
                      demo
                    </i>
                  )}
                  <span className="vx-when-date">{when(visitor.lastSeen)}</span>
                </span>
                <span className={visitor.hits > 1 ? "vx-hot" : ""}>{visitor.hits}</span>
                <span>{visitor.days}</span>
                <span className="vx-ip">
                  <span className="vx-mono" title={visitor.ip}>
                    {visitor.ip}
                  </span>
                  <i
                    className="vx-copy"
                    role="button"
                    tabIndex={-1}
                    title={"Copy " + visitor.ip}
                    onClick={(event) => {
                      event.stopPropagation();
                      copy(visitor.ip);
                      remember(visitor.visitorKey);
                    }}
                  >
                    {copied === visitor.visitorKey ? "ok" : "copy"}
                  </i>
                </span>
                <span className="vx-host" title={network(visitor)}>
                  {network(visitor)}
                </span>
                <span>{visitor.device}</span>
                <span className="vx-host" title={visitor.userEmail || ""}>
                  {visitor.userEmail || "—"}
                </span>
                <span className="vx-host" title={visitor.paths.join("\n")}>
                  {visitor.paths.join(", ") || "—"}
                </span>
                <span className="vx-events">
                  {visitor.eventsSeen.map((event) => (
                    <i key={event}>{EVENT_LABELS[event] || event}</i>
                  ))}
                </span>
              </button>

              {open === visitor.visitorKey && (
                <div className="vx-detail">
                  <div className="vx-actions">
                    {[
                      { id: "ip", label: "Copy IP", value: visitor.ip },
                      { id: "net", label: "Copy network", value: visitor.ipPrefix || visitor.ip },
                      { id: "ua", label: "Copy user agent", value: visitor.userAgent || "" },
                      {
                        id: "all",
                        label: "Copy everything",
                        value: dossier(visitor, events[visitor.visitorKey]?.events),
                      },
                    ].map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="vx-action"
                        onClick={() => {
                          copy(action.value);
                          remember(visitor.visitorKey + action.id);
                        }}
                      >
                        {copied === visitor.visitorKey + action.id ? "Copied" : action.label}
                      </button>
                    ))}

                    <button
                      type="button"
                      className={"vx-action" + (visitor.reviewed ? " is-blocked" : "")}
                      onClick={() => setReviewed(visitor, !visitor.reviewed)}
                    >
                      {visitor.reviewed ? "Uncheck" : "Mark as checked"}
                    </button>
                  </div>

                  <div className="vx-detail-meta">
                    <span>First seen {when(visitor.firstSeen)}</span>
                    <span>
                      On page {visitor.secondsOnPage ? duration(visitor.secondsOnPage) : "—"}
                    </span>
                    <span>{place(visitor) || "Location unknown"}</span>
                    <span>
                      {visitor.networkType ? NETWORK_LABELS[visitor.networkType] : "Network type unknown"}
                      {visitor.asn ? (
                        <>
                          {" · "}
                          <a
                            href={`https://bgp.he.net/AS${visitor.asn}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            AS{visitor.asn}
                          </a>
                        </>
                      ) : null}
                    </span>
                    <span>
                      {visitor.userEmail
                        ? `Account ${visitor.userEmail} · id ${visitor.userId}`
                        : "Not signed in"}
                    </span>
                    <span>{visitor.seenInDemo ? "Also opened the demo" : "Not seen in the demo"}</span>
                    <span>
                      {visitor.reviewedAt
                        ? `${visitor.reviewed ? "Checked" : "Last checked"} ${when(visitor.reviewedAt)}${visitor.reviewedBy ? ` by ${visitor.reviewedBy}` : ""}${visitor.newSinceReview ? " — new activity since" : ""}`
                        : "Not checked yet"}
                    </span>
                    <span>
                      {visitor.timezone || "—"} · {visitor.language || "—"} · {visitor.screen || "—"}
                    </span>
                    <span>From {visitor.referrer || "direct"}</span>
                    <span className="vx-ua">{visitor.userAgent || "—"}</span>
                  </div>

                  {!events[visitor.visitorKey] && <p className="vx-note">Loading…</p>}
                  {events[visitor.visitorKey]?.events.length === 0 && (
                    <p className="vx-note">No rows.</p>
                  )}
                  {(events[visitor.visitorKey]?.total ?? 0) > EVENTS_SHOWN && (
                    <p className="vx-note">
                      Showing the last {EVENTS_SHOWN} of {events[visitor.visitorKey]?.total}.
                    </p>
                  )}

                  {events[visitor.visitorKey]?.events.map((event, index) => (
                    <div className="vx-event" key={index}>
                      <span>{when(event.at)}</span>
                      <span className="vx-tag">{EVENT_LABELS[event.event] || event.event}</span>
                      <span className="vx-what">{event.path || "—"}</span>
                      <span className="vx-mono">{event.ip}</span>
                      <span className="vx-host">
                        {[event.city, event.country].filter(Boolean).join(", ") || "—"}
                        {event.durationSeconds != null ? ` · ${duration(event.durationSeconds)}` : ""}
                      </span>
                      <span className="vx-mono">{event.sessionId?.slice(0, 8) || "—"}</span>
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
