import { useEffect } from "react";
import { Header, Footer, TelegramFloat, Privacy } from "../App";

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <Privacy />
      </main>
      <Footer />
      <TelegramFloat />
    </div>
  );
}
