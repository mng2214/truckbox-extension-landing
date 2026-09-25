/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { auth } from "../../lib/auth";
import { usePageMeta } from "../../lib/meta";
import { readAdminTheme, writeAdminTheme } from "./theme";
import "./visits.css";

type DayCounts = { date: string; counts: Record<string, number> };

type Usage = {
  days: number;
  from: string;
  to: string;
  series: DayCounts[];
  totals: Record<string, number>;
  previousTotals: Record<string, number>;
  activeUsers: number;
  previousActiveUsers: number;
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/* ===== What each tile and chart is made of ============================== */

const MANUAL = "EMAIL_SENT";
const AUTO = "EMAIL_SENT_AUTO";

const CREDIT = ["RTS_CREDIT_CHECK", "TRIUMPH_CREDIT_CHECK", "APEX_CREDIT_CHECK"];

type Metric = { id: string; label: string; types: string[]; note?: string };

const TILES: Metric[] = [
  { id: "emails", label: "Emails sent", types: [MANUAL, AUTO] },
  { id: "auto", label: "By Auto Emailer", types: [AUTO] },
  { id: "credit", label: "Credit checks", types: CREDIT },
  { id: "maps", label: "Route maps", types: ["MAP_VIEWED"] },
  { id: "calls", label: "Calls placed", types: ["PHONE_CALL"] },
  { id: "lane", label: "Lane analytics", types: ["LANE_ANALYTICS"] },
];

const SMALL: Metric[] = [
  { id: "credit", label: "Credit checks", types: CREDIT, note: "RTS · Triumph · Apex" },
  { id: "maps", label: "Route maps", types: ["MAP_VIEWED"] },
  { id: "calls", label: "Calls placed", types: ["PHONE_CALL"] },
  { id: "lane", label: "Lane analytics", types: ["LANE_ANALYTICS"] },
  { id: "today", label: "Today's price", types: ["TODAY_PRICE_ANALYTICS"] },
  { id: "tolls", label: "Toll lookups", types: ["TOLL_ESTIMATE"], note: "provider calls only" },
];

const TABLE_ROWS: Metric[] = [
  { id: "manual", label: "Emails — one click", types: [MANUAL] },
  { id: "auto", label: "Emails — Auto Emailer", types: [AUTO] },
  { id: "rts", label: "Credit check — RTS", types: ["RTS_CREDIT_CHECK"] },
  { id: "triumph", label: "Credit check — Triumph", types: ["TRIUMPH_CREDIT_CHECK"] },
  { id: "apex", label: "Credit check — Apex", types: ["APEX_CREDIT_CHECK"] },
  { id: "maps", label: "Route maps", types: ["MAP_VIEWED"] },
  { id: "calls", label: "Calls placed", types: ["PHONE_CALL"] },
  { id: "lane", label: "Lane analytics", types: ["LANE_ANALYTICS"] },
  { id: "today", label: "Today's price", types: ["TODAY_PRICE_ANALYTICS"] },
  { id: "tolls", label: "Toll lookups", types: ["TOLL_ESTIMATE"] },
  { id: "fuel", label: "Diesel price", types: ["FUEL_PRICE"] },
];

const sum = (counts: Record<string, number> | undefined, types: string[]) =>
  types.reduce((total, type) => total + (counts?.[type] ?? 0), 0);

const shortDate = (iso: string) => {
  const date = new Date(iso + "T00:00:00");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const num = (value: number) => value.toLocaleString("en-US");

function change(now: number, before: number): { text: string; tone: string } {
  if (before === 0) return now === 0 ? { text: "—", tone: "flat" } : { text: "new", tone: "up" };
  const percent = Math.round(((now - before) / before) * 100);
  if (percent === 0) return { text: "0%", tone: "flat" };
  return { text: (percent > 0 ? "+" : "") + percent + "%", tone: percent > 0 ? "up" : "down" };
}

/* ===== Chart primitives ================================================= */

/** A bar with its top corners rounded and its base square on the axis. */
function barPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, Math.max(height, 0));
  if (height <= 0) return "";
  return (
    `M${x} ${y + height} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} ` +
    `L${x + width - r} ${y} Q${x + width} ${y} ${x + width} ${y + r} ` +
    `L${x + width} ${y + height} Z`
  );
}

