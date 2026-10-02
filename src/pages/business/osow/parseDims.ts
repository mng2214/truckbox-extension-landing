/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Dimension and weight parsing for the OS/OW form. Pure functions, no React: the form calls them on
// every keystroke and the paste box runs them over whole load posts.
//
// Units are always inches and pounds (US only). A bare number is read the way dispatchers write it:
// a width/height of 12 means feet, 150 means inches; a length of 75 means feet, 900 means inches.

export type DimKind = "width" | "height" | "length" | "overhang";

const NUM = String.raw`\d+(?:\.\d+)?`;
const FT = String.raw`(?:feet|foot|ft\.?|')`;
const IN = String.raw`(?:inches|inch|in\.?|")`;

/** Smart quotes and primes from email clients → plain ' and ". Two single quotes read as inches. */
export function normalizeQuotes(s: string): string {
  return s
    .replace(/[′’‘´`]/g, "'")
    .replace(/[″“”]/g, '"')
    .replace(/''/g, '"');
}

const RE_FT_IN = new RegExp(String.raw`^(${NUM})\s*${FT}\s*(?:-?\s*(${NUM})\s*${IN}?)?$`, "i");
const RE_IN = new RegExp(String.raw`^(${NUM})\s*${IN}$`, "i");
const RE_DASH = new RegExp(String.raw`^(\d+)\s*-\s*(${NUM})$`);
const RE_SPACE = new RegExp(String.raw`^(\d+)\s+(${NUM})$`);
const RE_BARE = new RegExp(String.raw`^(${NUM})$`);

/**
 * Reads one dimension and returns whole inches, or null when the text is not a dimension.
 * Accepts 12'6", 12' 6", 12'-6", 12-6, 12 6, 12 ft 6 in, 12ft, 12', 150", 150 in, 12.5', 12.5 ft
 * and bare numbers (see the file header for how those are read).
 */
export function parseLengthIn(input: string | null | undefined, kind: DimKind = "width"): number | null {
  if (input == null) return null;
  const s = normalizeQuotes(String(input))
    .trim()
    .toLowerCase()
    .replace(/(\d),(\d{3})\b/g, "$1$2");
  if (!s) return null;

  let inches: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(RE_FT_IN))) {
    inches = Number(m[1]) * 12 + (m[2] ? Number(m[2]) : 0);
  } else if ((m = s.match(RE_IN))) {
    inches = Number(m[1]);
  } else if ((m = s.match(RE_DASH)) || (m = s.match(RE_SPACE))) {
    const ft = Number(m[1]);
    const inch = Number(m[2]);
    if (inch >= 12) return null;
    inches = ft * 12 + inch;
  } else if ((m = s.match(RE_BARE))) {
    const n = Number(m[1]);
    const feetCutoff = kind === "length" ? 200 : 20;
    inches = n <= feetCutoff ? n * 12 : n;
  }
  if (inches == null || !Number.isFinite(inches) || inches < 0) return null;
  return Math.round(inches);
}

const WNUM = String.raw`\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?`;
const RE_WEIGHT = new RegExp(
  String.raw`^(${WNUM})\s*(k)?\s*(?:lbs?\.?|pounds?|#)?$`,
  "i",
);
const RE_TONS = new RegExp(String.raw`^(${NUM})\s*(?:tons?)$`, "i");

/** Reads a weight in pounds: 95,000 · 95000 · 95000 lbs · 95,000# · 95k · 95.5k lb · 47.5 tons. */
export function parseWeightLb(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  let m = s.match(RE_WEIGHT);
  if (m) {
    const n = Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  m = s.match(RE_TONS);
  if (m) {
    const n = Number(m[1]) * 2000;
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

/** Whole inches → 12' 6" (or 14' when the inches are zero). */
export function formatFtIn(inches: number | null | undefined): string {
  if (inches == null || !Number.isFinite(inches)) return "—";
  const total = Math.round(inches);
  const ft = Math.floor(total / 12);
  const inch = total - ft * 12;
  if (ft === 0) return `${inch}"`;
  return inch === 0 ? `${ft}'` : `${ft}' ${inch}"`;
}

/** 95000 → "95,000". */
export function formatLb(lb: number | null | undefined): string {
  if (lb == null || !Number.isFinite(lb)) return "—";
  return Math.round(lb).toLocaleString("en-US");
}
