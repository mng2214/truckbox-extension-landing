/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Carrier profit / broker quote on top of an OS/OW result. Client-side only.

import { loadJson, readNumber, saveJson } from "./format";
import type { CalculateResponse, DriverPayMode, EconomicsSnapshot, QuoteMode } from "./types";

export type EconForm = {
  mode: QuoteMode;
  loadRate: string;
  mpg: string;
  diesel: string;
  tolls: string;
  truckRate: string;
  /** Carrier: how the driver is paid; each mode keeps its own number so switching loses nothing. */
  driverPayMode: DriverPayMode;
  driverPayPerMile: string;
  driverPayPercent: string;
  margin: string;
  itemize: boolean;
};

const STORAGE_KEY = "tb-osow-econ";

/**
 * TruckBox serves carriers today, so only the carrier view is shown. The broker quote math stays
 * here; flip this to bring the Carrier / Broker switch back.
 */
export const BROKER_MODE_ENABLED = false;

function allowedMode(mode: unknown): QuoteMode {
  return BROKER_MODE_ENABLED && mode === "broker" ? "broker" : "carrier";
}

function allowedDriverPayMode(mode: unknown): DriverPayMode {
  return mode === "percent_of_load" ? "percent_of_load" : "per_mile";
}

/**
 * The driver's pay for this load, and what it was worked out from. A share of the load is taken
 * from the rate minus permits, escorts and police — money that only passes through.
 */
export function driverPayFor(
  econ: EconForm,
  routeMiles: number,
  passThrough: number,
): { amount: number | null; note: string; payBase: number | null } {
  if (econ.driverPayMode === "per_mile") {
    const payPerMile = readNumber(econ.driverPayPerMile);
    if (payPerMile == null) return { amount: null, note: "Set the pay per mile", payBase: null };
    return {
      amount: payPerMile * routeMiles,
      note: `$${payPerMile.toFixed(2)}/mi × ${Math.round(routeMiles).toLocaleString("en-US")} mi`,
      payBase: null,
    };
  }
  const loadRate = readNumber(econ.loadRate);
  const payBase = loadRate == null ? null : Math.max(0, loadRate - passThrough);
  const percent = readNumber(econ.driverPayPercent);
  if (percent == null) return { amount: null, note: "Set the % of the load", payBase };
  if (payBase == null) return { amount: null, note: `${percent}% — enter the load rate`, payBase };
  return {
    amount: (payBase * percent) / 100,
    note: `${percent}% of $${Math.round(payBase).toLocaleString("en-US")}`,
    payBase,
  };
}

export function loadEcon(): EconForm {
  // Preferences persist; lane-specific numbers (rate, tolls, diesel) start blank every visit.
  const saved = loadJson<Partial<EconForm>>(STORAGE_KEY, {});
  return {
    mode: allowedMode(saved.mode),
    loadRate: "",
    mpg: typeof saved.mpg === "string" && saved.mpg ? saved.mpg : "6",
    diesel: "",
    tolls: "",
    truckRate: typeof saved.truckRate === "string" ? saved.truckRate : "",
    driverPayMode: allowedDriverPayMode(saved.driverPayMode),
    driverPayPerMile: typeof saved.driverPayPerMile === "string" ? saved.driverPayPerMile : "",
    driverPayPercent: typeof saved.driverPayPercent === "string" ? saved.driverPayPercent : "",
    margin: typeof saved.margin === "string" && saved.margin ? saved.margin : "15",
    itemize: saved.itemize !== false,
  };
}

export function persistEcon(econ: EconForm): void {
  saveJson(STORAGE_KEY, {
    mode: econ.mode,
    mpg: econ.mpg,
    truckRate: econ.truckRate,
    driverPayMode: econ.driverPayMode,
    driverPayPerMile: econ.driverPayPerMile,
    driverPayPercent: econ.driverPayPercent,
    margin: econ.margin,
    itemize: econ.itemize,
  });
}

export function toSnapshot(econ: EconForm): EconomicsSnapshot {
  return {
    mode: econ.mode,
    loadRate: readNumber(econ.loadRate),
    mpg: readNumber(econ.mpg),
    dieselPerGal: readNumber(econ.diesel),
    tolls: readNumber(econ.tolls),
    truckRatePerMile: readNumber(econ.truckRate),
    driverPayMode: econ.driverPayMode,
    driverPayPerMile: readNumber(econ.driverPayPerMile),
    driverPayPercent: readNumber(econ.driverPayPercent),
    marginPct: readNumber(econ.margin),
    itemize: econ.itemize,
  };
}

