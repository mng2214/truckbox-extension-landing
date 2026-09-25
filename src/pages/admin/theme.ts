/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

export const ADMIN_THEME_KEY = "tb-visits-theme";

export function readAdminTheme(): boolean {
  try {
    return localStorage.getItem(ADMIN_THEME_KEY) === "day";
  } catch {
    return false;
  }
}

export function writeAdminTheme(day: boolean): void {
  try {
    localStorage.setItem(ADMIN_THEME_KEY, day ? "day" : "night");
  } catch {}
}
