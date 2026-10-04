/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { Link } from "react-router-dom";
import { STATE_INDEX, readableDate, statePath } from "./permitsData";

const TILES: Record<string, [number, number]> = {
  ME: [0, 10],
  WA: [1, 0], ID: [1, 1], MT: [1, 2], ND: [1, 3], MN: [1, 4], WI: [1, 5], MI: [1, 7], VT: [1, 9], NH: [1, 10],
  OR: [2, 0], NV: [2, 1], WY: [2, 2], SD: [2, 3], IA: [2, 4], IL: [2, 5], IN: [2, 6], OH: [2, 7], PA: [2, 8], NY: [2, 9], MA: [2, 10],
  CA: [3, 0], UT: [3, 1], CO: [3, 2], NE: [3, 3], MO: [3, 4], KY: [3, 5], WV: [3, 6], VA: [3, 7], MD: [3, 8], NJ: [3, 9], CT: [3, 10],
  AZ: [4, 1], NM: [4, 2], KS: [4, 3], AR: [4, 4], TN: [4, 5], NC: [4, 6], SC: [4, 7], DE: [4, 8], RI: [4, 10],
  OK: [5, 3], LA: [5, 4], MS: [5, 5], AL: [5, 6], GA: [5, 7],
  TX: [6, 3], FL: [6, 8],
};

export function StateTileMap() {
  return (
    <nav className="tbp-tiles" aria-label="Oversize permit rules by state">
      {STATE_INDEX.map((entry) => {
        const tile = TILES[entry.code];
        if (!tile) return null;
        const checked = entry.verified ? `verified ${readableDate(entry.verifiedOn) ?? ""}` : "draft";
        return (
          <Link
            key={entry.code}
            to={statePath(entry.slug)}
            className={"tbp-tile" + (entry.verified ? "" : " is-draft")}
            style={{ gridRow: tile[0] + 1, gridColumn: tile[1] + 1 }}
            aria-label={`${entry.name} oversize permits, ${checked}`}
            title={`${entry.name}: ${checked}`}
          >
            {entry.code}
          </Link>
        );
      })}
    </nav>
  );
}
