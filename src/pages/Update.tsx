import { useEffect } from "react";
import { Header, Footer, UpdateGuide } from "../App";
import { usePageMeta } from "../lib/meta";

export default function UpdatePage() {
  usePageMeta({ title: "How to Update — TruckBox for DAT & Truckstop", description: "Get the latest TruckBox version right away: open chrome://extensions, turn on Developer mode and click Update.", path: "/update" });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <UpdateGuide />
      </main>
      <Footer />
    </div>
  );
}
