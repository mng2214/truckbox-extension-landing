/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { Header, Footer, Privacy } from "../App";
import { usePageMeta } from "../lib/meta";

export default function PrivacyPage() {
  usePageMeta({ title: "Privacy & Terms — TruckBox", description: "How TruckBox handles your data: Google sign-in only, no password storage, emails sent from your own Gmail. Full privacy policy and terms of service.", path: "/privacy" });
  useEffect(() => {
    // Links like /privacy#terms-osow (from the OS/OW calculator) land on that section.
    const sectionId = window.location.hash.slice(1);
    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    // After layout settles (fonts, header), so the heading clears the fixed header.
    const timer = window.setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (!section) return;
      const headerOffset = 110;
      window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - headerOffset, behavior: "auto" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <Privacy lead />
      </main>
      <Footer />
    </div>
  );
}
