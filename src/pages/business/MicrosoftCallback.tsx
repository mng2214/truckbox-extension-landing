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
        }),
      );
    } catch {
      /* storage blocked — the opener reports "cancelled" */
    }
    window.close();
  }, []);
  return <div style={{ padding: 24, fontFamily: "system-ui" }}>You can close this window.</div>;
}
