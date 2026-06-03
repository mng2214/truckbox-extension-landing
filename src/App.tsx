import { useEffect, useRef, useState, Fragment, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Lenis from "lenis";

import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Minus,
  Play,
  Menu,
  X,
  Instagram,
  Facebook,
  Mail,
  MapPin,
  Check,
  Gauge,
  Filter,
  Keyboard,
  ShieldCheck,
  ChevronDown,
  RotateCw,
} from "lucide-react";

type NavItem = { href: string; label: string; route?: boolean };

const NAV: NavItem[] = [
  { href: "/demo", label: "Live demo", route: true },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#learning", label: "Learning" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy", route: true },
  { href: "/#contact", label: "Contact" },
];

const INSTALL_URL =
  "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd";
const CALENDLY_URL = "https://calendly.com/truckboxapp";
const TELEGRAM_URL = "https://t.me/mngartur";
const YOUTUBE_ID = "-_G0P-M1lCA";

const EASE = [0.16, 1, 0.3, 1] as const;

export { NAV, INSTALL_URL, CALENDLY_URL, TELEGRAM_URL };

/* ============================================================
   Global chrome: custom cursor + smooth scroll
   (mounted once in main.tsx so every route gets them)
   ============================================================ */

export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let active = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dot.current) dot.current.style.transform = `translate(${mx}px, ${my}px)`;
      const t = (e.target as HTMLElement)?.closest?.("a, button, [data-cursor]");
      active = !!t;
    };
    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      if (ring.current)
        ring.current.style.transform = `translate(${rx}px, ${ry}px) scale(${active ? 2.1 : 1})`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      root.classList.remove("has-cursor");
    };
  }, []);

  return (
    <>
      <div ref={ring} className="ed-cursor" aria-hidden />
      <div ref={dot} className="ed-cursor-dot" aria-hidden />
    </>
  );
}

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const hash = href.startsWith("#")
        ? href
        : href.startsWith("/#")
        ? href.slice(1)
        : "";
      if (hash.length > 1) {
        const el = document.querySelector(hash);
        if (el) {
          e.preventDefault();
          lenis.scrollTo(el as HTMLElement, { offset: -90 });
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, []);
  return null;
}

/* ============================================================
   Motion primitives
   ============================================================ */

export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Headline whose lines slide up out of a clip mask.
 *  `play` animates on mount (use for above-the-fold text that must show
 *  immediately); otherwise it triggers when scrolled into view. */
function MaskLines({
  lines,
  className,
  delay = 0,
  play = false,
}: {
  lines: React.ReactNode[];
  className?: string;
  delay?: number;
  play?: boolean;
}) {
  const trigger = play
    ? { animate: { y: 0 } }
    : { whileInView: { y: 0 }, viewport: { once: true, margin: "-60px" } };
  return (
    <div className={className}>
      {lines.map((ln, i) => (
        <span className="ed-mask" key={i}>
          <motion.span
            style={{ display: "block", willChange: "transform", paddingBottom: "0.12em" }}
            initial={{ y: "115%" }}
            {...trigger}
            transition={{ duration: 1, delay: delay + i * 0.09, ease: EASE }}
          >
            {ln}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   App shell
   ============================================================ */

export default function App() {
  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main>
        <Hero />
        <Marquee />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Pricing />
        <Learning />
        <FAQ />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
      <TelegramFloat />
    </div>
  );
}

/* ============================================================
   Brand logos (inline SVG)
   ============================================================ */

function ChromeLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path d="M24 24 L4.95 13 A22 22 0 0 1 43.05 13 Z" fill="#ea4335" />
      <path d="M24 24 L24 46 A22 22 0 0 1 4.95 13 Z" fill="#34a853" />
      <path d="M24 24 L43.05 13 A22 22 0 0 1 24 46 Z" fill="#fbbc05" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="7" fill="#4285f4" />
    </svg>
  );
}

function OperaLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <ellipse cx="24" cy="24" rx="14" ry="20" fill="#ff1b2d" />
      <ellipse cx="24" cy="24" rx="6.4" ry="12.4" fill="#fff" />
    </svg>
  );
}

function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

/* ============================================================
   Route showcase — in-DAT route panel (anonymized demo data)
   + Chrome / Opera / Google support strip
   ============================================================ */

function RouteMapArt() {
  return (
    <div
      style={{
        position: "relative",
        height: 200,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #e2e8f0",
      }}
    >
      <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
        <rect width="400" height="200" fill="#e9f1f7" />
        <path d="M0 120 Q120 90 260 130 T400 120 V200 H0 Z" fill="#dfeede" />
        <path d="M-20 60 Q80 40 180 70 T420 60 V0 H-20 Z" fill="#e7eef6" />
        <g stroke="#cdd7e3" strokeWidth="2" fill="none">
          <path d="M40 40 L360 60" />
          <path d="M20 150 L380 120" />
          <path d="M120 0 L150 200" />
        </g>
        <path d="M300 96 C250 110 180 96 96 104" stroke="#1a73e8" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="300" cy="96" r="6" fill="#1a73e8" stroke="#fff" strokeWidth="2.5" />
        <g transform="translate(96,104)">
          <path d="M0 -14 C7 -14 11 -9 11 -3 C11 5 0 14 0 14 C0 14 -11 5 -11 -3 C-11 -9 -7 -14 0 -14 Z" fill="#ea4335" stroke="#fff" strokeWidth="2" />
          <circle cx="0" cy="-3" r="3.5" fill="#fff" />
        </g>
      </svg>
      <span style={{ position: "absolute", left: 10, bottom: 8, fontSize: 10, color: "#64748b", background: "rgba(255,255,255,.78)", padding: "2px 6px", borderRadius: 4 }}>
        Google
      </span>
    </div>
  );
}

function RateRow({ k, v, big = false }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "7px 0", borderBottom: "1px solid #eef2f7" }}>
      <span style={{ color: "#64748b", fontSize: 13 }}>{k}</span>
      <span style={{ fontWeight: 700, fontSize: big ? 18 : 14, color: "#1e293b" }}>{v}</span>
    </div>
  );
}

function BrowserSupport() {
  const item: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    letterSpacing: "0.06em",
  };
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
      <span className="ed-label">Works in</span>
      <span style={item}>
        <ChromeLogo /> Chrome
      </span>
      <span style={item}>
        <OperaLogo /> Opera
      </span>
      <span aria-hidden className="hidden sm:block" style={{ width: 1, height: 18, background: "var(--line-strong)" }} />
      <span style={item}>
        <GoogleGLogo /> Sign in with Google
      </span>
    </div>
  );
}

