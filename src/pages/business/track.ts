/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { api } from "../../lib/api";
import { auth } from "../../lib/auth";

/**
 * Records what someone does in the back office, on the same analytics endpoint the extension
 * uses. Fire-and-forget: a failed count must never surface as an error in a working cabinet.
 */
export function trackCabinet(type: "CABINET_OPENED" | "CABINET_PANEL", detail?: string): void {
  if (!auth.isAuthed()) return;
  void api
    .post("/api/v1/analytics/usage", { type, platform: null, detail: detail ?? null })
    .catch(() => {});
}
