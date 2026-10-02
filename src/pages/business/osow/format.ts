/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useSyncExternalStore } from "react";
import type { HoldReason, Smoothing, TripStop } from "./types";

export const DISCLAIMER = "Estimate only — not a permit. Verify with each state's permit office before quoting.";

/** $1,234 (whole dollars) or $1,234.50 with cents. Null → em dash. */
export function usd(n: number | null | undefined, cents = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return (
    sign +
    "$" +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    })
  );
}

export function miles(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "2026-10-02" or an ISO timestamp → "Oct 2, 2026". */
export function shortDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function readNumber(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// --- Cabinet theme (light = data-theme="light" on <html>, dark = no attribute) ----------------

function subscribeTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function themeSnapshot(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function useCabinetTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, themeSnapshot, () => "light");
}

function subscribeMotion(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// --- localStorage (private windows and blocked storage throw) --------------------------------

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked — preferences just won't persist */
  }
}

export const SMOOTHING_OPTIONS: { value: Smoothing; label: string; hint: string }[] = [
  { value: "conservative", label: "Conservative", hint: "Keep escorts through gaps of 150 mi or less between escorted states" },
  { value: "raw", label: "Only where required", hint: "Escorts only in states that require them" },
  { value: "full_carry", label: "Full carry", hint: "Escorts stay from the first escorted state to the last" },
];

export function humanize(id: string): string {
  const s = id.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}


export const US48 = (
  "AL AZ AR CA CO CT DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR " +
  "PA RI SC SD TN TX UT VT VA WA WV WI WY"
).split(" ");

/** "2026-10-09" → "Fri Oct 9". Parsed as a calendar date, never shifted by the browser's zone. */
export function tripDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "2026-10-12T16:00" → "Mon Oct 12, 4:00 PM". */
export function tripMomentLabel(localDateTime: string): string {
  const [datePart, timePart = "00:00"] = localDateTime.split("T");
  const [hours, minutes] = timePart.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${tripDayLabel(datePart)}, ${twelveHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export const HOLD_LABEL: Record<HoldReason, string> = {
  NIGHT: "Night",
  CURFEW: "Hours limit",
  WEEKEND: "Weekend",
  HOLIDAY: "Holiday",
  HOS_REST: "10 h rest",
  HOS_RESTART: "34 h restart",
};

const HOLD_DETAIL: Record<HoldReason, string> = {
  NIGHT: "no travel after dark",
  CURFEW: "outside the state's allowed hours",
  WEEKEND: "no weekend travel",
  HOLIDAY: "no holiday travel",
  HOS_REST: "driver's 10 h off duty",
  HOS_RESTART: "driver's 34 h restart (70 h / 8 days)",
};

/** Marker color group: the driver resting, a state rule holding the load, or a long restart. */
export const STOP_TONE: Record<HoldReason, "rest" | "rule" | "restart"> = {
  NIGHT: "rest",
  HOS_REST: "rest",
  CURFEW: "rule",
  WEEKEND: "rule",
  HOLIDAY: "rule",
  HOS_RESTART: "restart",
};

/** 10 → "10 h", 57.5 → "2 d 9.5 h". */
export function durationLabel(hours: number): string {
  if (hours < 24) return `${Number(hours.toFixed(1))} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Number((hours - days * 24).toFixed(1));
  return remainingHours > 0 ? `${days} d ${remainingHours} h` : `${days} d`;
}

/** "Night + 10 h rest". */
export function stopReasonsLabel(stop: TripStop): string {
  return stop.reasons.map((reason) => HOLD_LABEL[reason]).join(" + ");
}

/** "AR" or "at the AR line" when the load waits to enter the state. */
export function stopPlace(stop: TripStop): string {
  return stop.atStateLine ? `at the ${stop.state} line` : stop.state;
}

/** One line for a tooltip: what holds the load, where and how long. */
export function stopDescription(stop: TripStop): string {
  const why = stop.reasons.map((reason) => HOLD_DETAIL[reason]).join(", then ");
  return (
    `Mile ${miles(stop.routeMile)}, ${stopPlace(stop)} — ${why}${stop.atStateLine ? ` in ${stop.state}` : ""}. ` +
    `${tripMomentLabel(stop.start)} → ${tripMomentLabel(stop.end)} local (${durationLabel(stop.hours)}).`
  );
}