export function RouteShowcase() {
  const ink = "#1e293b";
  const sub = "#64748b";
  const link = "#2563eb";
  const grey = "#f3f4f6";

  const stats = [
    { k: "Loaded", v: "199 mi", hi: false },
    { k: "Deadhead", v: "40 mi", hi: false },
    { k: "Total", v: "239 mi", hi: true },
    { k: "RPM (w/DH)", v: "$3.45", hi: true },
  ];

  const headerBar: CSSProperties = {
    background: grey,
    color: "#636d78",
    fontWeight: 600,
    fontSize: 13,
    padding: "9px 12px",
    borderRadius: 4,
    marginBottom: 14,
  };

  return (
    <section id="route" className="ed-section" style={{ paddingTop: 24 }}>
      <div className="ed-container">
        <div className="mb-8 text-center md:text-left">
          <span className="ed-label">Inside the load</span>
          <h2 className="ed-h2 mt-4">
            Route, miles &amp; credit, <span className="ed-accent">right in DAT</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg mx-auto md:mx-0" style={{ color: "var(--muted)" }}>
            Truck Box drops a live route map into the load details — loaded vs. deadhead
            miles, a true rate-per-mile that counts the empty leg, and broker credit at a
            glance. Works in Chrome and Opera.
          </p>
        </div>

        <Reveal>
          <div
            className="relative overflow-hidden mx-auto"
            style={{ borderRadius: 16, border: "1px solid var(--line)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}
          >
            {/* browser chrome */}
            <div className="flex items-center gap-3 px-4" style={{ height: 44, background: "#0c111d", borderBottom: "1px solid var(--line)" }}>
              <span className="flex gap-2" aria-hidden>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#ff5f57", display: "inline-block" }} />
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#febc2e", display: "inline-block" }} />
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#28c840", display: "inline-block" }} />
              </span>
              <span className="ed-label flex-1 text-center truncate" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "5px 14px", letterSpacing: "0.04em" }}>
                one.dat.com/search-loads
              </span>
              <span className="ed-label hidden sm:block ed-accent">Truck Box</span>
            </div>

            {/* panel body (light) */}
            <div style={{ background: "#fff", color: ink, padding: 22 }}>
              <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 20 }}>
                <span style={{ fontWeight: 800, fontSize: 18 }}>Chicago, IL</span>
                <span style={{ color: link }}>→</span>
                <span style={{ fontWeight: 800, fontSize: 18 }}>Farley, IA</span>
                <span style={{ color: sub, fontSize: 13, marginLeft: 4 }}>199 mi</span>
              </div>

              <div className="grid md:grid-cols-[1.35fr_1fr]" style={{ gap: 24 }}>
                {/* LEFT — the route feature */}
                <div>
                  <div style={headerBar}>Route — Powered by TruckBox</div>

                  <div className="flex flex-wrap" style={{ gap: 18, marginBottom: 14 }}>
                    {stats.map((s) => (
                      <div key={s.k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 10, letterSpacing: "0.4px", textTransform: "uppercase", color: sub, fontWeight: 600 }}>{s.k}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: s.hi ? "#0046E0" : ink }}>{s.v}</span>
                      </div>
                    ))}
                  </div>

                  <RouteMapArt />

                  <div style={{ textAlign: "right", marginTop: 8 }}>
                    <span style={{ color: link, fontWeight: 600, fontSize: 12 }}>Open in Google Maps ↗</span>
                  </div>

                  <div style={{ marginTop: 14, display: "inline-flex", flexDirection: "column", gap: 7, padding: "9px 12px", borderRadius: 10, border: "1px solid #bcdcf3", background: "#eef6fd" }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#0a6cb8", letterSpacing: 0.5 }}>RTS</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.3px" }}>Broker credit</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>Soon</span>
                    </div>
                    <div className="flex items-center" style={{ gap: 9 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 999, background: "#94a3b8", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>?</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#0a6cb8", background: "#fff", border: "1px solid #bcdcf3", borderRadius: 8, padding: "6px 10px" }}>Check credit</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT — rate + company (anonymized demo data) */}
                <div>
                  <div style={headerBar}>Rate</div>
                  <RateRow k="Total" v="$824" big />
                  <RateRow k="Trip" v="199 mi" />
                  <RateRow k="Rate / mile" v="$4.14" />

                  <div style={{ ...headerBar, marginTop: 22 }}>Company</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Demo Logistics LLC</div>
                  <div style={{ color: sub, fontSize: 13, marginTop: 6 }}>MC# 000000 · Chicago, IL</div>
                  <div style={{ color: link, fontSize: 13, marginTop: 6 }}>dispatch@demologistics.co</div>
                  <div style={{ color: sub, fontSize: 13, marginTop: 4 }}>(312) 555-0199</div>
                  <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0a6cb8", background: "#eef6fd", border: "1px solid #bcdcf3", borderRadius: 8, padding: "6px 10px" }}>Factoring Eligible</span>
                    <span style={{ color: "#f59e0b", fontSize: 14 }}>★★★★<span style={{ color: "#cbd5e1" }}>★</span></span>
                    <span style={{ color: sub, fontSize: 12 }}>(189)</span>
                  </div>
                  <div style={{ fontSize: 11, color: sub, marginTop: 16 }}>Demo data — broker details are illustrative.</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <BrowserSupport />
      </div>
    </section>
  );
}

/* ============================================================
   Expandable load detail (mimics DAT's load-details panel)
   ============================================================ */

function parseMoney(s: string): number | null {
  const m = String(s).replace(/[, ]/g, "").match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function Stat({ k, v, hi = false }: { k: string; v: string; hi?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.4px", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>{k}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: hi ? "#0046E0" : "#1e293b" }}>{v}</span>
    </div>
  );
}

function LoadDetailPanel({
  l,
  sent,
  onSend,
  onRoute,
}: {
  l: DemoLoad;
  sent: boolean;
  onSend: () => void;
  onRoute: () => void;
}) {
  const ink = "#1e293b";
  const sub = "#64748b";
  const link = "#2563eb";
  const grey = "#f3f4f6";

  const tripN = parseMoney(l.trip) ?? 0;
  const dh = l.dh ?? 0;
  const totalMi = tripN + dh;
  const rateN = parseMoney(l.rate);
  const fmtMi = (n: number) => n.toLocaleString("en-US") + " mi";
  const rpmDh = rateN && totalMi ? "$" + (rateN / totalMi).toFixed(2) : "—";
  const ratePerMile = rateN && tripN ? "$" + (rateN / tripN).toFixed(2) : "—";
  const truckType = l.equip === "VR" ? "Van/Reefer" : l.equip === "R" ? "Reefer" : "Van";

  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    const lines = [
      `${l.origin} -> ${l.dest}`,
      "",
      `Pickup: ${l.pickup}`,
      `Origin: ${l.origin}`,
      `Destination: ${l.dest}`,
      dh ? `Deadhead: ${fmtMi(dh)}` : "",
      `Loaded: ${fmtMi(tripN)}`,
      dh ? `Total: ${fmtMi(totalMi)}` : "",
      `Weight: ${l.weight}`,
    ].filter((x) => x !== "");
    navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const openFmcsa = () =>
    window.open("https://safer.fmcsa.dot.gov/CompanySnapshot.aspx", "_blank", "noopener");

  const headerBar: CSSProperties = { background: grey, color: "#636d78", fontWeight: 600, fontSize: 13, padding: "9px 12px", borderRadius: 4, marginBottom: 14 };

  return (
    <div style={{ padding: "10px 4px 20px", color: ink }}>
      <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 18 }}>
        <span style={{ fontWeight: 800, fontSize: 18 }}>{l.origin}</span>
        <span style={{ color: link }}>→</span>
        <span style={{ fontWeight: 800, fontSize: 18 }}>{l.dest}</span>
        <span style={{ color: sub, fontSize: 13, marginLeft: 4 }}>{l.trip} mi</span>
      </div>

      <div className="tb-demo-detail-grid">
        {/* Trip */}
        <div>
          <div style={headerBar}>Trip</div>
          <div style={{ fontWeight: 700 }}>{l.origin}{dh ? ` (${dh})` : ""}</div>
          <div style={{ color: sub, fontSize: 13, margin: "2px 0 12px" }}>Pickup {l.pickup}</div>
          <div style={{ fontWeight: 700 }}>{l.dest}</div>

          <div style={{ marginTop: 16, fontSize: 13, color: sub, lineHeight: 1.9 }}>
            <div style={{ fontWeight: 700, color: ink, marginBottom: 2 }}>Equipment</div>
            <div>Load — Full</div>
            <div>Truck — {truckType}</div>
            <div>Length — {l.length}</div>
            <div>Weight — {l.weight}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: sub, textTransform: "uppercase", letterSpacing: "0.4px" }}>Contact</span>
            <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
              <button type="button" onClick={onSend} className="tb-demo-send tb-pulse" data-sent={sent ? "1" : undefined} title="Truck Box: send email to broker" aria-label={`Send email to ${l.broker}`}>
                {sent ? <Check style={{ width: 15, height: 15 }} /> : <Mail style={{ width: 15, height: 15 }} />}
              </button>
              <span style={{ color: link, fontSize: 13 }}>{l.email}</span>
            </div>
          </div>

          {l.comments && (
            <div style={{ marginTop: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: sub, textTransform: "uppercase", letterSpacing: "0.4px" }}>Comments</span>
              <div style={{ fontSize: 13, marginTop: 4 }}>{l.comments}</div>
            </div>
          )}
        </div>

        {/* Route — Powered by TruckBox */}
        <div>
          <div className="tb-pulse-grey" style={headerBar}>Route — Powered by TruckBox</div>
          <div className="flex flex-wrap items-center" style={{ gap: 16, marginBottom: 14 }}>
            <Stat k="Loaded" v={fmtMi(tripN)} />
            {dh ? <Stat k="Deadhead" v={fmtMi(dh)} /> : null}
            {dh ? <Stat k="Total" v={fmtMi(totalMi)} hi /> : null}
            {dh && rateN ? <Stat k="RPM (w/DH)" v={rpmDh} hi /> : null}
            <button
              type="button"
              onClick={onCopy}
              className={copied ? "" : "tb-pulse"}
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, color: copied ? "#16a34a" : "#0a6cb8", background: copied ? "#f0fdf4" : "#fff", border: `1.5px solid ${copied ? "#16a34a" : "#bcdcf3"}`, borderRadius: 9, padding: "8px 11px", whiteSpace: "nowrap" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <RouteMapArt />
          <button
            type="button"
            onClick={onRoute}
            style={{ marginTop: 8, marginLeft: "auto", display: "block", color: link, fontWeight: 600, fontSize: 12, background: "none", border: 0, cursor: "pointer", padding: 0 }}
          >
            Open in Google Maps ↗
          </button>

          <button
            type="button"
            onClick={openFmcsa}
            className="tb-pulse"
            style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontWeight: 600, fontSize: 12, color: "#0a6cb8", background: "#fff", border: "1.5px solid #bcdcf3", borderRadius: 9, padding: "8px 12px" }}
          >
            FMCSA Broker Report ↗
          </button>
        </div>

        {/* Rate */}
        <div>
          <div style={headerBar}>Rate</div>
          <RateRow k="Total" v={l.rate} big />
          <RateRow k="Trip" v={`${l.trip} mi`} />
          <RateRow k="Rate / mile" v={ratePerMile} />
        </div>

        {/* Company */}
        <div>
          <div style={headerBar}>Company</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{l.broker}</div>
          <div style={{ color: link, fontSize: 13, marginTop: 6 }}>{l.email}</div>
          <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0a6cb8", background: "#eef6fd", border: "1px solid #bcdcf3", borderRadius: 8, padding: "6px 10px" }}>Factoring Eligible</span>
            <span style={{ color: "#f59e0b", fontSize: 14 }}>★★★★<span style={{ color: "#cbd5e1" }}>★</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Demo feature list
   ============================================================ */

