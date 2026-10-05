/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { installLink } from "../installLink";

export function ExtensionBridge() {
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-4"
      style={{ border: "1px solid var(--line)", background: "var(--bg-2)", padding: "18px 20px" }}
      aria-labelledby="osw-bridge-title"
    >
      <div className="flex flex-col gap-1" style={{ minWidth: 0, maxWidth: 620 }}>
        <b id="osw-bridge-title" style={{ color: "var(--ink)" }}>
          Booking this load on DAT or Truckstop?
        </b>
        <span style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          TruckBox sits right on the load board: one-click broker emails, rate history per lane, broker credit from
          RTS, Apex and Triumph, and up to 25 OS/OW calculations a day. 7 days free, no card.
        </span>
      </div>
      <a className="ed-btn ed-btn-accent" href={installLink("osow", "result")} target="_blank" rel="noopener">
        <span>Install TruckBox</span>
      </a>
    </section>
  );
}
