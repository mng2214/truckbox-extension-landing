/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { api, ApiError } from "../../../lib/api";
import type {
  CalculateRequest,
  CalculateResponse,
  EconomicsSnapshot,
  OsowAccess,
  QuoteDetail,
  QuoteInput,
  QuoteMode,
  QuoteSummary,
  StateCoverage,
} from "./types";

export const OSOW_NOT_AVAILABLE = 1074;
export const OSOW_DAILY_LIMIT_REACHED = 1075;
export const OSOW_QUOTE_NOT_FOUND = 1076;
export const OSOW_QUOTE_LIMIT_REACHED = 1077;
export const OSOW_TERMS_NOT_ACCEPTED = 1078;

const BASE = "/api/v1/osow";

export function calculate(req: CalculateRequest): Promise<CalculateResponse> {
  return api.post<CalculateResponse>(`${BASE}/calculate`, req);
}

export function getStates(): Promise<StateCoverage[]> {
  return api.get<StateCoverage[]>(`${BASE}/states`);
}

export function getAccess(): Promise<OsowAccess> {
  return api.get<OsowAccess>(`${BASE}/access`);
}

export function acceptTerms(version: string): Promise<OsowAccess> {
  return api.post<OsowAccess>(`${BASE}/terms/accept`, { version });
}

export function listQuotes(): Promise<QuoteSummary[]> {
  return api.get<QuoteSummary[]>(`${BASE}/quotes`);
}

export function getQuote(id: number): Promise<QuoteDetail> {
  return api.get<QuoteDetail>(`${BASE}/quotes/${id}`);
}

export function saveQuote(body: {
  name: string;
  mode: QuoteMode;
  input: QuoteInput;
  result: CalculateResponse;
  economics: EconomicsSnapshot;
  brokerName: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
}): Promise<QuoteSummary> {
  return api.post<QuoteSummary>(`${BASE}/quotes`, body);
}

export function deleteQuote(id: number): Promise<void> {
  return api.del<void>(`${BASE}/quotes/${id}`);
}

export type DieselQuote = { pricePerGallon: number | null; asOf: string | null; source: string | null };

export function getDiesel(): Promise<DieselQuote> {
  return api.get<DieselQuote>("/api/v1/fuel/diesel");
}



export function isFeatureOff(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404 && e.code === OSOW_NOT_AVAILABLE;
}

/** One friendly sentence for any OS/OW failure. */
export function osowErrorMessage(e: unknown, fallback: string, dailyCap?: number | null): string {
  if (!(e instanceof ApiError)) return fallback;
  if (e.code === OSOW_NOT_AVAILABLE) {
    return "The OS/OW calculator is switched off for now. Please check back later.";
  }
  if (e.code === OSOW_DAILY_LIMIT_REACHED || e.status === 429) {
    return dailyCap
      ? `You've reached today's fair-use limit of ${dailyCap} calculations. It resets at midnight Central.`
      : "You've reached today's fair-use limit of calculations. It resets at midnight Central.";
  }
  if (e.code === OSOW_QUOTE_NOT_FOUND) return "This saved quote no longer exists.";
  if (e.code === OSOW_QUOTE_LIMIT_REACHED) {
    return "You've hit the saved-quotes limit. Delete a few old quotes and save again.";
  }
  if (e.status === 400) {
    return e.message && !/^HTTP \d+$/.test(e.message) && !/one of the fields invalid/i.test(e.message)
      ? e.message
      : "Check the load: width, height, length and weight must be above zero, axles 2–20.";
  }
  if (e.status >= 500) return "The server hit a problem. Try again in a minute.";
  return fallback;
}
