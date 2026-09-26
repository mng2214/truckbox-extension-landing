/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { auth } from "../../lib/auth";
import { readAdminTheme } from "./theme";
import "./visits.css";

type Verdict = "checking" | "admin" | "denied";

const PROBE = "/api/v1/admin/directory/event-counts?days=1&type=CABINET_OPENED";

let confirmedToken: string | null = null;

function initialVerdict(): Verdict {
  const token = auth.getToken();
  if (!token) return "denied";
  return token === confirmedToken ? "admin" : "checking";
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const [verdict, setVerdict] = useState<Verdict>(initialVerdict);

  useEffect(() => {
    if (verdict !== "checking") return;
    const token = auth.getToken();
    let alive = true;
    api
      .get(PROBE)
      .then(() => {
        confirmedToken = token;
        if (alive) setVerdict("admin");
      })
      .catch(() => {
        confirmedToken = null;
        if (alive) setVerdict("denied");
      });
    return () => {
      alive = false;
    };
  }, [verdict]);

  if (verdict === "admin") return <>{children}</>;
  if (verdict === "checking") return null;

  return (
    <div className={"vx vx-blank" + (readAdminTheme() ? " is-day" : "")}>
      <b className="vx-blank-code">404</b>
      <p className="vx-blank-text">This page does not exist.</p>
      <Link className="vx-back" to="/">
        ← TruckBox
      </Link>
    </div>
  );
}
