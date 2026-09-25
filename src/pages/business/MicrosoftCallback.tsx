/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { MICROSOFT_RESULT_KEY } from "../../lib/microsoft";

export default function MicrosoftCallback() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    try {
      localStorage.setItem(
        MICROSOFT_RESULT_KEY,
        JSON.stringify({
          code: q.get("code"),
          state: q.get("state"),
          error: q.get("error_description") || q.get("error"),
          at: Date.now(),
        }),
      );
    } catch {}
    window.close();
  }, []);
  return <div style={{ padding: 24, fontFamily: "system-ui" }}>You can close this window.</div>;
}
