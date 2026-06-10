import { useEffect } from "react";
import { Header, Footer, FAQ } from "../App";

export default function FAQPage() {
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
