import { useEffect } from "react";
import { Header, Footer, Guide } from "../App";
import { usePageMeta } from "../lib/meta";

export default function GuidePage() {
  usePageMeta({ title: "Setup Guide — TruckBox for DAT & Truckstop", description: "Five-minute setup: install the TruckBox Chrome extension, connect Gmail, and send your first one-click broker email from DAT One or Truckstop.", path: "/guide" });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <Guide />
      </main>
      <Footer />
    </div>
  );
}