export function DemoFeatures() {
  const items = [
    { icon: <Mail style={{ width: 19, height: 19 }} />, t: "One-click broker email", d: "A custom template that fills itself from the load's data in DAT and sends from your own Gmail. No copy-paste, no second tab." },
    { icon: <MapPin style={{ width: 19, height: 19 }} />, t: "Google Maps in one click", d: "Open the whole trip in Google Maps as three stops: your truck, the pickup, then the destination." },
    { icon: <Gauge style={{ width: 19, height: 19 }} />, t: "RPM with deadhead", d: "A real rate-per-mile that counts the empty miles to pickup, plus total miles including deadhead." },
    { icon: <Filter style={{ width: 19, height: 19 }} />, t: "Miles filter", d: "Hide loads shorter than the distance you set, so only the trips worth your time stay on the board." },
    { icon: <Keyboard style={{ width: 19, height: 19 }} />, t: "Keyboard navigation", d: "Move through loads and fire actions from the keyboard. Book more lanes, reach for the mouse less." },
    { icon: <ShieldCheck style={{ width: 19, height: 19 }} />, t: "Broker credit check", soon: true, d: "Factoring and RTS broker credit right on the load, so you can vet who is posting before you call." },
  ];

  return (
    <section id="features-list" className="ed-section" style={{ paddingTop: 24 }}>
      <div className="ed-container">
        <div className="mb-10 max-w-2xl">
          <span className="ed-label">What you get</span>
          <h2 className="ed-h2 mt-4">
            Built for dispatchers who <span className="ed-accent">move fast</span>
          </h2>
          <p className="mt-4 text-lg" style={{ color: "var(--muted)" }}>
            Six things Truck Box adds to the DAT board, so booking a load is a couple of
            clicks instead of a dozen.
          </p>
        </div>

        <Reveal>
          <div className="tb-feature-grid">
            {items.map((f, i) => (
              <div className="tb-feature" key={f.t}>
                <div className="tb-feature-top">
                  <span className="tb-feature-index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="tb-feature-icon">{f.icon}</span>
                </div>
                <div className="tb-feature-head">
                  <h3>{f.t}</h3>
                  {f.soon && <span className="tb-feature-soon">Soon</span>}
                </div>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <BrowserSupport />
      </div>
    </section>
  );
}

/* ============================================================
   Header
   ============================================================ */

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-500"
        style={{
          background: scrolled ? "rgba(10,10,9,0.72)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
        }}
      >
        <div
          className="ed-container flex items-center justify-between"
          style={{ minHeight: 76 }}
        >
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3"
            aria-label="Truck Box — home"
          >
            {logoFailed ? (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--accent)" }}
                aria-hidden
              />
            ) : (
              <img
                src="/logo.png"
                alt=""
                width={30}
                height={30}
                onError={() => setLogoFailed(true)}
                style={{ display: "block", borderRadius: "50%", flex: "0 0 auto" }}
              />
            )}
            <span
              className="font-extrabold tracking-tight text-[1.05rem] uppercase"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
            >
              Truck&nbsp;Box
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((n) =>
              n.route ? (
                <Link key={n.href} to={n.href} className="ed-label hover:text-[color:var(--ink)] transition-colors">
                  {n.label}
                </Link>
              ) : (
                <a key={n.href} href={n.href} className="ed-label hover:text-[color:var(--ink)] transition-colors">
                  {n.label}
                </a>
              )
            )}
          </nav>

          <div className="hidden md:block">
            <a className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
              <span>Install</span> <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="md:hidden ed-label flex items-center gap-2"
          >
            Menu <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Fullscreen overlay menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "var(--bg)" }}
          >
            <div className="ed-container flex items-center justify-between" style={{ minHeight: 76 }}>
              <span className="ed-label">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="ed-label flex items-center gap-2">
                Close <X className="h-5 w-5" />
              </button>
            </div>
            <div className="ed-container flex-1 flex flex-col justify-center gap-2">
              {NAV.map((n, i) => {
                const inner = (
                  <motion.span
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.08 + i * 0.05, duration: 0.7, ease: EASE }}
                    style={{ display: "block" }}
                    className="ed-display text-[14vw] md:text-[7rem] leading-[0.95]"
                  >
                    {n.label}
                  </motion.span>
                );
                return (
                  <span className="ed-mask" key={n.href} onClick={() => setOpen(false)}>
                    {n.route ? <Link to={n.href}>{inner}</Link> : <a href={n.href}>{inner}</a>}
                  </span>
                );
              })}
            </div>
            <div className="ed-container py-8 flex justify-between ed-label">
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">Telegram</a>
              <a href={INSTALL_URL} target="_blank" rel="noreferrer">Install →</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   Hero
   ============================================================ */

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const op = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section id="top" ref={ref} className="ed-section" style={{ paddingTop: 132, paddingBottom: 72 }}>
      <motion.div style={{ y, opacity: op }} className="ed-container">
        <div className="flex items-center justify-between gap-6 mb-6">
          <span className="ed-label">[ 01 ] — Chrome Extension for DAT</span>
          <span className="ed-label hidden sm:block">Est. 2025 — Chicago, USA</span>
        </div>

        <MaskLines
          play
          className="ed-display text-[10vw] lg:text-[7rem]"
          lines={[
            "A cleaner &",
            "faster way to",
            "send broker",
            "emails from",
            <span className="ed-accent" key="dat">one.dat.com</span>,
          ]}
        />

        <div className="mt-10 grid md:grid-cols-[1.4fr_1fr] gap-10 items-end">
          <Reveal delay={0.2}>
            <p className="max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
              No more copy-paste between DAT and Gmail. One click sends the broker a
              ready email from your template, so you cover more loads in less time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>Install Extension</span> <ArrowUpRight className="h-4 w-4" />
              </a>
              <Link className="ed-btn" to="/demo">
                <span>Live demo</span> <Play className="h-3.5 w-3.5" fill="currentColor" />
              </Link>
              <a className="ed-btn" href={CALENDLY_URL} target="_blank" rel="noreferrer">
                <span>Book Call</span>
              </a>
            </div>
            <p className="mt-6 ed-label" style={{ letterSpacing: "0.14em", lineHeight: 1.7 }}>
              7-day free trial. No credit card required.
              <br />
              We only send email, we never read your inbox.
            </p>
          </Reveal>

          <Reveal delay={0.28} className="flex md:justify-end">
            <SpinBadge />
          </Reveal>
        </div>
      </motion.div>
    </section>
  );
}

function SpinBadge() {
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 200 200" className="ed-badge h-full w-full">
        <defs>
          <path id="tb-circle" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
        </defs>
        <text
          fill="var(--muted)"
          style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: 6, textTransform: "uppercase" }}
        >
          <textPath href="#tb-circle">
            Truck Box · Send faster · Truck Box · Send faster ·
          </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <ArrowRight className="h-7 w-7" style={{ color: "var(--accent)" }} />
      </span>
    </div>
  );
}

/* ============================================================
   Marquee
   ============================================================ */

/* National freight-market ticker.
 * Update MARKET + MARKET_AS_OF when you refresh the numbers (DAT Trendlines for
 * the per-mile rates, EIA/AAA for diesel). To make it live, swap MARKET for a
 * fetch from your backend that scrapes DAT Trendlines + the EIA diesel API. */
const MARKET_AS_OF = "May 2026";
const MARKET: { label: string; value: string; unit: string; muted?: boolean }[] = [
  { label: "US Diesel", value: "$5.64", unit: "/gal" },
  { label: "Van", value: "$2.79", unit: "/mi" },
  { label: "Reefer", value: "$3.26", unit: "/mi" },
  { label: "Flatbed", value: "$3.60", unit: "/mi" },
  { label: "DAT spot avg", value: MARKET_AS_OF, unit: "", muted: true },
];

