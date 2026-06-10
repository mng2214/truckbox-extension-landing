import { useEffect } from "react";
import { Header, Footer, Guide } from "../App";

export default function GuidePage() {
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
