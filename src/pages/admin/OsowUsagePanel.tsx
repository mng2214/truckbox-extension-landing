/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { auth } from "../../lib/auth";
import { usePageMeta } from "../../lib/meta";
import { readAdminTheme, writeAdminTheme } from "./theme";
import "./visits.css";

type DayRow = { date: string; calculations: number; users: number };

type UserRow = {
  email: string;
  organizationName: string | null;
  calculations: number;
  quotesSaved: number;
  lastCalculationAt: string | null;
  topLanes: string[];
};

type CalculationRow = {
  at: string | null;
  email: string;
  organizationName: string | null;
  origin: string;
  destination: string;
  states: string | null;
  totalUsd: number | null;
  widthIn: number | null;
  heightIn: number | null;
  lengthIn: number | null;
  grossLb: number | null;
};

type Overview = {
  days: number;
  from: string;
  totals: { calculations: number; users: number; quotesSaved: number };
  series: DayRow[];
  users: UserRow[];
  calculations: CalculationRow[];
};

type Hover = { left: number; top: number; day: DayRow };

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const num = (value: number) => value.toLocaleString("en-US");

const when = (iso: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const shortDate = (isoDate: string) => {
  const date = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** 150 → 12'6" */
const feet = (inches: number | null) => {
  if (inches == null) return "—";
  const wholeFeet = Math.floor(inches / 12);
  const remainingInches = Math.round(inches - wholeFeet * 12);
  return remainingInches ? `${wholeFeet}'${remainingInches}"` : `${wholeFeet}'`;
};

const size = (row: CalculationRow) =>
  row.widthIn == null
    ? "—"
    : `${feet(row.widthIn)} W × ${feet(row.heightIn)} H × ${feet(row.lengthIn)} L · ${num(row.grossLb ?? 0)} lb`;

/** A bar with its top corners rounded and its base square on the axis. */
function barPath(x: number, y: number, width: number, height: number, radius: number): string {
  const corner = Math.min(radius, width / 2, Math.max(height, 0));
  if (height <= 0) return "";
  return (
    `M${x} ${y + height} L${x} ${y + corner} Q${x} ${y} ${x + corner} ${y} ` +
    `L${x + width - corner} ${y} Q${x + width} ${y} ${x + width} ${y + corner} ` +
    `L${x + width} ${y + height} Z`
  );
}

/** A round axis top just above the tallest bar. */
function niceTop(max: number): number {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (step * factor >= max) return step * factor;
  }
  return step * 10;
}

function Share({ value, top }: { value: number; top: number }) {
  const width = top === 0 ? 0 : Math.round((value / top) * 100);
  return (
    <span className="vx-share">
      <i style={{ width: width + "%" }} />
      <b>{num(value)}</b>
    </span>
  );
}

function CalculationsChart({ series, onHover }: { series: DayRow[]; onHover: (hover: Hover | null) => void }) {
  const W = 1000;
  const H = 280;
  const PAD = { top: 22, right: 16, bottom: 30, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const top = niceTop(Math.max(...series.map((day) => day.calculations), 0));
  const slot = plotW / Math.max(series.length, 1);
  const barW = Math.max(3, Math.min(34, slot * 0.62));
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const ticks = [0, top / 2, top];

  // Label every nth day, and the last one only when it would not collide with the one before it.
  const labelEvery = Math.ceil(series.length / 8);
  const labelled = new Set<number>();
  for (let index = 0; index < series.length; index += labelEvery) labelled.add(index);
  const lastIndex = series.length - 1;
  if (lastIndex - Math.max(...labelled) >= Math.ceil(labelEvery / 2)) labelled.add(lastIndex);

  return (
    <svg className="vx-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="OS/OW calculations per day">
      {ticks.map((tick) => (
        <g key={tick}>
          <line className="vx-grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className="vx-axis" x={PAD.left - 10} y={y(tick) + 4} textAnchor="end">
            {num(Math.round(tick))}
          </text>
        </g>
      ))}

      {series.map((day, index) => {
        const height = (day.calculations / top) * plotH;
        const x = PAD.left + slot * index + (slot - barW) / 2;
        return (
          <g
            key={day.date}
            className="vx-col"
            onMouseEnter={() =>
              onHover({
                left: ((PAD.left + slot * index + slot / 2) / W) * 100,
                top: (y(day.calculations) / H) * 100,
                day,
              })
            }
            onMouseLeave={() => onHover(null)}
          >
            <rect className="vx-hit" x={PAD.left + slot * index} y={PAD.top} width={slot} height={plotH} />
            {day.calculations > 0 ? (
              <path className="vx-mark" d={barPath(x, PAD.top + plotH - height, barW, height, 4)} fill="var(--vx-s1)" />
            ) : (
              <rect className="vx-zero" x={x} y={PAD.top + plotH - 1} width={barW} height={1} />
            )}
          </g>
        );
      })}

      <line className="vx-axis-line" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />

      {series.map((day, index) =>
        labelled.has(index) ? (
          <text key={day.date} className="vx-axis" x={PAD.left + slot * index + slot / 2} y={H - 10} textAnchor="middle">
            {shortDate(day.date)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export default function OsowUsagePanel() {
  usePageMeta({
    title: "OS/OW calculator — TruckBox",
    description: "Internal view of who uses the OS/OW calculator.",
    path: "/admin2214/osow",
    noindex: true,
  });

  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [day, setDay] = useState(readAdminTheme);

  const flipTheme = () => {
    setDay((was) => {
      writeAdminTheme(!was);
      return !was;
    });
  };

  const signedIn = Boolean(auth.getToken());
  // Bumped by "refresh" to run the load again for the same range.
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api
      .get<Overview>(`/api/v1/admin/osow?days=${days}&limit=300`)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setError(null);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure instanceof ApiError && failure.status === 403 ? "forbidden" : "failed");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, signedIn, reloadCount]);

  const refresh = () => {
    setBusy(true);
    setReloadCount((count) => count + 1);
  };

  if (!signedIn || error === "forbidden") {
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

  const topCalculations = Math.max(...(overview?.users ?? []).map((row) => row.calculations), 1);
  const perPerson =
    overview && overview.totals.users > 0 ? (overview.totals.calculations / overview.totals.users).toFixed(1) : "0";

  return (
    <div className={"vx" + (day ? " is-day" : "")}>
      <div className="vx-bar">
        <Link className="vx-back" to="/admin2214">
          ← Admin
        </Link>
        <b className="vx-title">OS/OW calculator</b>
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
        <button type="button" className="vx-range" onClick={refresh}>
          {busy ? "…" : "refresh"}
        </button>
        {overview && <span className="vx-note">since {overview.from}</span>}
      </div>

      {error === "failed" && <p className="vx-empty">Could not load the calculator usage.</p>}
      {!overview && !error && <p className="vx-empty">Loading…</p>}

      {overview && (
        <>
          <div className="vx-kpis">
            <div className="vx-kpi">
              <span className="vx-kpi-label">Calculations</span>
              <b className="vx-kpi-value">{num(overview.totals.calculations)}</b>
              <span className="vx-kpi-note">routes priced</span>
            </div>
            <div className="vx-kpi">
              <span className="vx-kpi-label">People</span>
              <b className="vx-kpi-value">{num(overview.totals.users)}</b>
              <span className="vx-kpi-note">{perPerson} calculations each</span>
            </div>
            <div className="vx-kpi">
              <span className="vx-kpi-label">Quotes saved</span>
              <b className="vx-kpi-value">{num(overview.totals.quotesSaved)}</b>
              <span className="vx-kpi-note">kept for later</span>
            </div>
          </div>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Calculations per day</b>
                <span className="vx-card-sub">Hover a day for how many people calculated</span>
              </div>
            </header>
            <div className="vx-plot">
              <CalculationsChart series={overview.series} onHover={setHover} />
              {hover && (
                <div className="vx-tip" style={{ left: hover.left + "%", top: hover.top + "%" }} aria-hidden>
                  <b>{shortDate(hover.day.date)}</b>
                  <span>
                    <i style={{ background: "var(--vx-s1)" }} />
                    Calculations <b>{num(hover.day.calculations)}</b>
                  </span>
                  <span>
                    People <b>{num(hover.day.users)}</b>
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Who calculates, and how often</b>
                <span className="vx-card-sub">Busiest first, with the lanes each person keeps pricing</span>
              </div>
            </header>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Company</th>
                  <th>Calculations</th>
                  <th>Quotes saved</th>
                  <th>Usual lanes</th>
                  <th>Last calculation</th>
                </tr>
              </thead>
              <tbody>
                {overview.users.map((row) => (
                  <tr key={row.email}>
                    <td>{row.email}</td>
                    <td className="vx-dimmed">{row.organizationName ?? "solo"}</td>
                    <td>
                      <Share value={row.calculations} top={topCalculations} />
                    </td>
                    <td>{num(row.quotesSaved)}</td>
                    <td>{row.topLanes.join(" · ") || <span className="vx-dimmed">—</span>}</td>
                    <td className="vx-dimmed">{when(row.lastCalculationAt)}</td>
                  </tr>
                ))}
                {overview.users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="vx-dimmed">
                      Nobody used the calculator in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Latest calculations</b>
                <span className="vx-card-sub">Newest first, as each one was run</span>
              </div>
            </header>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Account</th>
                  <th>Lane</th>
                  <th>States</th>
                  <th>Load</th>
                  <th>OS/OW cost</th>
                </tr>
              </thead>
              <tbody>
                {overview.calculations.map((row, index) => (
                  <tr key={(row.at ?? "") + index}>
                    <td className="vx-dimmed">{when(row.at)}</td>
                    <td>{row.email}</td>
                    <td>
                      {row.origin} → {row.destination}
                    </td>
                    <td className="vx-dimmed">{row.states?.replaceAll(",", " · ") ?? "no route"}</td>
                    <td className="vx-dimmed">{size(row)}</td>
                    <td>{row.totalUsd == null ? "—" : "$" + num(Math.round(row.totalUsd))}</td>
                  </tr>
                ))}
                {overview.calculations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="vx-dimmed">
                      Nothing calculated in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
