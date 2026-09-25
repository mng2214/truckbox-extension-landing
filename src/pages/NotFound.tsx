/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Header, Footer } from "../App";
import { usePageMeta } from "../lib/meta";

/**
 * Anything that is not a real route lands here.
 *
 * Until now the catch-all rendered the landing page, so a typo, a stale link or a scanner got the
 * home page back with a 200 — a soft 404 that search engines file as a duplicate of the home page.
 * This page says plainly that the address is wrong and carries noindex, so those URLs stop being
 * indexable while people still get a way back in.
 */
export default function NotFoundPage() {
  usePageMeta({
    title: "Page not found — TruckBox",
    description: "This address does not exist on truckbox.app.",
    noindex: true,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <section className="ed-section">
          <div className="ed-container">
            <span className="ed-label">[ 404 ] — Not found</span>
            <h1 className="ed-h2 mt-4">This page does not exist.</h1>
            <p className="mt-5 max-w-md text-lg" style={{ color: "var(--muted)" }}>
              The address you opened is not part of Truck Box. It may have been a typo, or a link
              that pointed somewhere we never had.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link className="ed-btn" to="/">
                <span>Back to Truck Box</span>
              </Link>
              <Link className="ed-btn" to="/demo">
                <span>Try the demo</span>
              </Link>
              <Link className="ed-btn" to="/guide">
                <span>Setup guide</span>
              </Link>
              <Link className="ed-btn" to="/faq">
                <span>FAQ</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
