/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Header, Footer } from "../App";
import { usePageMeta } from "../lib/meta";
import { API_BASE } from "../lib/api";

export default function UnsubscribePage() {
  const { token } = useParams();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  usePageMeta({ title: "Unsubscribed | TruckBox", description: "No more TruckBox invites to this address.", noindex: true });

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/v1/public/unsubscribe/${encodeURIComponent(token ?? "")}`, { method: "POST", credentials: "omit" })
      .then((response) => {
        if (active) setState(response.ok ? "done" : "failed");
      })
      .catch(() => {
        if (active) setState("failed");
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen">
      <Header />
      <main style={{ paddingTop: 64 }}>
        <section className="ed-section">
          <div className="ed-container" style={{ maxWidth: 720 }}>
            <h1 className="ed-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: 0 }}>
              {state === "failed" ? "That didn't go through" : "You won't get more invites"}
            </h1>
            <p className="mt-6 text-lg" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              {state === "working" && "One moment…"}
              {state === "done" && "TruckBox won't send invites to this address again, whoever asks."}
              {state === "failed" && "Try the link again in a minute, or write to info@truckbox.app and we'll take your address off."}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
