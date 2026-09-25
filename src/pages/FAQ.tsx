/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { Header, Footer, FAQ } from "../App";
import { usePageMeta } from "../lib/meta";

export default function FAQPage() {
  usePageMeta({ title: "FAQ — TruckBox", description: "Answers for dispatchers: how one-click broker emails and Auto Emailer work on the DAT One and Truckstop load boards, Gmail and Outlook permissions, credit checks, the back office, billing and troubleshooting.", path: "/faq" });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <FAQ lead />
      </main>
      <Footer />
    </div>
  );
}
