/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
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
    to: "/admin2214/accounts",
    name: "Accounts & teams",
    what: "Who is working right now, which company they sit in, and how much each person sends.",
    tag: "people",
  },
];

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
    </div>
  );
}
