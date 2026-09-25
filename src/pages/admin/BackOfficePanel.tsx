/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { auth } from "../../lib/auth";
import { usePageMeta } from "../../lib/meta";
import { readAdminTheme, writeAdminTheme } from "./theme";
import "./visits.css";

type EventCount = {
  email: string;
  organizationName: string | null;
  count: number;
  lastAt: string | null;
};

type OracleUser = {
  email: string;
  organizationName: string | null;
  searches: number;
  results: number;
  lastSearchAt: string | null;
  topLanes: string[];
};

type OracleSearch = {
  at: string | null;
  email: string;
  organizationName: string | null;
  origin: string | null;
  destination: string | null;
  originRadius: number | null;
  destRadius: number | null;
  equipment: string | null;
  minActiveDays: number | null;
  results: number;
};

type Oracle = { days: number; from: string; users: OracleUser[]; searches: OracleSearch[] };

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

const lane = (row: OracleSearch) =>
  (row.origin || "anywhere") + " → " + (row.destination || "anywhere");

function Share({ value, top }: { value: number; top: number }) {
  const width = top === 0 ? 0 : Math.round((value / top) * 100);
  return (
    <span className="vx-share">
      <i style={{ width: width + "%" }} />
      <b>{num(value)}</b>
    </span>
  );
}

export default function BackOfficePanel() {
  usePageMeta({
    title: "Back office — TruckBox",
    description: "Internal view of who uses the cabinet and Oracle.",
    path: "/admin2214/backoffice",
    noindex: true,
  });

  const [days, setDays] = useState(30);
  const [visits, setVisits] = useState<EventCount[] | null>(null);
  const [panels, setPanels] = useState<EventCount[] | null>(null);
  const [oracle, setOracle] = useState<Oracle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    Promise.all([
      api.get<EventCount[]>(`/api/v1/admin/directory/event-counts?days=${days}&type=CABINET_OPENED`),
      api.get<EventCount[]>(`/api/v1/admin/directory/event-counts?days=${days}&type=CABINET_PANEL`),
      api.get<Oracle>(`/api/v1/admin/oracle?days=${days}&limit=300`),
    ])
      .then(([opened, panelViews, oracleData]) => {
        setVisits(opened);
        setPanels(panelViews);
        setOracle(oracleData);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 403 ? "forbidden" : "failed"))
      .finally(() => setBusy(false));
  }, [days]);

  useEffect(load, [load]);

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

  const topVisits = Math.max(...(visits ?? []).map((row) => row.count), 1);
  const topSearches = Math.max(...(oracle?.users ?? []).map((row) => row.searches), 1);
  const totalVisits = (visits ?? []).reduce((sum, row) => sum + row.count, 0);
  const totalPanels = (panels ?? []).reduce((sum, row) => sum + row.count, 0);
  const totalSearches = (oracle?.users ?? []).reduce((sum, row) => sum + row.searches, 0);

  return (
    <div className={"vx" + (day ? " is-day" : "")}>
      <div className="vx-bar">
        <Link className="vx-back" to="/admin2214">
          ← Admin
        </Link>
        <b className="vx-title">Back office</b>
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
        <button type="button" className="vx-range" onClick={load}>
          {busy ? "…" : "refresh"}
        </button>
        {oracle && <span className="vx-note">since {oracle.from}</span>}
      </div>

      {error === "failed" && <p className="vx-empty">Could not load the back office view.</p>}
      {!visits && !error && <p className="vx-empty">Loading…</p>}

      {visits && panels && oracle && (
        <>
          <div className="vx-kpis">
            <div className="vx-kpi">
              <span className="vx-kpi-label">Cabinet visits</span>
              <b className="vx-kpi-value">{num(totalVisits)}</b>
              <span className="vx-kpi-note">{num(visits.length)} people</span>
            </div>
            <div className="vx-kpi">
              <span className="vx-kpi-label">Panels opened</span>
              <b className="vx-kpi-value">{num(totalPanels)}</b>
              <span className="vx-kpi-note">inside those visits</span>
            </div>
            <div className="vx-kpi">
              <span className="vx-kpi-label">Oracle searches</span>
              <b className="vx-kpi-value">{num(totalSearches)}</b>
              <span className="vx-kpi-note">{num(oracle.users.length)} people</span>
            </div>
            <div className="vx-kpi">
              <span className="vx-kpi-label">Lanes returned</span>
              <b className="vx-kpi-value">
                {num(oracle.users.reduce((sum, row) => sum + row.results, 0))}
              </b>
              <span className="vx-kpi-note">brokers found in total</span>
            </div>
          </div>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Who opens the back office</b>
                <span className="vx-card-sub">A visit is one arrival; panels are the pages opened inside it</span>
              </div>
            </header>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Company</th>
                  <th>Visits</th>
                  <th>Panels opened</th>
                  <th>Last visit</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((row) => {
                  const theirPanels = panels.find((p) => p.email === row.email);
                  return (
                    <tr key={row.email}>
                      <td>{row.email}</td>
                      <td className="vx-dimmed">{row.organizationName ?? "solo"}</td>
                      <td>
                        <Share value={row.count} top={topVisits} />
                      </td>
                      <td>{num(theirPanels?.count ?? 0)}</td>
                      <td className="vx-dimmed">{when(row.lastAt)}</td>
                    </tr>
                  );
                })}
                {visits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="vx-dimmed">
                      Nobody opened the back office in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Oracle — who searches, and for what</b>
                <span className="vx-card-sub">The corridors each person keeps coming back to</span>
              </div>
            </header>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Company</th>
                  <th>Searches</th>
                  <th>Brokers found</th>
                  <th>Most searched lanes</th>
                  <th>Last search</th>
                </tr>
              </thead>
              <tbody>
                {oracle.users.map((row) => (
                  <tr key={row.email}>
                    <td>{row.email}</td>
                    <td className="vx-dimmed">{row.organizationName ?? "solo"}</td>
                    <td>
                      <Share value={row.searches} top={topSearches} />
                    </td>
                    <td>{num(row.results)}</td>
                    <td>{row.topLanes.join(" · ") || <span className="vx-dimmed">—</span>}</td>
                    <td className="vx-dimmed">{when(row.lastSearchAt)}</td>
                  </tr>
                ))}
                {oracle.users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="vx-dimmed">
                      No Oracle searches in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Every Oracle search</b>
                <span className="vx-card-sub">Newest first, as it was run</span>
              </div>
            </header>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Account</th>
                  <th>Lane</th>
                  <th>Radius</th>
                  <th>Equipment</th>
                  <th>Active days</th>
                  <th>Found</th>
                </tr>
              </thead>
              <tbody>
                {oracle.searches.map((row, index) => (
                  <tr key={(row.at ?? "") + index}>
                    <td className="vx-dimmed">{when(row.at)}</td>
                    <td>{row.email}</td>
                    <td>{lane(row)}</td>
                    <td className="vx-dimmed">
                      {row.originRadius ?? "—"} / {row.destRadius ?? "—"}
                    </td>
                    <td className="vx-dimmed">{row.equipment ?? "any"}</td>
                    <td className="vx-dimmed">{row.minActiveDays ?? "—"}</td>
                    <td>{num(row.results)}</td>
                  </tr>
                ))}
                {oracle.searches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="vx-dimmed">
                      Nothing searched in this window.
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
