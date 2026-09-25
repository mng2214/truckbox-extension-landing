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

type Activity = {
  emails: number;
  autoEmails: number;
  maps: number;
  calls: number;
  creditChecks: number;
  laneAnalytics: number;
  events: number;
};

type UserRow = {
  userId: number | null;
  email: string;
  name: string | null;
  planStatus: string;
  extensionVersion: string | null;
  organizationId: number | null;
  organizationName: string | null;
  organizationRole: string | null;
  lastActiveAt: string | null;
  window: Activity;
  allTime: Activity;
};

type OrgRow = {
  id: number;
  name: string;
  status: string;
  ownerEmail: string | null;
  seats: number | null;
  members: number;
  activeMembers: number;
  window: Activity;
  allTime: Activity;
};

type Overview = { days: number; from: string; orgs: OrgRow[]; users: UserRow[] };

type OrgDetail = { org: OrgRow; members: UserRow[] };

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

/** A bar the width of this row's share of the busiest row, so a list reads as a ranking. */
function Share({ value, top }: { value: number; top: number }) {
  const width = top === 0 ? 0 : Math.round((value / top) * 100);
  return (
    <span className="vx-share">
      <i style={{ width: width + "%" }} />
      <b>{num(value)}</b>
    </span>
  );
}

export default function DirectoryPanel() {
  usePageMeta({
    title: "Accounts & teams — TruckBox",
    description: "Internal view of who is working and which company they are in.",
    path: "/admin2214/accounts",
    noindex: true,
  });

  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [openOrg, setOpenOrg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
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
      .get<Overview>(`/api/v1/admin/directory?days=${days}`)
      .then((data) => {
        setOverview(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 403 ? "forbidden" : "failed"))
      .finally(() => setBusy(false));
  }, [days]);

  useEffect(load, [load]);

  useEffect(() => {
    if (openOrg == null) {
      setDetail(null);
      return;
    }
    setBusy(true);
    api
      .get<OrgDetail>(`/api/v1/admin/directory/org/${openOrg}?days=${days}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setBusy(false));
  }, [openOrg, days]);

  const users = useMemo(() => {
    const rows = overview?.users ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.email, row.name, row.organizationName].some((field) => (field ?? "").toLowerCase().includes(needle))
    );
  }, [overview, search]);

  const orgs = useMemo(() => {
    const rows = overview?.orgs ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.ownerEmail].some((field) => (field ?? "").toLowerCase().includes(needle))
    );
  }, [overview, search]);

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

  const topUser = Math.max(...users.map((row) => row.window.emails), 1);
  const topOrg = Math.max(...orgs.map((row) => row.window.emails), 1);

  return (
    <div className={"vx" + (day ? " is-day" : "")}>
      <div className="vx-bar">
        <Link className="vx-back" to="/admin2214">
          ← Admin
        </Link>
        <b className="vx-title">Accounts &amp; teams</b>
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="email, name or company"
        />

        <button type="button" className="vx-range" onClick={load}>
          {busy ? "…" : "refresh"}
        </button>

        {overview && (
          <span className="vx-note">
            since {overview.from} · {num(overview.orgs.length)} companies · {num(overview.users.length)} active
            accounts
          </span>
        )}
      </div>

      {error === "failed" && <p className="vx-empty">Could not load the directory.</p>}
      {!overview && !error && <p className="vx-empty">Loading…</p>}

      {detail && (
        <section className="vx-card">
          <header className="vx-card-head">
            <div>
              <b className="vx-card-title">{detail.org.name}</b>
              <span className="vx-card-sub">
                {detail.org.status.toLowerCase()} · {detail.org.activeMembers} of {detail.org.members} people active ·{" "}
                {detail.org.seats ?? "—"} seats · owner {detail.org.ownerEmail ?? "—"}
              </span>
            </div>
            <button type="button" className="vx-range" onClick={() => setOpenOrg(null)}>
              close
            </button>
          </header>

          <div className="vx-kpis">
            {[
              ["Emails", detail.org.window.emails],
              ["By Auto Emailer", detail.org.window.autoEmails],
              ["Credit checks", detail.org.window.creditChecks],
              ["Route maps", detail.org.window.maps],
              ["Calls", detail.org.window.calls],
              ["All events", detail.org.window.events],
            ].map(([label, value]) => (
              <div key={String(label)} className="vx-kpi">
                <span className="vx-kpi-label">{label}</span>
                <b className="vx-kpi-value">{num(Number(value))}</b>
                <span className="vx-kpi-note">last {days}d</span>
              </div>
            ))}
          </div>

          <table className="vx-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Emails {days}d</th>
                <th>Auto</th>
                <th>Credit</th>
                <th>Maps</th>
                <th>Calls</th>
                <th>Emails all time</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {detail.members.map((member) => (
                <tr key={member.email}>
                  <td>{member.email}</td>
                  <td className="vx-dimmed">{(member.organizationRole ?? "").toLowerCase()}</td>
                  <td className="vx-dimmed">{member.planStatus.toLowerCase()}</td>
                  <td>
                    <Share value={member.window.emails} top={Math.max(...detail.members.map((m) => m.window.emails), 1)} />
                  </td>
                  <td>{num(member.window.autoEmails)}</td>
                  <td>{num(member.window.creditChecks)}</td>
                  <td>{num(member.window.maps)}</td>
                  <td>{num(member.window.calls)}</td>
                  <td className="vx-dimmed">{num(member.allTime.emails)}</td>
                  <td className="vx-dimmed">{when(member.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {overview && !detail && (
        <>
          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Companies</b>
                <span className="vx-card-sub">Click one to see its people</span>
              </div>
            </header>
            <table className="vx-table vx-table-click">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th>People</th>
                  <th>Seats</th>
                  <th>Emails {days}d</th>
                  <th>Auto</th>
                  <th>Credit</th>
                  <th>All events</th>
                  <th>Emails all time</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} onClick={() => setOpenOrg(org.id)}>
                    <td>
                      <b>{org.name}</b>
                      <span className="vx-dimmed"> {org.ownerEmail}</span>
                    </td>
                    <td className="vx-dimmed">{org.status.toLowerCase()}</td>
                    <td>
                      {org.activeMembers} <span className="vx-dimmed">/ {org.members}</span>
                    </td>
                    <td className="vx-dimmed">{org.seats ?? "—"}</td>
                    <td>
                      <Share value={org.window.emails} top={topOrg} />
                    </td>
                    <td>{num(org.window.autoEmails)}</td>
                    <td>{num(org.window.creditChecks)}</td>
                    <td>{num(org.window.events)}</td>
                    <td className="vx-dimmed">{num(org.allTime.emails)}</td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="vx-dimmed">
                      No companies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="vx-card">
            <header className="vx-card-head">
              <div>
                <b className="vx-card-title">Active accounts</b>
                <span className="vx-card-sub">Anyone whose extension did something in the last {days} days</span>
              </div>
            </header>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Company</th>
                  <th>Plan</th>
                  <th>Emails {days}d</th>
                  <th>Auto</th>
                  <th>Credit</th>
                  <th>Maps</th>
                  <th>Calls</th>
                  <th>Emails all time</th>
                  <th>Version</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.email}>
                    <td>
                      {row.email}
                      {row.name && <span className="vx-dimmed"> {row.name}</span>}
                    </td>
                    <td>
                      {row.organizationId ? (
                        <button type="button" className="vx-linkish" onClick={() => setOpenOrg(row.organizationId)}>
                          {row.organizationName}
                        </button>
                      ) : (
                        <span className="vx-dimmed">solo</span>
                      )}
                    </td>
                    <td className="vx-dimmed">{row.planStatus.toLowerCase()}</td>
                    <td>
                      <Share value={row.window.emails} top={topUser} />
                    </td>
                    <td>{num(row.window.autoEmails)}</td>
                    <td>{num(row.window.creditChecks)}</td>
                    <td>{num(row.window.maps)}</td>
                    <td>{num(row.window.calls)}</td>
                    <td className="vx-dimmed">{num(row.allTime.emails)}</td>
                    <td className="vx-dimmed">{row.extensionVersion ?? "—"}</td>
                    <td className="vx-dimmed">{when(row.lastActiveAt)}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={11} className="vx-dimmed">
                      Nobody was active in this window.
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
