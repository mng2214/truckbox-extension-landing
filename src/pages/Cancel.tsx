import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Header, Footer, Reveal, INSTALL_URL } from "../App";

export default function CancelPage() {
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
            <h1
              className="ed-display text-[12vw] lg:text-[6rem] leading-[0.95]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Sorry to
              <br />
              <span className="ed-accent">see you go</span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
              No charge was made and nothing changed on your account. If something didn&rsquo;t feel
              right or you have a question, reach out — we&rsquo;d love to help, and your feedback
              makes Truck Box better.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link className="ed-btn ed-btn-accent" to="/#contact">
                <span>Contact us</span> <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a className="ed-btn" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>Try again</span>
              </a>
              <Link className="ed-btn" to="/">
                <span>Back to home</span>
              </Link>
            </div>

            <p className="mt-8 ed-label" style={{ letterSpacing: "0.12em", color: "var(--muted)" }}>
              Changed your mind? You can subscribe anytime.
            </p>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
