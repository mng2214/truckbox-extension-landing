import { useEffect } from "react";
import { Header, Footer, FAQ } from "../App";
import { usePageMeta } from "../lib/meta";

export default function FAQPage() {
  usePageMeta({ title: "FAQ — TruckBox", description: "Common questions about TruckBox: getting started, subscription and cancellation, Gmail permissions, supported load boards and team setup.", path: "/faq" });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
