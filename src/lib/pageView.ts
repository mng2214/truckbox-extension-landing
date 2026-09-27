/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { API_BASE, deviceId, sessionId } from "./api";
import { auth } from "./auth";

export type PageViewEvent =
  | "open"
  | "login"
  | "reveal"
  | "admin_denied"
  | "leave"
  | "copy"
  | "devtools";

function screenSize(): string {
  try {
    return `${window.screen.width}x${window.screen.height}`;
  } catch {
    return "";
  }
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function reportPageView(
  event: PageViewEvent,
  path: string = window.location.pathname,
  durationSeconds?: number,
) {
  try {
    const body = JSON.stringify({
      event,
      path,
      referrer: document.referrer || null,
      deviceId: deviceId(),
      sessionId: sessionId(),
      language: navigator.language || null,
      timezone: timezone() || null,
      platform: (navigator as Navigator & { platform?: string }).platform || null,
      screen: screenSize() || null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      touch: navigator.maxTouchPoints > 0,
      token: auth.getToken(),
      durationSeconds: durationSeconds ?? null,
    });
    void fetch(API_BASE + "/api/v1/public/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    return;
  }
}