function Marquee() {
  const base = [...MARKET, ...MARKET, ...MARKET];
  const loop = [...base, ...base];
  return (
    <div
      className="ed-marquee-wrap tb-ticker py-6"
      style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
    >
      <motion.div
        className="ed-marquee"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      >
        {loop.map((m, i) => (
          <span key={i} className={"tb-ticker-item" + (m.muted ? " is-muted" : "")}>
            <span className="lbl">{m.label}</span>
            {m.value && <span className="val">{m.value}</span>}
            {m.unit && <span className="unit">{m.unit}</span>}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ============================================================
   Interactive demo — Truck Box buttons on a DAT-style load board
   The ✉ (email) and route buttons are the Truck Box buttons. Clicking
   the envelope simulates the one-click send; the route opens Google Maps.
   Sample data only, no real email is sent here.
   ============================================================ */

type DemoLoad = {
  age: string;
  rate: string;
  rpm?: string;
  trip: string;
  dh: number;
  origin: string;
  truck: string;
  dest: string;
  pickup: string;
  equip: string;
  weight: string;
  length: string;
  broker: string;
  email: string;
  comments?: string;
};

const DEMO_LOADS: DemoLoad[] = [
  { age: "5m", rate: "$846", trip: "139", dh: 20, origin: "University Pk, IL", truck: "Joliet, IL", dest: "Janesville, WI", pickup: "6/1", equip: "V", weight: "40,978 lbs", length: "53 ft - Full", broker: "Northway Freight LLC", email: "dispatch@northwayfreight.com", comments: "No touch freight. Drop & hook available." },
  { age: "6m", rate: "$493", trip: "111", dh: 18, origin: "Carol Stream, IL", truck: "Elgin, IL", dest: "Menomonee Falls, WI", pickup: "6/1", equip: "V", weight: "4,506 lbs", length: "53 ft - Full", broker: "Great Lakes Carriers", email: "loads@greatlakescarriers.com" },
  { age: "6m", rate: "—", trip: "355", dh: 12, origin: "Franksville, WI", truck: "Racine, WI", dest: "Minneapolis, MN", pickup: "6/1", equip: "V", weight: "20,000 lbs", length: "53 ft - Full", broker: "Summit Logistics Group", email: "ops@summitlogistics.com" },
  { age: "7m", rate: "$1,900", rpm: "$4.94*/mi", trip: "385", dh: 10, origin: "Pleasant Prairie, WI", truck: "Kenosha, WI", dest: "Hopkins, MN", pickup: "6/1", equip: "V", weight: "43,000 lbs", length: "53 ft - Full", broker: "Redline Transport", email: "brokers@redlinetransport.com" },
  { age: "8m", rate: "$850", trip: "199", dh: 14, origin: "Minooka, IL", truck: "Morris, IL", dest: "Baraboo, WI", pickup: "6/1", equip: "V", weight: "10,000 lbs", length: "53 ft - Full", broker: "Cornerstone Freight", email: "dispatch@cornerstonefreight.com" },
  { age: "9m", rate: "$1,400", rpm: "$2.30*/mi", trip: "610", dh: 8, origin: "E Chicago, IN", truck: "Gary, IN", dest: "Yankton, SD", pickup: "6/1", equip: "VR", weight: "43,000 lbs", length: "53 ft - Full", broker: "Ironside Logistics", email: "loads@ironsidelogistics.com" },
  { age: "9m", rate: "$1,200", rpm: "$3.57*/mi", trip: "336", dh: 17, origin: "Milwaukee, WI", truck: "Waukesha, WI", dest: "Minneapolis, MN", pickup: "6/1", equip: "V", weight: "44,000 lbs", length: "53 ft - Full", broker: "Polaris Freight Co", email: "ops@polarisfreight.com" },
  { age: "10m", rate: "$700", rpm: "$1.14*/mi", trip: "613", dh: 6, origin: "Markham, IL", truck: "Harvey, IL", dest: "Chambersburg, PA", pickup: "6/1 - 6/2", equip: "V", weight: "3,000 lbs", length: "18 ft - Partial", broker: "Keystone Dispatch", email: "dispatch@keystonedispatch.com" },
  { age: "11m", rate: "$2,700", rpm: "$6.25*/mi", trip: "432", dh: 12, origin: "Chicago Heights, IL", truck: "Hammond, IN", dest: "Minneapolis, MN", pickup: "6/1", equip: "V", weight: "40,000 lbs", length: "53 ft - Full", broker: "Lakeshore Logistics", email: "brokers@lakeshorelogistics.com" },
  { age: "12m", rate: "$3,500", rpm: "$4.28*/mi", trip: "817", dh: 11, origin: "Oak Creek, WI", truck: "Milwaukee, WI", dest: "Nazareth, PA", pickup: "6/1", equip: "VR", weight: "10,239 lbs", length: "53 ft - Full", broker: "Allied Lane Partners", email: "posting@alliedlane.com" },
  { age: "13m", rate: "$1,050", trip: "247", dh: 13, origin: "Aurora, IL", truck: "Naperville, IL", dest: "Grand Rapids, MI", pickup: "6/1", equip: "V", weight: "38,500 lbs", length: "53 ft - Full", broker: "Midwest Haul Co", email: "dispatch@midwesthaul.com" },
  { age: "14m", rate: "$2,150", rpm: "$3.10*/mi", trip: "694", dh: 12, origin: "Joliet, IL", truck: "Bolingbrook, IL", dest: "Nashville, TN", pickup: "6/1", equip: "R", weight: "42,000 lbs", length: "53 ft - Full", broker: "Greenline Freight", email: "loads@greenlinefreight.com" },
];

export function LoadBoardDemo() {
  const [popup, setPopup] = useState<string | null>(null);
  const [sentRow, setSentRow] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(0);
  const toggleRow = (i: number) => setExpandedRow((cur) => (cur === i ? null : i));
  const [refreshing, setRefreshing] = useState(false);
  const doRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const sendDemo = (i: number, broker: string) => {
    setPopup(broker);
    setSentRow(i);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPopup(null);
      setSentRow(null);
    }, 2600);
  };

  const openRoute = (l: DemoLoad) => {
    // 3 points: truck (current) -> origin (pickup) -> destination
    const p = new URLSearchParams({
      api: "1",
      origin: l.truck,
      waypoints: l.origin,
      destination: l.dest,
      travelmode: "driving",
    });
    window.open(`https://www.google.com/maps/dir/?${p.toString()}`, "_blank", "noopener");
  };

  // Light, DAT-like palette (scoped to this demo window only)
  const ink = "#1e293b";
  const sub = "#64748b";
  const link = "#2563eb";
  const line = "#e9eef5";

  return (
    <section className="ed-section" style={{ paddingTop: 0 }}>
      <div className="ed-container">
        <p className="mb-5 ed-label text-center md:text-left">
          Click any load to expand · try the buttons
        </p>

        <Reveal>
          <div
            className="relative overflow-hidden mx-auto"
            style={{ borderRadius: 16, border: "1px solid var(--line)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}
          >
            {/* browser chrome */}
            <div
              className="flex items-center gap-3 px-4"
              style={{ height: 44, background: "#0c111d", borderBottom: "1px solid var(--line)" }}
            >
              <span className="flex gap-2" aria-hidden>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#ff5f57", display: "inline-block" }} />
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#febc2e", display: "inline-block" }} />
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#28c840", display: "inline-block" }} />
              </span>
              <span
                className="ed-label flex-1 text-center truncate"
                style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "5px 14px", letterSpacing: "0.04em" }}
              >
                one.dat.com/search-loads
              </span>
              <span className="ed-label hidden sm:block ed-accent">Truck Box · live demo</span>
            </div>

            {/* results header (demo) with Refresh Loads */}
            <div
              className="hidden md:flex items-center gap-4"
              style={{ background: "#fff", color: ink, borderBottom: `1px solid ${line}`, padding: "10px 16px" }}
            >
              <span style={{ fontWeight: 800, fontSize: 15 }}>
                369 <span style={{ color: sub, fontWeight: 600, fontSize: 13 }}>Results</span>
              </span>
              <span style={{ color: sub, fontSize: 13 }}>
                Sort by <b style={{ color: link }}>Age</b>
              </span>
              <button
                type="button"
                onClick={doRefresh}
                disabled={refreshing}
                className={refreshing ? "" : "tb-pulse"}
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, cursor: refreshing ? "default" : "pointer", fontWeight: 700, fontSize: 12.5, color: "#fff", background: "#0046E0", border: 0, borderRadius: 8, padding: "9px 16px" }}
              >
                <RotateCw className={refreshing ? "tb-spin" : ""} style={{ width: 14, height: 14 }} />
                {refreshing ? "Refreshing…" : "Refresh Loads"}
              </button>
            </div>

            {/* load board — desktop table (web stays as-is) */}
            <div className="hidden md:block overflow-x-auto" style={{ background: "#ffffff", color: ink }}>
              <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: sub, textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Age</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Rate</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Origin</th>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }} aria-label="Route" />
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Destination</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Pick Up</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Equip</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Weight</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Company</th>
                    <th style={{ padding: "12px 14px", fontWeight: 600 }}>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_LOADS.map((l, i) => {
                    const open = expandedRow === i;
                    return (
                      <Fragment key={i}>
                        <tr
                          onClick={() => toggleRow(i)}
                          style={{ borderTop: `1px solid ${line}`, cursor: "pointer", background: open ? "#eef4ff" : undefined }}
                        >
                          <td style={{ padding: "11px 14px", color: sub, whiteSpace: "nowrap" }}>
                            <span className="flex items-center" style={{ gap: 7 }}>
                              <ChevronDown style={{ width: 13, height: 13, transition: "transform .2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", color: link }} />
                              {l.age}
                            </span>
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 600 }}>
                            {l.rate}
                            {l.rpm && <div style={{ color: sub, fontSize: 11, fontWeight: 400 }}>{l.rpm}</div>}
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>{l.origin}</td>
                          <td style={{ padding: "11px 8px" }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openRoute(l); }}
                              title="Truck Box: open route in Google Maps"
                              aria-label={`Open route ${l.origin} to ${l.dest} in Google Maps`}
                              className="tb-demo-route tb-pulse"
                            >
                              <MapPin style={{ width: 16, height: 16 }} />
                            </button>
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>{l.dest}</td>
                          <td style={{ padding: "11px 14px", color: sub, whiteSpace: "nowrap" }}>{l.pickup}</td>
                          <td style={{ padding: "11px 14px", color: sub }}>{l.equip}</td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: sub }}>
                            {l.weight}
                            <div style={{ fontSize: 11 }}>{l.length}</div>
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: link, fontWeight: 600 }}>{l.broker}</td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <span className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); sendDemo(i, l.broker); }}
                                title="Truck Box: send email to broker"
                                aria-label={`Send email to ${l.broker}`}
                                className="tb-demo-send tb-pulse"
                                data-sent={sentRow === i ? "1" : undefined}
                              >
                                {sentRow === i ? <Check style={{ width: 15, height: 15 }} /> : <Mail style={{ width: 15, height: 15 }} />}
                              </button>
                              <span style={{ color: link }}>{l.email}</span>
                            </span>
                          </td>
                        </tr>
                        {open && (
                          <tr style={{ background: "#fff" }}>
                            <td colSpan={10} style={{ padding: "0 16px", borderLeft: "3px solid #0046E0", borderBottom: `1px solid ${line}` }}>
                              <LoadDetailPanel
                                l={l}
                                sent={sentRow === i}
                                onSend={() => sendDemo(i, l.broker)}
                                onRoute={() => openRoute(l)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* load board — mobile compact list (no side scroll, first 6 rows) */}
            <div className="md:hidden" style={{ background: "#ffffff", color: ink }}>
              {DEMO_LOADS.slice(0, 6).map((l, i) => {
                const open = expandedRow === i;
                return (
                  <div key={i} style={{ borderTop: `1px solid ${line}`, background: open ? "#eef4ff" : undefined }}>
                    <div onClick={() => toggleRow(i)} style={{ padding: "13px 16px", cursor: "pointer" }}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center" style={{ gap: 6, color: sub, fontSize: 12 }}>
                          <ChevronDown style={{ width: 13, height: 13, transition: "transform .2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", color: link }} />
                          {l.age}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          {l.rate}
                          {l.rpm && (
                            <span style={{ color: sub, fontWeight: 400, fontSize: 11, marginLeft: 6 }}>{l.rpm}</span>
                          )}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2" style={{ fontSize: 14 }}>
                        <span className="truncate" style={{ flex: 1, minWidth: 0 }}>{l.origin}</span>
                        <span className="flex items-center gap-1.5" style={{ flex: "0 0 auto" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: sub, whiteSpace: "nowrap" }}>
                            {l.trip} mi
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openRoute(l); }}
                            title="Truck Box: open route in Google Maps"
                            aria-label={`Open route ${l.origin} to ${l.dest} in Google Maps`}
                            className="tb-demo-route tb-pulse"
                          >
                            <MapPin style={{ width: 16, height: 16 }} />
                          </button>
                        </span>
                        <span className="truncate" style={{ flex: 1, minWidth: 0, textAlign: "right" }}>{l.dest}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); sendDemo(i, l.broker); }}
                          title="Truck Box: send email to broker"
                          aria-label={`Send email to ${l.broker}`}
                          className="tb-demo-send tb-pulse"
                          data-sent={sentRow === i ? "1" : undefined}
                          style={{ flex: "0 0 auto" }}
                        >
                          {sentRow === i ? <Check style={{ width: 15, height: 15 }} /> : <Mail style={{ width: 15, height: 15 }} />}
                        </button>
                        <span className="truncate" style={{ color: link, fontSize: 13, minWidth: 0 }}>{l.email}</span>
                      </div>
                    </div>

                    {open && (
                      <div style={{ padding: "0 12px", borderLeft: "3px solid #0046E0" }}>
                        <LoadDetailPanel
                          l={l}
                          sent={sentRow === i}
                          onSend={() => sendDemo(i, l.broker)}
                          onRoute={() => openRoute(l)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* sent popup */}
            <AnimatePresence>
              {popup && (
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ bottom: 22, maxWidth: "92%" }}
                >
                  <div
                    className="flex items-start gap-3"
                    style={{
                      background: "#0c111d",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 14,
                      padding: "14px 18px",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    }}
                  >
                    <span
                      style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(34,197,94,0.16)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
                    >
                      <Check style={{ width: 17, height: 17 }} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                        Email sent to {popup}
                      </div>
                      <div className="text-sm" style={{ color: "var(--muted)", marginTop: 2 }}>
                        Demo only. In the extension this sends a real email from your Gmail,
                        using your saved template.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>

        <p className="mt-4 ed-label text-center md:text-left">Interactive demo · sample data. No real email is sent here.</p>
      </div>
    </section>
  );
}

/* ============================================================
   Social proof — real Chrome Web Store reviews
   ============================================================ */

function SocialProof() {
  const reviews = [
    {
      name: "Stan",
      text:
        "The best application for using the DAT load board and booking freight without calling brokers.",
    },
    {
      name: "Sofiya",
      text:
        "It now takes a couple of seconds to send emails that used to take much longer. I send a load request the moment a load appears on the board.",
    },
    {
      name: "Adam",
      text:
        "Everything works smoothly and reliably. There is a built-in help button to reach the developer, and he ships fixes the same day.",
    },
  ];

  return (
    <section id="reviews" className="ed-section">
      <div className="ed-container">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <h2 className="ed-h2 max-w-2xl">
            Saves a full-time dispatcher
            <br />
            <span className="ed-accent">about 2-3 hours a week.</span>
          </h2>
          <div className="text-left md:text-right">
            <div
              className="ed-display text-5xl leading-none"
              style={{ textTransform: "none", letterSpacing: "-0.02em" }}
            >
              5.0 <span className="ed-accent">★</span>
            </div>
            <a
              href="https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd/reviews"
              target="_blank"
              rel="noreferrer"
              className="ed-label tb-reviews-link mt-3 inline-flex items-center gap-1.5 md:justify-end"
            >
              98 dispatchers · Chrome Web Store
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.name} delay={i * 0.08}>
              <figure
                className="py-8 md:py-10 md:px-8 md:first:pl-0"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                <blockquote className="text-lg leading-relaxed">
                  “{r.text}”
                </blockquote>
                <figcaption className="ed-label mt-6">{r.name}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Features — horizontal pinned track
   ============================================================ */

type FeatureItem = { slug: string; title: string; body: string };

function FeatureCard({ item, index }: { item: FeatureItem; index: number }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  const onEnter = () => {
    vid.current?.play().catch(() => {});
  };
  const onLeave = () => {
    const v = vid.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  return (
    <article
      className="ed-fcard"
      data-cursor
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="ed-fcard-media-wrap">
        {failed ? (
          <div className="ed-fcard-ph">
            <span className="ed-fcard-ph-play">▶</span>
            <span className="ed-fcard-ph-note">Demo coming</span>
          </div>
        ) : (
          <video
            ref={vid}
            className="ed-fcard-media"
            src={`/demos/${item.slug}.mp4`}
            poster={`/demos/${item.slug}.jpg`}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        )}
        <span className="ed-fcard-idx">{String(index + 1).padStart(2, "0")} / 06</span>
      </div>

      <div className="ed-fcard-body">
        <h3
          className="ed-display text-2xl leading-[0.98]"
          style={{ textTransform: "none", letterSpacing: "-0.02em" }}
        >
          {item.title}
        </h3>
        <p className="mt-3 text-[0.95rem] leading-relaxed" style={{ color: "var(--muted)" }}>
          {item.body}
        </p>
      </div>
    </article>
  );
}

function Features() {
  const items: FeatureItem[] = [
    {
      slug: "email",
      title: "One-click email",
      body: "Email the broker straight from a DAT load row. No copy-paste, no Gmail tab.",
    },
    {
      slug: "keyboard",
      title: "Keyboard navigation",
      body: "Hands stay on the keyboard. W/S move loads, A/D switch tabs, C copies, E sends, R refreshes.",
    },
    {
      slug: "copy",
      title: "Copy & share load",
      body: "Copy the whole load — pickup, miles, deadhead, weight, map link — to text your driver in one click.",
    },
    {
      slug: "route",
      title: "Route & deadhead RPM",
      body: "A live route map plus a true rate-per-mile that counts the empty miles to pickup.",
    },
    {
      slug: "filter",
      title: "Miles filter",
      body: "Dim loads under your minimum miles and focus on the lanes worth your time.",
    },
    {
      slug: "fmcsa",
      title: "FMCSA & rate calc",
      body: "Open the broker's FMCSA report and price a load on the phone, right on the board.",
    },
  ];

  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const calc = () => {
      if (trackRef.current) {
        setDist(Math.max(0, trackRef.current.scrollWidth - window.innerWidth + 64));
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist]);

  return (
    <section
      id="features"
      ref={sectionRef}
      style={{ height: `calc(100vh + ${dist}px)` }}
    >
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        <div className="ed-container w-full">
          <div className="flex items-end justify-between gap-6 mb-10">
            <div>
              <span className="ed-label">[ 02 ] — Features</span>
              <h2 className="ed-h2 mt-4">
                Minimal by design.
                <br />
                <span className="ed-accent">Premium in feel.</span>
              </h2>
            </div>
            <span className="ed-label hidden md:block max-w-[220px] text-right">
              Move faster without turning DAT into a cluttered tool
            </span>
          </div>
        </div>

        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-6 pl-[max(32px,calc((100vw-1320px)/2+32px))] pr-8"
        >
          {items.map((it, i) => (
            <FeatureCard key={it.slug} item={it} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   How it works
   ============================================================ */

function HowItWorks() {
  const steps = [
    { t: "Install the extension", d: "Add Truck Box to Chrome and pin it for quick access." },
    { t: "Sign in with Google", d: "Connect your Gmail account and activate the free trial." },
    { t: "Work inside DAT", d: "Open DAT, use your templates, filter loads, and send with one click." },
  ];
  return (
    <section className="ed-section">
      <div className="ed-container">
        <div className="flex items-end justify-between gap-6 mb-14">
          <div>
            <span className="ed-label">[ 03 ] — How it works</span>
            <h2 className="ed-h2 mt-4">Start in 3 steps</h2>
          </div>
          <span className="ed-label hidden md:block">No heavy training needed</span>
        </div>

        <div>
          {steps.map((s, i) => (
            <motion.div
              key={s.t}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: EASE }}
              className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-12 items-start py-10"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <span
                className="ed-display ed-outline text-[5rem] md:text-[8rem] leading-none"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="md:pt-6">
                <h3
                  className="ed-display text-4xl md:text-6xl"
                  style={{ textTransform: "none", letterSpacing: "-0.025em" }}
                >
                  {s.t}
                </h3>
                <p className="mt-4 max-w-md text-lg" style={{ color: "var(--muted)" }}>
                  {s.d}
                </p>
              </div>
            </motion.div>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Pricing
   ============================================================ */

function Pricing() {
  const features = [
    "7-day free trial",
    "One-click email sending",
    "Saved templates",
    "Short-load filtering",
    "Keyboard navigation",
    "Learning center access",
  ];
  return (
    <section id="pricing" className="ed-section">
      <div className="ed-container">
        <div className="mb-14">
          <span className="ed-label">[ 04 ] — Pricing</span>
          <h2 className="ed-h2 mt-4">Simple subscription</h2>
        </div>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-center">
          <Reveal>
            <div className="flex items-start gap-4">
              <span className="ed-display text-[8rem] md:text-[12rem] leading-[0.8] ed-accent">$7</span>
              <span className="ed-label mt-6">/ per user<br />month</span>
            </div>
            <p className="mt-6 max-w-md text-lg" style={{ color: "var(--muted)" }}>
              Start with the free 1-week trial first. No credit card required. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>Start Free Trial</span> <ArrowUpRight className="h-4 w-4" />
              </a>
              <a className="ed-btn" href={CALENDLY_URL} target="_blank" rel="noreferrer">
                <span>Book Call</span>
              </a>
            </div>
            <p className="mt-6 ed-label" style={{ letterSpacing: "0.14em" }}>
              We only send email, we never read your inbox.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <ul>
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.6, ease: EASE }}
                  className="flex items-center justify-between py-5"
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  <span className="text-lg">{f}</span>
                  <span className="ed-label ed-accent">incl.</span>
                </motion.li>
              ))}
              <li style={{ borderTop: "1px solid var(--line)" }} />
            </ul>
          </Reveal>
        </div>

        <Reveal>
          <div
            className="mt-16 md:mt-20 flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
            style={{ borderTop: "1px solid var(--line)", paddingTop: 40 }}
          >
            <div>
              <span className="ed-label ed-accent">For teams</span>
              <h3
                className="ed-display text-3xl md:text-4xl mt-3"
                style={{ textTransform: "none", letterSpacing: "-0.02em" }}
              >
                10 or more dispatchers?
              </h3>
              <p className="mt-3 max-w-lg text-lg" style={{ color: "var(--muted)" }}>
                We set custom team pricing and add everyone by email. You get one bill,
                your dispatchers get instant access.
              </p>
            </div>
            <a className="ed-btn ed-btn-accent shrink-0" href="#contact">
              <span>Contact us</span> <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   Learning
   ============================================================ */

function Learning() {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`;

  return (
    <section id="learning" className="ed-section">
      <div className="ed-container">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <span className="ed-label">[ 05 ] — Learning</span>
            <h2 className="ed-h2 mt-4">Learn Truck Box</h2>
          </div>
          <span className="ed-label hidden md:block max-w-[260px] text-right">
            A short walkthrough — from login to sending broker emails with one click
          </span>
        </div>

        <Reveal>
          <div
            className="relative overflow-hidden aspect-video"
            style={{ border: "1px solid var(--line)", borderRadius: 6, background: "#000" }}
            data-cursor
          >
            {playing ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0`}
                title="Truck Box walkthrough"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 group"
                aria-label="Play walkthrough video"
              >
                <img
                  src={thumb}
                  alt="Truck Box walkthrough preview"
                  className="absolute inset-0 h-full w-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500"
                  loading="lazy"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="inline-flex items-center gap-3 px-7 py-4 rounded-full"
                    style={{ background: "var(--accent)", color: "#0a0a09" }}
                  >
                    <Play className="h-5 w-5" fill="currentColor" />
                    <span className="ed-label" style={{ color: "#0a0a09" }}>Play walkthrough</span>
                  </span>
                </span>
              </button>
            )}
          </div>
        </Reveal>

        <div className="mt-12 grid md:grid-cols-3 gap-0">
          {[
            { t: "Login & first setup", d: "Google sign-in, extension setup, and first steps." },
            { t: "Template configuration", d: "How to create a clean, reusable message template." },
            { t: "Workflow inside DAT", d: "Real outreach flow from the DAT board." },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 0.08}>
              <div className="py-8 md:px-8 md:py-0" style={{ borderTop: "1px solid var(--line)" }}>
                <span className="ed-label ed-accent">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{c.t}</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FAQ
   ============================================================ */

const FAQS = [
  {
    q: "How do I get started?",
    a: (
      <p>
        Install the Truck Box Chrome extension, open the popup, and click{" "}
        <strong>Sign in with Google</strong>. After login, your account is ready and your
        free trial can start.
      </p>
    ),
  },
  {
    q: "How do I update the extension?",
    a: (
      <p>
        Chrome usually updates extensions automatically. You can also open{" "}
        <strong>chrome://extensions</strong>, enable Developer Mode, and press{" "}
        <strong>Update</strong> to refresh manually.
      </p>
    ),
  },
  {
    q: "How do I subscribe?",
    a: (
      <p>
        First log in with Google and start the free 7 days trial. After the trial, you can
        continue with the paid Truck Box subscription from the billing flow on the website
        or inside the app.
      </p>
    ),
  },
  {
    q: "How do I cancel my subscription?",
    a: (
      <p>
        You can cancel anytime from your billing or subscription page. After cancelation,
        your current paid period stays active until it ends, and you will not be charged
        again.
      </p>
    ),
  },
  {
    q: "How do I edit my email template?",
    a: (
      <p>
        Open the Truck Box extension popup, go to the <strong>Email Template</strong> tab,
        and update your subject or body. Save the template, and Truck Box will use it for
        future emails.
      </p>
    ),
  },
  {
    q: "Can I use placeholders in the template?",
    a: (
      <p>
        Yes. You can use placeholders like <code>{`{{origin}}`}</code>,{" "}
        <code>{`{{destination}}`}</code>, <code>{`{{pickupDate}}`}</code>,{" "}
        <code>{`{{equipment}}`}</code>, <code>{`{{length}}`}</code>,{" "}
        <code>{`{{weight}}`}</code>, <code>{`{{myName}}`}</code>,{" "}
        <code>{`{{myMc}}`}</code>, and <code>{`{{myPhone}}`}</code>.
      </p>
    ),
  },
  {
    q: "How does keyboard navigation work?",
    a: (
      <div>
        <p>
          Truck Box includes keyboard shortcuts that help dispatchers move through DAT
          loads faster without using a mouse.
        </p>
        <ul>
          <li><strong>W</strong> – Move up between loads</li>
          <li><strong>S</strong> – Move down between loads</li>
          <li><strong>A</strong> – Switch to the previous tab</li>
          <li><strong>D</strong> – Switch to the next tab</li>
          <li><strong>Q</strong> – Open the route in Google Maps</li>
          <li><strong>E</strong> – Send an email to the broker</li>
          <li><strong>Space</strong> – Open or close load details</li>
        </ul>
      </div>
    ),
  },
  {
    q: "Why is Google login not working?",
    a: (
      <p>
        Usually this happens if the Google session expired, permissions were revoked, or
        Chrome needs to refresh the extension auth state. Try logging out inside the
        extension, then sign in again. If it still does not work, contact support.
      </p>
    ),
  },
  {
    q: "Where do I get help?",
    a: (
      <p>
        For now, the fastest support channel is Telegram. Use the support button on this
        page to message directly.
      </p>
    ),
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="ed-section">
      <div className="ed-container">
        <div className="mb-12">
          <span className="ed-label">[ 06 ] — FAQ</span>
          <h2 className="ed-h2 mt-4">Common questions</h2>
        </div>

        <div>
          {FAQS.map((f, i) => {
            const isOpen = openIdx === i;
            return (
              <div key={f.q} style={{ borderTop: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-6 py-7 text-left group"
                >
                  <span className="flex items-center gap-5">
                    <span className="ed-label ed-accent">{String(i + 1).padStart(2, "0")}</span>
                    <span
                      className="text-xl md:text-3xl transition-colors"
                      style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em", color: isOpen ? "var(--ink)" : "var(--muted)" }}
                    >
                      {f.q}
                    </span>
                  </span>
                  <span className="shrink-0">
                    {isOpen ? <Minus className="h-6 w-6" style={{ color: "var(--accent)" }} /> : <Plus className="h-6 w-6" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="tb-prose pb-8 md:pl-16 max-w-2xl">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Privacy (route: /privacy) — content unchanged
   ============================================================ */

export function Privacy() {
  return (
    <section id="privacy" className="tb-section" style={{ paddingTop: 150 }}>
      <div className="tb-container">
        <Reveal>
          <div className="max-w-2xl">
            <span className="tb-pill">Legal</span>
            <h2 className="ed-display mt-6 text-5xl md:text-7xl" style={{ textTransform: "none" }}>
              Privacy Policy &amp; Terms
            </h2>
            <p className="mt-5 text-lg" style={{ color: "var(--muted)" }}>
              This page explains what Truck Box does, what information it uses, how Google
              account access is handled, and the rules for using the service.
            </p>
            <p className="mt-2 ed-label">Last updated — March 20, 2026</p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-12 grid gap-6">
            <article className="tb-card p-6 sm:p-8 tb-prose">
              <h3 style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>Privacy Policy</h3>
              <p>
                <b>Truck Box</b> is a Chrome extension that helps users prepare and send broker
                outreach emails from supported DAT load board pages using the user's own Gmail
                account and Google-authorized access. Truck Box is designed to minimize data
                collection and to use Google data only for user-requested, user-facing functionality.
              </p>
              <div className="tb-note">
                <b>Important summary:</b> Truck Box can send an email only when the user explicitly
                clicks to send it. Truck Box does <b>not</b> read the user's Gmail inbox, read
                Gmail messages, read attachments, or scan mailbox content.
              </div>

              <h3>Information we collect</h3>
              <ul>
                <li><b>Local extension settings.</b> Truck Box may store user-entered settings locally in the browser, such as name, MC number, phone number, templates, filter preferences, and extension settings.</li>
                <li><b>Supported page data visible to the user.</b> On supported webpages, Truck Box may read information already visible on the page, such as broker email address, origin, destination, pickup date, equipment, trip length, and similar load details, only to help compose the message the user wants to send.</li>
                <li><b>Basic Google account information.</b> During sign-in, Google may provide basic profile information such as account email, profile identifier, and display name for authentication and account access purposes.</li>
                <li><b>OAuth tokens.</b> Truck Box uses Google OAuth access tokens only to authenticate approved Google API requests related to sign-in and sending user-requested emails.</li>
                <li><b>Account or subscription information.</b> If Truck Box uses a backend for account status, subscription verification, abuse prevention, support, or product security, limited account-level information may be processed for those purposes.</li>
              </ul>

              <h3>Information we do not collect from Gmail</h3>
              <ul>
                <li>We do <b>not</b> collect or store Gmail inbox messages.</li>
                <li>We do <b>not</b> read the content of Gmail conversations.</li>
                <li>We do <b>not</b> access Gmail attachments.</li>
                <li>We do <b>not</b> scan or analyze a user's mailbox for marketing, profiling, or advertising purposes.</li>
              </ul>

              <h3>How we use information</h3>
              <ul>
                <li><b>To send emails the user explicitly requests.</b> Truck Box uses the Gmail API only to send an email when the user chooses to send that email.</li>
                <li><b>To compose and populate email content.</b> Supported page data and saved templates are used only to help prepare the draft content and recipient details the user is sending.</li>
                <li><b>To authenticate users.</b> Basic Google account information may be used to authenticate the user and confirm authorized access.</li>
                <li><b>To provide account, subscription, and security functionality.</b> Limited backend processing may be used for subscription checks, fraud prevention, abuse prevention, operational reliability, and customer support.</li>
                <li><b>No advertising use.</b> We do not use Google user data or Gmail-related data for advertising, remarketing, profiling, or personalized ads.</li>
                <li><b>No generalized AI training.</b> We do not use Google user data, Gmail-related data, or email content to train generalized artificial intelligence or machine learning models.</li>
              </ul>

              <h3>Google OAuth scopes</h3>
              <p>Truck Box requests only the scopes necessary for its user-facing functionality:</p>
              <ul>
                <li><code>https://www.googleapis.com/auth/gmail.send</code> — used only to send emails the user explicitly chooses to send.</li>
                <li><code>openid</code> — used for secure Google sign-in authentication.</li>
                <li><code>email</code> — used to identify the signed-in Google account.</li>
                <li><code>profile</code> — used for basic profile information during authentication.</li>
              </ul>
              <div className="tb-note">
                <b>Truck Box does not request Gmail read access.</b> It does not request permission
                to read inbox messages, read Gmail conversations, access attachments, or manage
                Gmail settings.
              </div>

              <h3>Storage &amp; Security</h3>
              <ul>
                <li><b>Local-first design.</b> Templates, settings, and preferences are primarily stored locally on the user's device.</li>
                <li><b>Limited backend use.</b> If backend services are used, they are limited to account management, subscription verification, security, fraud prevention, abuse prevention, support, and reliable service operation.</li>
                <li><b>No sale of personal data.</b> We do not sell personal information, Google user data, or Gmail-related data.</li>
                <li><b>No unauthorized sharing.</b> We do not share Google user data except where necessary to provide a user-requested service, for security or legal compliance, or as otherwise permitted by applicable law and Google policy.</li>
                <li><b>Reasonable safeguards.</b> We use reasonable administrative, technical, and organizational measures designed to protect the data relevant to operation of Truck Box and related services.</li>
              </ul>

              <h3>Data deletion &amp; revoking access</h3>
              <ul>
                <li>Users can revoke Google account access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
                <li>Users can remove locally stored extension data by clearing extension storage, resetting the extension, or uninstalling the extension.</li>
                <li>If account, subscription, or support data exists on our backend, users may request deletion by contacting us.</li>
                <li>After Google access is revoked, Truck Box will no longer be able to send emails through Gmail until the user signs in again.</li>
              </ul>

              <h3>Your rights</h3>
              <p>
                Depending on where you live, you may have rights to request access, correction,
                deletion, or restriction of personal information we control. Where data is stored
                only locally in the browser, many of these controls can be exercised directly by
                the user through browser settings, extension reset, uninstall, or Google permission
                revocation.
              </p>

              <h3>Children's Privacy</h3>
              <p>
                Truck Box is not directed to children under 13, and we do not knowingly collect
                personal information from children.
              </p>

              <h3>Changes to this policy</h3>
              <p>
                We may update this Privacy Policy from time to time. If we do, we will update the
                "Last updated" date on this page.
              </p>
            </article>

            <article className="tb-card p-6 sm:p-8 tb-prose">
              <h3 style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>
                Google API Services User Data Policy
              </h3>
              <p>
                Truck Box's use of information received from Google APIs will adhere to the{" "}
                <b>Google API Services User Data Policy</b>, including the <b>Limited Use</b>{" "}
                requirements.
              </p>
              <ul>
                <li><b>User-facing purpose only.</b> Google user data is used only to provide user-facing features that are visible to and initiated by the user.</li>
                <li><b>Send-only Gmail access.</b> Gmail API access is used only to send emails that the user explicitly initiates.</li>
                <li><b>No inbox reading.</b> Truck Box does not use Google API access to read inbox messages, analyze Gmail conversations, or access Gmail attachments.</li>
                <li><b>No advertising use.</b> Google user data is not used to create, target, or improve advertisements.</li>
                <li><b>No sale of Google user data.</b> Google user data is not sold.</li>
                <li><b>No transfer for unrelated purposes.</b> Google user data is not transferred to third parties except where necessary to provide the user-requested service, for security purposes, to comply with law, or in connection with a business transaction where legally allowed and properly disclosed.</li>
                <li><b>No human review of Gmail content.</b> We do not permit humans to read Gmail content unless we have the user's affirmative agreement for specific support or security reasons, or if required by law.</li>
                <li><b>No generalized AI or ML training.</b> Google user data is not used to train generalized AI or machine learning models.</li>
              </ul>
            </article>

            <article id="terms" className="tb-card p-6 sm:p-8 tb-prose">
              <h3 style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>Terms &amp; Conditions</h3>
              <p style={{ fontSize: "0.9rem" }}>Last updated: <b>March 20, 2026</b></p>

              <h3>Acceptance</h3>
              <p>
                By installing, accessing, or using Truck Box, you agree to these Terms &amp;
                Conditions and the Privacy Policy on this page.
              </p>

              <h3>License</h3>
              <p>
                Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
                revocable license to use Truck Box for lawful personal or business use.
              </p>

              <h3>Description of service</h3>
              <p>
                Truck Box is a browser extension that helps users prepare and send outreach emails
                from supported webpages using the user's own Gmail account and user-authorized
                Google access.
              </p>

              <h3>User responsibility</h3>
              <ul>
                <li>You are responsible for the content of emails you send using Truck Box.</li>
                <li>You must use Truck Box in compliance with applicable laws, third-party platform rules, and anti-spam requirements.</li>
                <li>You must not use Truck Box for spam, phishing, fraud, harassment, deception, unlawful solicitation, or abusive bulk messaging.</li>
                <li>You must not misuse Google APIs, bypass security controls, or interfere with the integrity of the service.</li>
              </ul>

              <h3>Google account and API access</h3>
              <p>
                By connecting your Google account, you authorize Truck Box to use the approved
                scopes described on this page solely for the limited purposes described in this
                Privacy Policy. Truck Box does not use Gmail access to read inbox content.
              </p>

              <h3>Third-party services</h3>
              <p>
                Truck Box may interact with third-party services such as Google and supported load
                board websites. Your use of those third-party services remains subject to their own
                terms, privacy policies, and platform rules.
              </p>

              <h3>Subscriptions and billing</h3>
              <p>
                Certain features may require an active subscription or valid account status.
                Pricing, trial availability, renewal terms, cancellation, and feature access are
                governed by the plan presented to the user at the time of purchase. If a free trial
                is offered, any billing terms shown during signup or checkout control.
              </p>

              <h3>Service access and enforcement</h3>
              <p>
                We may suspend, limit, or revoke access where reasonably necessary for maintenance,
                abuse prevention, legal compliance, payment issues, security, or protection of the
                service.
              </p>

              <h3>Disclaimer</h3>
              <p>
                Truck Box is provided on an "as is" and "as available" basis to the maximum extent
                permitted by law. We do not guarantee uninterrupted availability, delivery success,
                or compatibility with every website, browser version, or Gmail environment.
              </p>

              <h3>Limitation of liability</h3>
              <p>
                To the maximum extent permitted by law, we are not liable for indirect, incidental,
                special, consequential, or punitive damages, or for any loss of profits, revenues,
                goodwill, business opportunities, or data arising out of or related to your use of
                Truck Box.
              </p>

              <h3>Termination</h3>
              <p>
                You may stop using Truck Box at any time by uninstalling the extension and revoking
                Google access. We may suspend or terminate access if reasonably necessary to
                protect the service, enforce these Terms, address abuse, or comply with legal or
                platform requirements.
              </p>

              <h3>Governing law</h3>
              <p>
                These Terms are governed by the laws of the State of Illinois, without regard to
                conflict of law principles, except where applicable law requires otherwise.
              </p>
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   Contact
   ============================================================ */

function Contact() {
  const channels = [
    { label: "Telegram", handle: "@mngartur", href: TELEGRAM_URL, cta: "Fastest reply" },
    { label: "Book a call", handle: "calendly.com/truckboxapp", href: CALENDLY_URL, cta: "Free 15-min demo" },
    { label: "Instagram", handle: "@truckbox.app", href: "https://instagram.com/truckbox.app", cta: "Follow updates" },
    { label: "Facebook", handle: "/truckboxapp", href: "https://facebook.com/truckboxapp", cta: "Community" },
  ];

  return (
    <section id="contact" className="ed-section">
      <div className="ed-container">
        <div className="mb-12">
          <span className="ed-label">[ 07 ] — Contact</span>
          <h2 className="ed-h2 mt-4">
            Talk <span className="ed-accent">to us</span>
          </h2>
          <p className="mt-5 max-w-md text-lg" style={{ color: "var(--muted)" }}>
            Login issues, billing, template setup, or product feedback — we reply fast.
          </p>
        </div>

        <div>
          {channels.map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="ed-row">
              <div className="flex items-baseline gap-5">
                <span className="ed-label hidden sm:block w-24">{c.label}</span>
                <span
                  className="ed-row-title ed-display text-3xl md:text-5xl"
                  style={{ textTransform: "none", letterSpacing: "-0.02em" }}
                >
                  {c.handle}
                </span>
              </div>
              <div className="flex items-center gap-5">
                <span className="ed-label hidden md:block">{c.cta}</span>
                <ArrowUpRight className="h-6 w-6 md:h-8 md:w-8" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Final CTA
   ============================================================ */

function FinalCTA() {
  return (
    <section className="ed-section" style={{ paddingTop: 0 }}>
      <div className="ed-container">
        <Reveal>
          <div className="flex flex-wrap justify-center gap-3">
            <a className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
              <span>Install Extension</span> <ArrowUpRight className="h-4 w-4" />
            </a>
            <a className="ed-btn" href="#faq">
              <span>Read FAQ</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   Footer
   ============================================================ */

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)" }}>
      <div className="ed-container pt-16 pb-28">

        <div className="mt-12 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {NAV.map((n) =>
              n.route ? (
                <Link key={n.href} to={n.href} className="ed-label hover:text-[color:var(--ink)] transition-colors">
                  {n.label}
                </Link>
              ) : (
                <a key={n.href} href={n.href} className="ed-label hover:text-[color:var(--ink)] transition-colors">
                  {n.label}
                </a>
              )
            )}
          </div>
          <div className="flex gap-3">
            <a
              className="ed-social group"
              href="https://instagram.com/truckbox.app"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram className="h-5 w-5" />
              <span>Instagram</span>
            </a>
            <a
              className="ed-social group"
              href="https://facebook.com/truckboxapp"
              target="_blank"
              rel="noreferrer"
            >
              <Facebook className="h-5 w-5" />
              <span>Facebook</span>
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col sm:flex-row justify-between gap-3" style={{ borderTop: "1px solid var(--line)" }}>
          <span className="ed-label">© {new Date().getFullYear()} Truck Box — All rights reserved</span>
          <span className="ed-label">Chicago, USA</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Floating Telegram button
   ============================================================ */

export function TelegramFloat() {
  return (
    <motion.a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Ask a question on Telegram"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.6, ease: EASE }}
      className="ed-btn ed-btn-accent z-40"
      style={{ position: "fixed", bottom: 20, right: 20 }}
    >
      <span className="hidden sm:inline">Ask a question</span>
      <ArrowUpRight className="h-4 w-4" />
    </motion.a>
  );
}
