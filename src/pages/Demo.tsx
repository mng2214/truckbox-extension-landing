import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { Header, Footer, TelegramFloat, LoadBoardDemo, RouteShowcase, INSTALL_URL } from "../App";

export default function DemoPage() {
  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />

      <main>
        <section className="ed-section" style={{ paddingTop: 120, paddingBottom: 24 }}>
          <div className="ed-container">
            <span className="ed-label">Live demo</span>
            <h1 className="ed-h2 mt-4">
              Try Truck Box <span className="ed-accent">live</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg" style={{ color: "var(--muted)" }}>
              A working preview of the DAT board with Truck Box buttons. Click the
              envelope to send, the route to open Google Maps. Sample data, no real
              email is sent.
            </p>
            <div className="mt-6">
              <a
                className="ed-btn ed-btn-accent"
                href={INSTALL_URL}
                target="_blank"
                rel="noreferrer"
              >
                <span>Install Extension</span> <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <LoadBoardDemo />

        <RouteShowcase />

        <section className="ed-section" style={{ paddingTop: 8 }}>
          <div className="ed-container">
            <Link className="ed-btn" to="/">
              <ArrowLeft className="h-4 w-4" /> <span>Back to home</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
      <TelegramFloat />
    </div>
  );
}
