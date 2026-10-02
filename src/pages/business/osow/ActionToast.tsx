/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";

/** How long a success note stays before it fades, and how long the fade takes (matches osow.css). */
const VISIBLE_MS = 2600;
const LEAVE_MS = 280;

/**
 * The note next to Save quote / PDF after they finish. Success draws a check in a circle and then
 * fades away on its own; a failure stays until the next action so it can be read.
 */
export function ActionToast({ text, ok, onDone }: { text: string; ok: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!ok) return;
    const leaveTimer = window.setTimeout(() => setLeaving(true), VISIBLE_MS);
    const doneTimer = window.setTimeout(onDone, VISIBLE_MS + LEAVE_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
    };
  }, [ok, onDone]);

  return (
    <div role="status" className={"osw-done" + (ok ? "" : " is-error") + (leaving ? " is-leaving" : "")}>
      <svg className="osw-done-mark" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        {ok ? <path d="M7.5 12.5l3 3 6-6.5" /> : <path d="M12 7.5v5.5M12 16.5v.01" />}
      </svg>
      <span>{text}</span>
    </div>
  );
}
