/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Header, Footer } from "../App";
import { usePageMeta } from "../lib/meta";
import { followInvite } from "../lib/attribution";
import { installLink } from "./business/installLink";

export default function InvitePage() {
  const { code } = useParams();
  usePageMeta({
    title: "You're invited to TruckBox: 14 days free",
    description:
      "A colleague invited you to TruckBox, the Chrome extension for DAT One and Truckstop dispatchers. 14 days free with this invite, no card.",
    noindex: true,
  });

  useEffect(() => {
    followInvite(code ?? "");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [code]);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <section className="ed-section">
          <div className="ed-container" style={{ maxWidth: 820 }}>
            <h1 className="ed-display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", margin: 0, textWrap: "balance" }}>
              A colleague invited you to TruckBox
            </h1>
            <p className="mt-6 text-lg" style={{ color: "var(--muted)", maxWidth: "52ch", lineHeight: 1.6 }}>
              The Chrome extension dispatchers use on DAT One and Truckstop: one-click broker emails from your own
              Gmail or Outlook, broker credit checks, profit per load and OS/OW permit pricing.
            </p>
            <ul className="mt-8 flex flex-col gap-3" style={{ listStyle: "none", padding: 0, margin: "32px 0 0" }}>
              {["14 days free with this invite, instead of 7", "No card to start", "Works on DAT One and Truckstop"].map(
                (line) => (
                  <li key={line} className="flex items-center gap-3" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    <Check aria-hidden className="h-5 w-5" style={{ color: "var(--accent)" }} />
                    {line}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <a className="ed-btn ed-btn-accent" href={installLink("referral", "invite")} target="_blank" rel="noreferrer">
                <span>Add TruckBox to Chrome</span>
              </a>
              <Link className="ed-btn" to="/">
                <span>See what it does</span>
              </Link>
            </div>
            <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
              Install from this browser so the invite counts.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
