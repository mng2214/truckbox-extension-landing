import { useEffect } from "react";
import { Header, Footer, Privacy } from "../App";
import { usePageMeta } from "../lib/meta";

export default function PrivacyPage() {
  usePageMeta({ title: "Privacy & Terms — TruckBox", description: "How TruckBox handles your data: Google sign-in only, no password storage, emails sent from your own Gmail. Full privacy policy and terms of service.", path: "/privacy" });
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
    </div>
  );
}
