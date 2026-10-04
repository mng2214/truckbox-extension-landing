/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { usePageMeta } from "../../lib/meta";
import { ADMIN_THEME_KEY, readAdminTheme, writeAdminTheme } from "./theme";
import "./visits.css";

const TILES = [
  {
    to: "/admin2214/visits",
    name: "Demo traffic",
    what: "Who opens the public demo: sessions, sources, suspicion score and the block list.",
    tag: "website",
  },
  {
    to: "/admin2214/extension",
    name: "Extension usage",
    what: "What dispatchers actually press: emails, credit checks, maps, calculator — 7 days or a month.",
    tag: "extension",
  },
  {
    to: "/admin2214/backoffice",
    name: "Back office",
    what: "Who opens the cabinet and how often, and which corridors they look for in Oracle.",
    tag: "cabinet",
  },
  {
    to: "/admin2214/osow",
    name: "OS/OW calculator",
    what: "Who prices oversize loads, how often, on which lanes — and the calculations per day.",
    tag: "cabinet",
  },
  {
    to: "/admin2214/accounts",
    name: "Accounts & teams",
    what: "Who is working right now, which company they sit in, and how much each person sends.",
    tag: "people",
  },
  {
    to: "/admin2214/intrusions",
    name: "Suspicious activity",
    what: "Real people who tried the admin addresses: IP, network, device, account if signed in.",
    tag: "security",
  },
];

type SourceRow = { source: string; medium: string | null; campaign: string | null; signups: number; checkedOut: number };

function SignupSources() {
  const [rows, setRows] = useState<SourceRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<SourceRow[]>("/api/v1/admin/signup-sources?days=90")
      .then((result) => {
        if (active) setRows(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="vx-card">
      <header className="vx-card-head">
        <div>
          <b className="vx-card-title">Where signups come from</b>
          <span className="vx-card-sub">Accounts created in the last 90 days, and how many of them went to checkout</span>
        </div>
      </header>
      {failed && <p className="vx-empty">Could not load the signup sources.</p>}
      {!rows && !failed && <p className="vx-empty">Loading…</p>}
      {rows && rows.length === 0 && <p className="vx-empty">No signups in the last 90 days.</p>}
      {rows && rows.length > 0 && (
        <table className="vx-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Medium</th>
              <th>Campaign</th>
              <th>Signups</th>
              <th>Went to checkout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.source}|${row.medium ?? ""}|${row.campaign ?? ""}`}>
                <td>{row.source === "unknown" ? <span className="vx-dimmed">before tracking</span> : row.source}</td>
                <td className="vx-dimmed">{row.medium ?? "—"}</td>
                <td className="vx-dimmed">{row.campaign ?? "—"}</td>
                <td>{row.signups.toLocaleString("en-US")}</td>
                <td>{row.checkedOut.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function AdminHome() {
  usePageMeta({
    title: "Admin — TruckBox",
    description: "Internal dashboards.",
    path: "/admin2214",
    noindex: true,
  });

  const [day, setDay] = useState(readAdminTheme);

  const flipTheme = () => {
    setDay((was) => {
      writeAdminTheme(!was);
      return !was;
    });
  };

  return (
    <div className={"vx" + (day ? " is-day" : "")} data-theme-key={ADMIN_THEME_KEY}>
      <div className="vx-bar">
        <Link className="vx-back" to="/">
          ← TruckBox
        </Link>
        <b className="vx-title">Admin</b>
        <button type="button" className="vx-theme" onClick={flipTheme}>
          {day ? "night" : "day"}
        </button>
      </div>

      <div className="vx-tiles">
        {TILES.map((tile) => (
          <Link key={tile.to} className="vx-tile" to={tile.to}>
            <span className="vx-tile-tag">{tile.tag}</span>
            <b className="vx-tile-name">{tile.name}</b>
            <span className="vx-tile-what">{tile.what}</span>
            <span className="vx-tile-go">open →</span>
          </Link>
        ))}
      </div>

      <SignupSources />
    </div>
  );
}
