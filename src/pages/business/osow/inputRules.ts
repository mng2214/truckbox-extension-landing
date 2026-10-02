/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// What each calculator input accepts. Sanitizers run on every keystroke so junk never reaches the
// state; the ranges mirror the server's checks (OsowInputValidator / OsowCalculator.toLoadSpec),
// which stay the source of truth.

/** Money and plain numbers: digits, one decimal point, thousands commas. */
export function sanitizeDecimal(text: string, maxLength = 12): string {
  let seenPoint = false;
  let cleaned = "";
  for (const character of text) {
    if (/[0-9,]/.test(character)) cleaned += character;
    else if (character === "." && !seenPoint) {
      cleaned += character;
      seenPoint = true;
    }
  }
  return cleaned.slice(0, maxLength);
}

/** Feet and inches as dispatchers type them: 12'6", 12-6, 12 ft 6 in, 150". */
export function sanitizeDimension(text: string): string {
  return text.replace(/[^0-9.'"\-\sftinFTIN,]/g, "").slice(0, 16);
}

/** "City, ST": letters, spaces, period, apostrophe, hyphen, one comma. */
export function sanitizeCity(text: string): string {
  return text.replace(/[^A-Za-z .,'-]/g, "").slice(0, 80);
}

export function sanitizePhone(text: string): string {
  return text.replace(/[^0-9+().\- ]/g, "").slice(0, 25);
}

export function sanitizeText(text: string, maxLength: number): string {
  // No control characters; length capped like the server column.
  const printable = [...text].filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  });
  return printable.join("").slice(0, maxLength);
}

export function isValidPhone(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "").length;
  return /^[0-9+().\- ]{7,25}$/.test(trimmed) && digits >= 7 && digits <= 15;
}

export function isValidEmail(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return trimmed.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed);
}

export type Range = { min: number; max: number; label: string };

/** Ranges for the numeric fields, keyed by field. */
export const RANGES = {
  escortRatePerMile: { min: 0, max: 50, label: "$0–50 per mile" },
  escortHotelPerNight: { min: 0, max: 2000, label: "$0–2,000 per night" },
  policeCostEach: { min: 0, max: 50000, label: "$0–50,000" },
  averageMph: { min: 15, max: 70, label: "15–70 mph" },
  loadRate: { min: 0, max: 1000000, label: "up to $1,000,000" },
  mpg: { min: 1, max: 20, label: "1–20 mpg" },
  diesel: { min: 0, max: 20, label: "$0–20 per gallon" },
  tolls: { min: 0, max: 100000, label: "up to $100,000" },
  truckRate: { min: 0, max: 100, label: "$0–100 per mile" },
  driverPayPerMile: { min: 0, max: 10, label: "$0–10 per mile" },
  driverPayPercent: { min: 0, max: 100, label: "0–100%" },
  margin: { min: 0, max: 90, label: "0–90%" },
} satisfies Record<string, Range>;

/** Null when the text is blank or within range; otherwise the message to show. */
export function rangeError(text: string, range: Range): string | null {
  const trimmed = text.replace(/,/g, "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return "Enter a number";
  if (value < range.min || value > range.max) return `Must be ${range.label}`;
  return null;
}