export function fromSnapshot(snapshot: EconomicsSnapshot | null | undefined, base: EconForm): EconForm {
  if (!snapshot) return base;
  const asText = (value: number | null | undefined) => (value == null ? "" : String(value));
  return {
    mode: allowedMode(snapshot.mode),
    loadRate: asText(snapshot.loadRate),
    mpg: asText(snapshot.mpg) || base.mpg,
    diesel: asText(snapshot.dieselPerGal),
    tolls: asText(snapshot.tolls),
    truckRate: asText(snapshot.truckRatePerMile),
    driverPayMode: snapshot.driverPayMode ? allowedDriverPayMode(snapshot.driverPayMode) : base.driverPayMode,
    driverPayPerMile: asText(snapshot.driverPayPerMile) || base.driverPayPerMile,
    driverPayPercent: asText(snapshot.driverPayPercent) || base.driverPayPercent,
    margin: asText(snapshot.marginPct) || base.margin,
    itemize: snapshot.itemize !== false,
  };
}

export type LedgerLine = { label: string; amount: number | null; kind?: "sub" | "total" | "neg" | "pos"; note?: string };

export type Ledger = {
  lines: LedgerLine[];
  headline: { label: string; value: number | null; perMile: number | null };
  passThrough: number;
};

/**
 * Carrier: rate − permits − escorts − fuel − tolls − driver pay = profit.
 * Broker: (truck + pass-through) ÷ (1 − margin) = customer price.
 */
export function computeLedger(result: CalculateResponse, econ: EconForm): Ledger {
  const routeMiles = result.routeMiles || 0;
  const totals = result.totals;
  const permits = totals.permits || 0;
  const escorts = totals.escorts || 0;
  const police = totals.police || 0;
  const passThrough = permits + escorts + police;
  const perMile = (value: number | null) => (value != null && routeMiles > 0 ? value / routeMiles : null);

  if (econ.mode === "carrier") {
    const loadRate = readNumber(econ.loadRate);
    const mpg = readNumber(econ.mpg);
    const diesel = readNumber(econ.diesel);
    const typedTolls = readNumber(econ.tolls);
    const routeTolls = result.routeTollsUsd ?? null;
    const tolls = typedTolls ?? routeTolls ?? 0;
    const fuel = mpg && mpg > 0 && diesel != null ? (routeMiles / mpg) * diesel : null;
    const driverPay = driverPayFor(econ, routeMiles, passThrough);
    const costs = passThrough + (fuel ?? 0) + tolls + (driverPay.amount ?? 0);
    const profit = loadRate != null ? loadRate - costs : null;
    const missing = [fuel == null ? "fuel" : null, driverPay.amount == null ? "driver pay" : null].filter(Boolean);
    const headlineLabel = profit != null && missing.length ? `Profit before ${missing.join(" & ")}` : "Profit";
    return {
      passThrough,
      lines: [
        { label: "Load rate", amount: loadRate },
        { label: "Permits", amount: -permits, kind: "sub" },
        { label: "Escorts", amount: -escorts, kind: "sub" },
        ...(police ? [{ label: "Police escorts", amount: -police, kind: "sub" as const }] : []),
        {
          label: "Fuel",
          amount: fuel == null ? null : -fuel,
          kind: "sub",
          note: fuel == null ? "Set mpg and diesel" : `${Math.round(routeMiles / (mpg as number)).toLocaleString("en-US")} gal`,
        },
        {
          label: "Tolls",
          amount: -tolls,
          kind: "sub",
          note: typedTolls != null ? "Your amount" : routeTolls != null ? "Route estimate" : "Not priced",
        },
        {
          label: "Driver pay",
          amount: driverPay.amount == null ? null : -driverPay.amount,
          kind: "sub",
          note: driverPay.note,
        },
        { label: headlineLabel, amount: profit, kind: profit != null && profit < 0 ? "neg" : "total" },
      ],
      headline: { label: headlineLabel, value: profit, perMile: perMile(profit) },
    };
  }

  const truckRate = readNumber(econ.truckRate);
  const marginPercent = Math.min(90, Math.max(0, readNumber(econ.margin) ?? 0));
  const linehaul = truckRate != null ? truckRate * routeMiles : null;
  const cost = linehaul != null ? linehaul + passThrough : null;
  const customerPrice = cost != null ? cost / (1 - marginPercent / 100) : null;
  const marginUsd = customerPrice != null && cost != null ? customerPrice - cost : null;
  return {
    passThrough,
    lines: [
      {
        label: "Truck",
        amount: linehaul,
        note:
          truckRate != null
            ? `$${truckRate.toFixed(2)}/mi × ${Math.round(routeMiles).toLocaleString("en-US")} mi`
            : "Set the truck $/mi",
      },
      { label: "Permits (pass-through)", amount: permits, kind: "sub" },
      { label: "Escorts (pass-through)", amount: escorts, kind: "sub" },
      ...(police ? [{ label: "Police escorts (pass-through)", amount: police, kind: "sub" as const }] : []),
      { label: `Margin ${marginPercent}%`, amount: marginUsd, kind: "pos" },
      { label: "Customer price", amount: customerPrice, kind: "total" },
    ],
    headline: { label: "Customer price", value: customerPrice, perMile: perMile(customerPrice) },
  };
}