function niceTop(max: number): number {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    const candidate = step * factor;
    if (candidate >= max) return candidate;
  }
  return step * 10;
}

/** Which chart the pointer is in, so one shared state does not draw a tooltip on every card. */
type Hover = {
  owner: string;
  left: number;
  top: number;
  title: string;
  rows: { label: string; value: number; color?: string }[];
};

function EmailChart({ series, onHover }: { series: DayCounts[]; onHover: (hover: Hover | null) => void }) {
  const W = 1000;
  const H = 300;
  const PAD = { top: 22, right: 16, bottom: 30, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const top = niceTop(Math.max(...series.map((d) => sum(d.counts, [MANUAL, AUTO])), 0));
  const slot = plotW / Math.max(series.length, 1);
  const barW = Math.max(3, Math.min(34, slot * 0.62));
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const ticks = [0, top / 2, top];

  const peak = series.reduce(
    (best, day, index) => (sum(day.counts, [MANUAL, AUTO]) > best.value ? { index, value: sum(day.counts, [MANUAL, AUTO]) } : best),
    { index: -1, value: 0 }
  );

  // Label every nth day, and the last one only when it would not collide with the nth before it.
  const labelEvery = Math.ceil(series.length / 8);
  const labelled = new Set<number>();
  for (let index = 0; index < series.length; index += labelEvery) labelled.add(index);
  const lastIndex = series.length - 1;
  if (lastIndex - Math.max(...labelled) >= Math.ceil(labelEvery / 2)) labelled.add(lastIndex);

  return (
    <svg className="vx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Emails sent per day">
      {ticks.map((tick) => (
        <g key={tick}>
          <line className="vx-grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className="vx-axis" x={PAD.left - 10} y={y(tick) + 4} textAnchor="end">
            {num(Math.round(tick))}
          </text>
        </g>
      ))}

      {series.map((day, index) => {
        const manual = day.counts[MANUAL] ?? 0;
        const auto = day.counts[AUTO] ?? 0;
        const total = manual + auto;
        const x = PAD.left + slot * index + (slot - barW) / 2;
        const base = PAD.top + plotH;
        const autoH = (auto / top) * plotH;
        const manualH = (manual / top) * plotH;
        const gap = auto > 0 && manual > 0 ? 2 : 0;

        return (
          <g
            key={day.date}
            className="vx-col"
            onMouseEnter={() =>
              onHover({
                owner: "emails",
                left: ((PAD.left + slot * index + slot / 2) / W) * 100,
                top: (y(total) / H) * 100,
                title: shortDate(day.date),
                rows: [
                  { label: "One click", value: manual, color: "var(--vx-s1)" },
                  { label: "Auto Emailer", value: auto, color: "var(--vx-s2)" },
                ],
              })
            }
            onMouseLeave={() => onHover(null)}
          >
            <rect className="vx-hit" x={PAD.left + slot * index} y={PAD.top} width={slot} height={plotH} />
            {manual > 0 && (
              <path
                className="vx-mark"
                d={barPath(x, base - manualH, barW, manualH, auto > 0 ? 0 : 4)}
                fill="var(--vx-s1)"
              />
            )}
            {auto > 0 && (
              <path
                className="vx-mark"
                d={barPath(x, base - manualH - gap - autoH, barW, autoH, 4)}
                fill="var(--vx-s2)"
              />
            )}
            {(index === peak.index || index === series.length - 1) && total > 0 && (
              <text className="vx-point-label" x={x + barW / 2} y={base - manualH - gap - autoH - 8} textAnchor="middle">
                {num(total)}
              </text>
            )}
          </g>
        );
      })}

      <line className="vx-axis-line" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />

      {series.map((day, index) =>
        labelled.has(index) ? (
          <text
            key={day.date}
            className="vx-axis"
            x={PAD.left + slot * index + slot / 2}
            y={H - 10}
            textAnchor="middle"
          >
            {shortDate(day.date)}
          </text>
        ) : null
      )}
    </svg>
  );
}

function MiniChart({
  series,
  types,
  onHover,
  label,
  owner,
}: {
  series: DayCounts[];
  types: string[];
  label: string;
  owner: string;
  onHover: (hover: Hover | null) => void;
}) {
  const W = 320;
  const H = 96;
  const PAD = { top: 10, right: 4, bottom: 4, left: 4 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = series.map((day) => sum(day.counts, types));
  const top = niceTop(Math.max(...values, 0));
  const slot = plotW / Math.max(series.length, 1);
  const barW = Math.max(2, Math.min(18, slot * 0.66));

  return (
    <svg className="vx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label + " per day"}>
      {series.map((day, index) => {
        const value = values[index];
        const height = top === 0 ? 0 : (value / top) * plotH;
        const x = PAD.left + slot * index + (slot - barW) / 2;
        return (
          <g
            key={day.date}
            className="vx-col"
            onMouseEnter={() =>
              onHover({
                owner,
                left: ((PAD.left + slot * index + slot / 2) / W) * 100,
                top: ((PAD.top + plotH - height) / H) * 100,
                title: shortDate(day.date),
                rows: [{ label, value }],
              })
            }
            onMouseLeave={() => onHover(null)}
          >
            <rect className="vx-hit" x={PAD.left + slot * index} y={0} width={slot} height={H} />
            {value > 0 ? (
              <path className="vx-mark" d={barPath(x, PAD.top + plotH - height, barW, height, 3)} fill="var(--vx-s1)" />
            ) : (
              <rect className="vx-zero" x={x} y={PAD.top + plotH - 1} width={barW} height={1} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Tooltip({ hover, owner }: { hover: Hover | null; owner: string }) {
  if (!hover || hover.owner !== owner) return null;
  return (
    <div
      className="vx-tip"
      style={{ left: hover.left + "%", top: hover.top + "%" }}
      aria-hidden
    >
      <b>{hover.title}</b>
      {hover.rows.map((row) => (
        <span key={row.label}>
          {row.color && <i style={{ background: row.color }} />}
          {row.label} <b>{num(row.value)}</b>
        </span>
      ))}
    </div>
  );
}

/* ===== Page ============================================================= */

export default function ExtensionPanel() {
  usePageMeta({
    title: "Extension usage — TruckBox",
    description: "Internal view of what the extension is used for.",
    path: "/admin2214/extension",
    noindex: true,
  });

  const [days, setDays] = useState(7);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [day, setDay] = useState(readAdminTheme);

  const flipTheme = () => {
    setDay((was) => {
      writeAdminTheme(!was);
      return !was;
    });
  };

  const load = useCallback(() => {
    if (!auth.getToken()) {
      setError("signin");
      return;
    }
    setBusy(true);
    api
      .get<Usage>(`/api/v1/admin/extension-usage?days=${days}`)
      .then((data) => {
        setUsage(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 403 ? "forbidden" : "failed"))
      .finally(() => setBusy(false));
  }, [days]);

  useEffect(load, [load]);

  const series = usage?.series ?? [];

  const emails = useMemo(
    () => ({
      manual: sum(usage?.totals, [MANUAL]),
      auto: sum(usage?.totals, [AUTO]),
    }),
    [usage]
  );

  if (error === "signin" || error === "forbidden") {
    return (
      <div className={"vx vx-blank" + (day ? " is-day" : "")}>
        <b className="vx-blank-code">404</b>
        <p className="vx-blank-text">This page does not exist.</p>
        <Link className="vx-back" to="/">
          ← TruckBox
        </Link>
      </div>
    );
  }

  const total = emails.manual + emails.auto;
  const autoShare = total === 0 ? 0 : Math.round((emails.auto / total) * 100);

  return (
    <div className={"vx" + (day ? " is-day" : "")}>
      <div className="vx-bar">
        <Link className="vx-back" to="/admin2214">
          ← Admin
        </Link>
        <b className="vx-title">Extension usage</b>
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

        <div className="vx-ranges">
          <button type="button" className={"vx-range" + (table ? " is-on" : "")} onClick={() => setTable((v) => !v)}>
            table
          </button>
          <button type="button" className="vx-range" onClick={load}>
            {busy ? "…" : "refresh"}
          </button>
        </div>

        {usage && (
          <span className="vx-note">
            {usage.from} → {usage.to} · {num(usage.activeUsers)} accounts active
            {usage.previousActiveUsers > 0 && (
              <i className={"vx-delta is-" + change(usage.activeUsers, usage.previousActiveUsers).tone}>
                {change(usage.activeUsers, usage.previousActiveUsers).text}
              </i>
            )}
          </span>
        )}
      </div>

      {error === "failed" && <p className="vx-empty">Could not load usage.</p>}
      {!usage && !error && <p className="vx-empty">Loading…</p>}

      {usage && (
        <>
          <div className="vx-kpis">
            {TILES.map((tile) => {
              const now = sum(usage.totals, tile.types);
              const delta = change(now, sum(usage.previousTotals, tile.types));
              return (
                <div key={tile.id} className="vx-kpi">
                  <span className="vx-kpi-label">{tile.label}</span>
                  <b className="vx-kpi-value">{num(now)}</b>
                  <span className={"vx-delta is-" + delta.tone}>
                    {delta.text} <i>vs previous {usage.days}d</i>
                  </span>
                </div>
              );
            })}
          </div>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Emails sent per day</b>
                <span className="vx-card-sub">
                  {num(total)} in {usage.days} days · {autoShare}% of them by Auto Emailer
                </span>
              </div>
              <div className="vx-legend">
                <span>
                  <i style={{ background: "var(--vx-s1)" }} /> One click
                </span>
                <span>
                  <i style={{ background: "var(--vx-s2)" }} /> Auto Emailer
                </span>
              </div>
            </header>
            <div className="vx-plot">
              <EmailChart series={series} onHover={setHover} />
              <Tooltip hover={hover} owner="emails" />
            </div>
          </section>

          <div className="vx-smalls">
            {SMALL.map((metric) => {
              const now = sum(usage.totals, metric.types);
              const delta = change(now, sum(usage.previousTotals, metric.types));
              return (
                <section key={metric.id} className="vx-card vx-card-small">
                  <header className="vx-card-head">
                    <div>
                      <b className="vx-card-title">{metric.label}</b>
                      {metric.note && <span className="vx-card-sub">{metric.note}</span>}
                    </div>
                    <div className="vx-small-value">
                      <b>{num(now)}</b>
                      <span className={"vx-delta is-" + delta.tone}>{delta.text}</span>
                    </div>
                  </header>
                  <div className="vx-plot">
                    <MiniChart
                      series={series}
                      types={metric.types}
                      label={metric.label}
                      owner={metric.id}
                      onHover={setHover}
                    />
                    <Tooltip hover={hover} owner={metric.id} />
                  </div>
                </section>
              );
            })}
          </div>

          {table && (
            <section className="vx-card">
              <header className="vx-card-head">
                <b className="vx-card-title">Every event type</b>
              </header>
              <table className="vx-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Last {usage.days}d</th>
                    <th>Previous {usage.days}d</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row) => {
                    const now = sum(usage.totals, row.types);
                    const before = sum(usage.previousTotals, row.types);
                    const delta = change(now, before);
                    return (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        <td>{num(now)}</td>
                        <td>{num(before)}</td>
                        <td className={"vx-delta is-" + delta.tone}>{delta.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
