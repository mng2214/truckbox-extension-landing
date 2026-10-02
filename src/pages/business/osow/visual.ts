/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// What the 2D schematic and the 3D model draw, in inches: x from the front bumper rearward, y up from
// the ground, z across the width centred on the truck.

import { LEGAL, type Rig, type RigLayout } from "./equipment";
import { formatFtIn } from "./parseDims";

export type VisualModel = {
  rig: Rig;
  layout: RigLayout;
  cargo: { lengthIn: number; widthIn: number; heightIn: number; x0: number; baseIn: number } | null;
  overall: { widthIn: number | null; heightIn: number | null; lengthIn: number | null };
};

export type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

export function cargoBox(m: VisualModel): Box | null {
  const c = m.cargo;
  if (!c || c.lengthIn <= 0 || c.widthIn <= 0 || c.heightIn <= 0) return null;
  return {
    x0: c.x0,
    x1: c.x0 + c.lengthIn,
    y0: c.baseIn,
    y1: c.baseIn + c.heightIn,
    z0: -c.widthIn / 2,
    z1: c.widthIn / 2,
  };
}

/** 8'6" wide, 13'6" high, tractor + a 53' trailer long. */
export function legalEnvelope(m: VisualModel): Box {
  return {
    x0: 0,
    x1: m.layout.tractorLengthIn + LEGAL.trailerLengthIn,
    y0: 0,
    y1: LEGAL.heightIn,
    z0: -LEGAL.widthIn / 2,
    z1: LEGAL.widthIn / 2,
  };
}

/** The parts of the cargo outside the legal envelope, as non-overlapping boxes. */
export function excessParts(c: Box, env: Box): Box[] {
  const out: Box[] = [];
  const topY = Math.min(c.y1, env.y1);
  if (c.y1 > env.y1) out.push({ ...c, y0: Math.max(c.y0, env.y1) });
  if (topY > c.y0) {
    if (c.z1 > env.z1) out.push({ ...c, y1: topY, z0: Math.max(c.z0, env.z1) });
    if (c.z0 < env.z0) out.push({ ...c, y1: topY, z1: Math.min(c.z1, env.z0) });
    if (c.x1 > env.x1) {
      out.push({
        x0: Math.max(c.x0, env.x1),
        x1: c.x1,
        y0: c.y0,
        y1: topY,
        z0: Math.max(c.z0, env.z0),
        z1: Math.min(c.z1, env.z1),
      });
    }
  }
  return out.filter((b) => b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0);
}

export type DimLabel = { key: "w" | "h" | "l"; text: string; over: boolean; missing: boolean };

export function dimLabels(m: VisualModel): DimLabel[] {
  const { widthIn, heightIn, lengthIn } = m.overall;
  const trailerPart = lengthIn != null ? lengthIn - m.layout.tractorLengthIn : null;
  return [
    { key: "w", text: `W ${formatFtIn(widthIn)}`, over: widthIn != null && widthIn > LEGAL.widthIn, missing: widthIn == null },
    { key: "h", text: `H ${formatFtIn(heightIn)}`, over: heightIn != null && heightIn > LEGAL.heightIn, missing: heightIn == null },
    {
      key: "l",
      text: `L ${formatFtIn(lengthIn)}`,
      over: trailerPart != null && trailerPart > LEGAL.trailerLengthIn,
      missing: lengthIn == null,
    },
  ];
}

/** Rightmost x anything reaches (rig, cargo). */
export function extentX(m: VisualModel): number {
  const c = cargoBox(m);
  return Math.max(m.layout.trailerEndIn, c ? c.x1 : 0, m.overall.lengthIn ?? 0);
}
