import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import { Header, Footer, Reveal, INSTALL_URL } from "../App";

export default function SuccessPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />

      <main className="flex-1 flex items-center" style={{ paddingTop: 120, paddingBottom: 96 }}>
        <div className="ed-container w-full">
          <Reveal>
            <span
              className="inline-flex items-center gap-2.5 mb-8"
              style={{ color: "var(--muted)" }}
            >
            </span>

            <h1
              className="ed-display text-[12vw] lg:text-[6rem] leading-[0.95]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Thank you for
              <br />
              <span className="ed-accent">subscribing</span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
              You&rsquo;re all set — Truck Box is now unlocked for your account. Open the extension
              inside DAT and keep sending broker emails in one click. We&rsquo;re glad to have you on board.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link className="ed-btn ed-btn-accent" to="/#contact">
                <span>Contact us</span> <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a className="ed-btn" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>Open extension</span>
              </a>
              <Link className="ed-btn" to="/">
                <span>Back to home</span>
              </Link>
            </div>

            <p className="mt-8 ed-label" style={{ letterSpacing: "0.12em", color: "var(--muted)" }}>
              Any questions? Message us directly — we reply fast.
            </p>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
