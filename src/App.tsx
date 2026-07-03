import { useEffect, useRef, useState, Fragment, type CSSProperties } from "react";
import { usePageMeta } from "./lib/meta";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import Lenis from "lenis";
import { useForm, ValidationError } from "@formspree/react";

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
  ChevronDown,
  RotateCw,
  FileText,
  Image as ImageIcon,
  Download,
  Pin,
  MousePointerClick,
  LogIn,
  Send,
  DollarSign,
  ShieldCheck,
  Clock,
  Map,
  Calculator,
  ZoomIn,
} from "lucide-react";

type NavItem = { href: string; label: string; route?: boolean };

const NAV: NavItem[] = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/guide", label: "Guide", route: true },
  { href: "/faq", label: "FAQ", route: true },
  { href: "/privacy", label: "Privacy", route: true },
  { href: "/#contact", label: "Contact" },
];

const INSTALL_URL =
  "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd";
const CALENDLY_URL = "https://calendly.com/truckboxapp";
const YOUTUBE_ID = "-_G0P-M1lCA";

const EASE = [0.16, 1, 0.3, 1] as const;

export { NAV, INSTALL_URL, CALENDLY_URL };

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
  const location = useLocation();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;
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
        // getElementById (not querySelector) so numeric ids like #1 work
        const el = document.getElementById(hash.slice(1));
        if (el) {
          e.preventDefault();
          lenis.scrollTo(el as HTMLElement, { offset: -90 });
        }
      }
    };
    document.addEventListener("click", onClick, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick, true);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Scroll to a #section after the route renders (e.g. clicking "FAQ" from the
  // Privacy page navigates home AND lands on the section in one click). Retries
  // until the target element exists.
  useEffect(() => {
    if (!location.hash) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const go = () => {
      // getElementById (not querySelector) so numeric ids like #1 work
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        if (lenisRef.current) lenisRef.current.scrollTo(el as HTMLElement, { offset: -90 });
        else (el as HTMLElement).scrollIntoView({ behavior: "smooth" });
      } else if (tries++ < 40) {
        timer = setTimeout(go, 40);
      }
    };
    timer = setTimeout(go, 60);
    return () => clearTimeout(timer);
  }, [location.pathname, location.hash]);

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
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  id?: string;
}) {
  return (
    <motion.div
      id={id}
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
  as: Tag = "div",
}: {
  lines: React.ReactNode[];
  className?: string;
  delay?: number;
  play?: boolean;
  as?: "div" | "h1" | "h2";
}) {
  const trigger = play
    ? { animate: { y: 0 } }
    : { whileInView: { y: 0 }, viewport: { once: true, margin: "-60px" } };
  return (
    <Tag className={className} style={{ margin: 0 }}>
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
    </Tag>
  );
}

/* Magnetic hover: element leans toward the cursor, springs back on leave.
   Pointer-fine devices only; respects reduced motion. */
function useMagnetic<T extends HTMLElement>(strength = 0.38) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onEnter = () => {
      el.style.transition = "transform .18s cubic-bezier(.16,1,.3,1)";
    };
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    const onLeave = () => {
      el.style.transition = "transform .45s cubic-bezier(.16,1,.3,1)";
      el.style.transform = "translate(0,0)";
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);
  return ref;
}

/* Soft light glow that follows the cursor (lerped). Pointer-fine devices
   only; on touch / reduced-motion it stays hidden so the orbs are the base. */
function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight * 0.3;
    let cx = mx;
    let cy = my;
    let raf = 0;
    let seen = false;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!seen) {
        seen = true;
        el.style.opacity = "1";
      }
    };
    const loop = () => {
      cx += (mx - cx) * 0.12;
      cy += (my - cy) * 0.12;
      el.style.setProperty("--mx", `${cx}px`);
      el.style.setProperty("--my", `${cy}px`);
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);
  return <div ref={ref} className="tb-spotlight" style={{ opacity: 0 }} aria-hidden />;
}

/* Thin top scroll-progress bar (accent gradient). */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 130, damping: 30, mass: 0.3 });
  return <motion.div className="tb-progress" style={{ scaleX }} aria-hidden />;
}

/* Slim conversion pill that appears once the hero scrolls away. */
function StickyCTA() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.92);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="tb-sticky-cta"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <span className="tb-sticky-txt">
            Beat other dispatchers
          </span>
          <a className="tb-sticky-pill-btn" href={INSTALL_URL} target="_blank" rel="noreferrer">
            Try free <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   App shell
   ============================================================ */

export default function App() {
  usePageMeta({
    title: "TruckBox — One-Click Broker Emails for DAT & Truckstop",
    description:
      "Chrome extension for truck dispatchers: send broker emails from DAT One and Truckstop in one click, with templates, lane analytics, route maps and RTS credit checks. $7/mo, 7-day free trial.",
    path: "/",
  });
  return (
    <div className="min-h-screen">
      <Spotlight />
      <div className="tb-bg-vignette" aria-hidden />
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <BeforeAfter />
        <Features />
        <SocialProof />
        <HowItWorks />
        <Pricing />
        <Walkthrough />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
      <StickyCTA />
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

  // Lock background scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-500"
        style={{
          background: scrolled ? "rgba(9,11,18,0.72)" : "transparent",
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
                style={{
                  display: "block",
                  width: 30,
                  height: 30,
                  flex: "0 0 auto",
                  WebkitMaskImage: "radial-gradient(circle, #000 74%, transparent 100%)",
                  maskImage: "radial-gradient(circle, #000 74%, transparent 100%)",
                  filter:
                    "drop-shadow(0 0 8px rgba(147,167,242,0.35))",
                }}
              />
            )}
            <span
              className="tracking-tight text-[1.12rem]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.02em", fontVariationSettings: "'opsz' 40" }}
            >
              Truck&nbsp;Box
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((n) => (
              <Link key={n.href} to={n.href} className="ed-label hover:text-[color:var(--ink)] transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:block">
            <Link className="ed-btn ed-btn-accent" to="/business">
              <span>Sign in</span> <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-3">
            <Link
              className="ed-btn ed-btn-accent"
              style={{ padding: "9px 16px", letterSpacing: "0.1em", whiteSpace: "nowrap" }}
              to="/business"
            >
              <span>Sign in</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="ed-label flex items-center gap-2"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
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
                    <Link to={n.href}>{inner}</Link>
                  </span>
                );
              })}
            </div>
            <div className="ed-container flex justify-start ed-label" style={{ paddingTop: 32, paddingBottom: 88 }}>
              <a href={INSTALL_URL} target="_blank" rel="noreferrer">Install →</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   Hero mockup — stylized DAT board + TruckBox compose loop.
   A scripted, looping sequence: a load is selected, the email
   auto-fills, sends, and the deadhead RPM / route / RTS credit
   flourishes resolve. Reduced motion renders the resolved frame.
   ============================================================ */

const HM_ROWS = [
  { o: "Bolingbrook, IL", d: "Allentown, PA", rate: "$2,850", age: "2m", pin: "#93a7f2" },
  { o: "Chicago, IL", d: "Columbus, OH", rate: "$1,420", age: "5m", pin: "#b9a8ee" },
  { o: "Joliet, IL", d: "Nashville, TN", rate: "$2,100", age: "8m", pin: "#34d399" },
  { o: "Gary, IN", d: "Atlanta, GA", rate: "$2,640", age: "11m", pin: "#f59e0b" },
];

function HeroMockup() {
  const reduced =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState(reduced ? 5 : 0);
  const [rpm, setRpm] = useState(1.78);

  // Scripted loop — dwell (ms) per phase 0..5, then repeat.
  useEffect(() => {
    if (reduced) return;
    const SEQ = [850, 1000, 1650, 950, 650, 2050];
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      setPhase(i);
      t = setTimeout(() => {
        i = (i + 1) % SEQ.length;
        run();
      }, SEQ[i]);
    };
    run();
    return () => clearTimeout(t);
  }, [reduced]);

  // Count the deadhead-adjusted RPM up once the email is composed.
  useEffect(() => {
    if (phase < 3) {
      setRpm(1.78);
      return;
    }
    let v = 1.78;
    const id = setInterval(() => {
      v = Math.min(2.64, v + 0.055);
      setRpm(v);
      if (v >= 2.64) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [phase]);

  const panelOpen = phase >= 2 && phase <= 5;
  const composed = phase >= 2;
  const sending = phase === 4;
  const sent = phase === 5;
  const filtersOn = reduced || phase >= 3;

  const cursorPos =
    phase <= 0
      ? { left: "82%", top: "88%" }
      : phase === 1
      ? { left: "33%", top: "33%" }
      : { left: "12%", top: "83%" };

  const lineWidths = ["86%", "62%", "92%", "46%"];

  return (
    <div className="hm-wrap" data-cursor>
      <div className="hm-glow" aria-hidden />
      <div className="hm-board">
        <div className="hm-chrome">
          <div className="hm-dots">
            <i style={{ background: "#ff5f57" }} />
            <i style={{ background: "#febc2e" }} />
            <i style={{ background: "#28c840" }} />
          </div>
          <div className="hm-url">one.dat.com/search</div>
          <span className="hm-badge">★ Truck&nbsp;Box</span>
        </div>

        <div className="hm-grid">
          <div className="hm-rowhead">
            <span>Origin</span>
            <span>Destination</span>
            <span style={{ textAlign: "right" }}>Rate</span>
            <span style={{ textAlign: "right" }}>Age</span>
          </div>
          {HM_ROWS.map((r, idx) => (
            <div key={idx} className={`hm-row${idx === 0 && phase >= 1 ? " is-active" : ""}`}>
              <span className="hm-lane">
                <i className="hm-pin" style={{ background: r.pin }} />
                {r.o}
              </span>
              <span className="hm-dest">{r.d}</span>
              <span className="hm-rate">{r.rate}</span>
              <span className="hm-age">{r.age}</span>
            </div>
          ))}

          <AnimatePresence>
            {panelOpen && (
              <motion.div
                className="hm-panel"
                initial={{ y: 28, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 28, opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div className="hm-panel-head">
                  <span className="hm-panel-to">
                    To <b>broker@pumpcargo.com</b>
                  </span>
                  <span className="hm-tb-tag">Auto-filled</span>
                </div>
                {lineWidths.map((w, li) => (
                  <motion.div
                    key={li}
                    className={`hm-line${li === 2 ? " hm-line-accent" : ""}`}
                    style={{ width: w }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: composed ? 1 : 0 }}
                    transition={{ duration: 0.45, delay: 0.15 + li * 0.12, ease: EASE }}
                  />
                ))}
                <div className={`hm-send${sent ? " is-sent" : ""}`}>
                  {sent ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} /> Sent
                    </>
                  ) : sending ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 tb-spin" /> Sending
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Send email
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!reduced && (
          <div
            className={`hm-cursor${sending ? " is-click" : ""}`}
            style={{
              ...cursorPos,
              transition:
                "left .6s cubic-bezier(.16,1,.3,1), top .6s cubic-bezier(.16,1,.3,1)",
            }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" stroke="#0a0e18" strokeWidth="1.5">
              <path d="M5 3l14 8-6 1.6L9.4 19z" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <AnimatePresence>
          {sent && !reduced && (
            <motion.div
              className="hm-plane"
              style={{ position: "absolute" }}
              initial={{ left: "27%", top: "78%", opacity: 0, scale: 0.6 }}
              animate={{ left: "92%", top: "8%", opacity: [0, 1, 1, 0], scale: 1, rotate: -18 }}
              transition={{ duration: 1.3, ease: EASE }}
              aria-hidden
            >
              <Send className="h-5 w-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="hm-chip hm-chip-rpm">
        <div className="hm-chip-label">RPM · deadhead-adj.</div>
        <div className="hm-rpm-val">
          ${rpm.toFixed(2)}
          <small>/mi</small>
        </div>
      </div>

      <AnimatePresence>
        {composed && (
          <motion.div
            className="hm-chip hm-chip-map"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="hm-chip-label">Google Map</div>
            <div className="hm-map-canvas">
              <svg viewBox="0 0 160 92" preserveAspectRatio="xMidYMid slice">
                {/* terrain base */}
                <rect width="160" height="92" fill="#e7ecdf" />
                {/* parks / national forests */}
                <ellipse cx="92" cy="20" rx="44" ry="15" fill="#c7e0ae" />
                <ellipse cx="66" cy="70" rx="34" ry="16" fill="#cbe3b4" />
                <ellipse cx="138" cy="64" rx="20" ry="12" fill="#c7e0ae" />
                {/* ocean + lake (water) */}
                <path d="M0 78 Q10 86 18 92 L0 92 Z" fill="#a9d6f5" />
                <ellipse cx="132" cy="48" rx="6" ry="3.2" fill="#a9d6f5" />
                {/* faint road network */}
                <g stroke="#ffffff" strokeWidth="1.1" fill="none" opacity="0.9">
                  <path d="M40 0 L50 42 L42 92" />
                  <path d="M104 0 L98 44 L116 92" />
                  <path d="M0 60 L70 52 L160 40" />
                </g>
                {/* highway */}
                <path d="M0 84 L70 74 L120 82 L160 70" stroke="#f7c95b" strokeWidth="1.6" fill="none" opacity="0.85" />
                {/* selected route — white casing + google blue, draws in */}
                <motion.path
                  d="M28 70 C 66 64, 78 44, 108 40 C 130 37, 144 30, 150 24"
                  fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: EASE }}
                />
                <motion.path
                  d="M28 70 C 66 64, 78 44, 108 40 C 130 37, 144 30, 150 24"
                  fill="none" stroke="#4285f4" strokeWidth="2.6" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: EASE }}
                />
                {/* A / B markers */}
                <g>
                  <path d="M28 71 C24.6 66.8 23 64.6 23 62 a5 5 0 1 1 10 0 c0 2.6 -1.6 4.8 -5 9 z" fill="#ea4335" />
                  <circle cx="28" cy="62" r="2.3" fill="#fff" />
                  <text x="28" y="63.9" textAnchor="middle" fontSize="4.2" fontWeight="700" fontFamily="Inter, sans-serif" fill="#ea4335">A</text>
                </g>
                <g>
                  <path d="M150 25 C146.6 20.8 145 18.6 145 16 a5 5 0 1 1 10 0 c0 2.6 -1.6 4.8 -5 9 z" fill="#ea4335" />
                  <circle cx="150" cy="16" r="2.3" fill="#fff" />
                  <text x="150" y="17.9" textAnchor="middle" fontSize="4.2" fontWeight="700" fontFamily="Inter, sans-serif" fill="#ea4335">B</text>
                </g>
                {/* labels */}
                <text x="20" y="83" fontSize="4.6" fontFamily="Inter, sans-serif" fill="#5f6368">Los Angeles</text>
                <text x="120" y="14" fontSize="4.6" fontFamily="Inter, sans-serif" fill="#5f6368">Kingman</text>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composed && (
          <motion.div
            className="hm-chip hm-chip-rts"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
          >
            <div className="hm-rts-grade">A</div>
            <div className="hm-rts-meta">
              RTS credit
              <br />
              <span>pays in 22 days</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composed && (
          <motion.div
            className="hm-chip hm-chip-filter"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.18 }}
          >
            <div className="hm-chip-label">Load filter</div>
            <div className="hm-filter-row">
              <span>Duplicate loads</span>
              <span className={`hm-switch${filtersOn ? " is-on" : ""}`} aria-hidden>
                <i />
              </span>
            </div>
            <div className="hm-filter-row">
              <span>Short loads</span>
              <span className={`hm-switch${filtersOn ? " is-on" : ""}`} aria-hidden>
                <i />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sent && (
          <motion.div
            className="hm-chip hm-chip-speed"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="hm-speed-old">~30 sec</span>
            <span className="hm-speed-new">
              0.2s <small>to send</small>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -54]);
  const tryRef = useMagnetic<HTMLAnchorElement>();

  return (
    <section id="top" ref={ref} className="ed-section" style={{ paddingTop: 132, paddingBottom: 72 }}>
      <motion.div style={{ y, opacity: op }} className="ed-container">
        <div className="flex items-center justify-between gap-6 mb-6">
          <span className="ed-label">[ 01 ] — Chrome Extension · DAT + Truckstop — for truck dispatchers</span>
          <span className="ed-label hidden sm:block">TruckBox LLC — Chicago, USA · Est. 2025</span>
        </div>

        <MaskLines
          play
          as="h1"
          className="ed-display text-[8.8vw] lg:text-[5.6rem] whitespace-nowrap"
          lines={[
            "First to the broker.",
            <span key="oc">
              <span className="ed-accent" style={{ fontStyle: "italic" }}>First to the load.</span>
            </span>,
          ]}
        />

        <div className="mt-12 grid lg:grid-cols-[1.04fr_1fr] gap-12 lg:gap-10 items-center">
          <Reveal delay={0.2}>
            <p className="max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
              Truck Box helps DAT and Truckstop dispatchers send broker emails in one click with ready templates,
              maps, filters, shortcuts, lane analytics and live stats — so you reach the broker before everyone else.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a ref={tryRef} className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>TRY FREE</span> <ArrowUpRight className="h-4 w-4" />
              </a>
              <a className="ed-btn" href={CALENDLY_URL} target="_blank" rel="noreferrer">
                <span>Book Call</span>
              </a>
            </div>
            <div className="mt-7 flex flex-col gap-3.5">
              <div className="inline-flex items-center gap-2.5">
                <span
                  className="inline-flex items-center justify-center rounded-full"
                  style={{ width: 26, height: 26, background: "rgba(52,211,153,0.18)", color: "#34d399" }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="ed-label" style={{ letterSpacing: "0.08em" }}>
                  <span style={{ color: "var(--ink)", fontWeight: 700 }}>7-day free trial</span>
                  <span style={{ color: "var(--muted)" }}> — no credit card required</span>
                </span>
              </div>
              <span className="ed-label" style={{ letterSpacing: "0.08em", color: "var(--muted)" }}>
                Google sign-in only — we never see your DAT password
              </span>
              <a
                href="https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd/reviews"
                target="_blank"
                rel="noreferrer"
                className="hm-trust tb-reviews-link"
              >
                <span className="hm-stars">★★★★★</span>
                <span>
                  <b>5.0</b> · 100+ dispatchers · Chrome Web Store
                </span>
              </a>
              <div className="inline-flex items-center gap-2.5 mt-1">
                <span className="ed-label" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>
                  Works with
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", background: "#fff", borderRadius: 8, padding: "5px 9px" }}>
                  <img src="/dat.png" alt="DAT" style={{ height: 18, width: "auto", display: "block" }} />
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", background: "#fff", borderRadius: 8, padding: "5px 9px" }}>
                  <img src="/truckstop.png" alt="Truckstop" style={{ height: 18, width: "auto", display: "block" }} />
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <motion.div style={{ y: mockY }}>
              <HeroMockup />
            </motion.div>
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
          <h2
            className="ed-h2"
            style={{ fontSize: "clamp(1.3rem, 4vw, 3rem)", whiteSpace: "nowrap" }}
          >
            Saves a fulltime dispatcher
            <br />
            <span className="ed-accent">about 3 hours a week</span>
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
              Over 100 dispatchers · Chrome Web Store
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

type FeatureItem = { slug: string; title: string; body: string; video?: boolean };

function FeatureCard({ item, index, total }: { item: FeatureItem; index: number; total: number }) {
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
            poster={`/demos/${item.slug}.webp`}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        )}
        <span className="ed-fcard-idx">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
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

/* ============================================================
   Before / After comparison slider
   ============================================================ */

const BA_VIEWS = {
  details: {
    label: "Load details",
    before: "/compare/before.webp",
    after: "/compare/after.webp",
    ratio: "1447 / 982",
  },
  list: {
    label: "Loads list",
    before: "/compare/before-list.webp",
    after: "/compare/after-list.webp",
    ratio: "1230 / 899",
  },
  darkmode: {
    label: "Day / Night",
    before: "/compare/day.webp",
    after: "/compare/night.webp",
    ratio: "1347 / 909",
  },
  truckstop: {
    label: "Truckstop",
    // Single pre-composed before/after image (labels baked in) — shown static.
    single: "/compare/truckstop.webp",
    ratio: "1450 / 950",
  },
} as const;
type BaView = keyof typeof BA_VIEWS;

function BeforeAfter() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hinted = useRef(false);
  const [pos, setPos] = useState(50); // % revealed of the "before" image
  const [view, setView] = useState<BaView>("details");
  const [anim, setAnim] = useState(false); // smooth transition during auto-hint
  const cur = BA_VIEWS[view];
  const single = "single" in cur ? cur.single : undefined;
  const before = "before" in cur ? cur.before : undefined;
  const after = "after" in cur ? cur.after : undefined;
  const isStatic = !!single;

  const setFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current) setFromClientX(e.clientX);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hint: when the slider scrolls into view, sweep the handle once so the
  // user sees it's draggable.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting || hinted.current) return;
        hinted.current = true;
        setAnim(true);
        const seq = [30, 70, 50];
        seq.forEach((p, i) => setTimeout(() => setPos(p), 350 + i * 550));
        setTimeout(() => setAnim(false), 350 + seq.length * 550 + 200);
      },
      { threshold: 0.45 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ease = "cubic-bezier(.16,1,.3,1)";

  return (
    <section id="compare" className="ed-section">
      <div className="ed-container">
        <div className="mb-8">
          <span className="ed-label">[ 02 ] — Before / After</span>
          <MaskLines
              play
              className="ed-display text-[7vw] lg:text-[5.25rem] whitespace-nowrap"
              lines={[
                "Drag to see the",
                <span key="oc">
              <span className="ed-accent">difference</span>
            </span>,
              ]}
          />
        </div>



        <Reveal>
          {/* View switch — directly above the photo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                padding: 4,
                background: "var(--bg-2, #fff)",
                border: "1px solid var(--line)",
                borderRadius: 999,
              }}
            >
              {(Object.keys(BA_VIEWS) as BaView[]).map((k) => {
                const active = k === view;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setView(k)}
                    style={{
                      border: 0,
                      cursor: "pointer",
                      borderRadius: 999,
                      padding: "9px 18px",
                      font: "700 11px/1 'Space Mono', monospace",
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: active ? "#0a0a09" : "var(--ink)",
                      background: active ? "var(--accent)" : "transparent",
                      transition: "background .2s, color .2s",
                    }}
                  >
                    {BA_VIEWS[k].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Before / After labels — above the image (hidden for static single-image views) */}
          {!isStatic && (
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span
              style={{
                font: "700 11px/1 'Space Mono', monospace",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                background: "var(--bg-2, #fff)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "6px 13px",
              }}
            >
              Before
            </span>
            <span
              style={{
                font: "800 12.5px/1 'Space Mono', monospace",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "#0a0a09",
                background: "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: 999,
                padding: "8px 17px",
                boxShadow: "0 6px 20px rgba(111,139,255,.55)",
              }}
            >
              ★ After
            </span>
          </div>
          )}

          <div
            ref={wrapRef}
            className="mx-auto"
            onPointerDown={
              isStatic
                ? undefined
                : (e) => {
                    dragging.current = true;
                    setAnim(false);
                    setFromClientX(e.clientX);
                  }
            }
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: cur.ratio,
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid var(--line)",
              background: "#eef1f6",
              userSelect: "none",
              touchAction: "none",
              cursor: isStatic ? "default" : "ew-resize",
            }}
          >
            {isStatic ? (
              /* Static single image — already a composed before/after, no drag */
              <img loading="lazy" decoding="async"
                src={single}
                alt="Truckstop board with TruckBox"
                draggable={false}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  display: "block",
                }}
              />
            ) : (
            <>
            {/* AFTER — full base layer (with TruckBox) */}
            <img loading="lazy" decoding="async"
              src={after}
              alt="With TruckBox"
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
              }}
            />

            {/* BEFORE — clipped to the left of the handle (without TruckBox) */}
            <img loading="lazy" decoding="async"
              src={before}
              alt="Without TruckBox"
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
                clipPath: `inset(0 ${100 - pos}% 0 0)`,
                transition: anim ? `clip-path .55s ${ease}` : "none",
              }}
            />

            {/* Divider + handle — bold and obvious */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${pos}%`,
                width: 4,
                marginLeft: -2,
                background: "var(--accent)",
                boxShadow:
                  "0 0 0 1.5px rgba(255,255,255,.85), 0 0 22px rgba(111,139,255,.6)",
                pointerEvents: "none",
                transition: anim ? `left .55s ${ease}` : "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  background: "var(--accent)",
                  boxShadow:
                    "0 6px 18px rgba(111,139,255,.55), 0 0 0 4px #fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: "1px",
                }}
              >
                ‹ ›
              </span>
            </div>
            </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Features() {
  const items: FeatureItem[] = [
    {
      slug: "email",
      title: "One-click email",
      body: "Email the broker straight from a DAT or Truckstop load — no copy-paste, no Gmail tab.",
    },
    {
      slug: "template",
      title: "Multiple email templates",
      body: "Up to 3 saved templates with dynamic fields — switch per broker or company.",
    },
    {
      slug: "rts",
      title: "RTS Credit Check",
      body: "See a broker's RTS factoring credit rating and days-to-pay on the load — for carriers who factor with RTS.",
    },
    {
      slug: "map",
      title: "Inbuilt Map",
      body: "A live Google Maps route for every load — truck, pickup and destination.",
    },
    {
      slug: "calculator",
      title: "Rate calculator",
      body: "Price a load on the spot — rate-per-mile and deadhead-adjusted RPM right on the board.",
    },
    {
      slug: "filter",
      title: "Load filter",
      body: "Dim loads under your minimum miles and focus on the lanes worth your time.",
    },
    {
      slug: "keyboard",
      title: "Keyboard navigation",
      body: "Hands stay on the keyboard. W/S move loads, A/D switch tabs, C copies, E sends, R refreshes.",
    },
    {
      slug: "refresh",
      title: "Load Refresh",
      body: "Refresh load list not all DAT page",
    },
    {
      slug: "night",
      title: "Night Mode",
      body: "Enable Night Mode in DAT load board",
    },

  ];

  const total = items.length;
  // Lightbox: index of the enlarged feature, or null when closed.
  const [lb, setLb] = useState<number | null>(null);
  const lbStep = (delta: number) =>
    setLb((v) => (v == null ? v : (((v + delta) % total) + total) % total));

  // Preload every feature image so the grid and the lightbox feel instant.
  useEffect(() => {
    items.forEach((it) => {
      const img = new Image();
      img.src = `/demos/${it.slug}.webp`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lightbox: arrow-key nav + Escape, and lock background scroll while open.
  useEffect(() => {
    if (lb == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      else if (e.key === "ArrowRight") lbStep(1);
      else if (e.key === "ArrowLeft") lbStep(-1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lb]);

  // Lightbox touch swipe (mobile) to move between features. Ignores pinch-zoom
  // and any multi-touch gesture so zooming the image never flips the slide.
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const lbMulti = useRef(false);
  const onLbTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      // a second finger → pinch/zoom, not a swipe
      lbMulti.current = true;
      touchX.current = null;
      touchY.current = null;
      return;
    }
    lbMulti.current = false;
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
  };
  const onLbTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) lbMulti.current = true;
  };
  const onLbTouchEnd = (e: React.TouchEvent) => {
    const fingersLeft = e.touches.length;
    // Skip while it was a pinch, while fingers are still down, or with no start.
    if (lbMulti.current || fingersLeft > 0 || touchX.current == null) {
      if (fingersLeft === 0) lbMulti.current = false;
      touchX.current = null;
      touchY.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = touchY.current == null ? 0 : e.changedTouches[0].clientY - touchY.current;
    touchX.current = null;
    touchY.current = null;
    // Only a clearly horizontal one-finger swipe counts.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lbStep(dx < 0 ? 1 : -1);
    }
  };

  // Carousel: page-based so arrows/dots stay correct at any number of visible
  // cards (1 on mobile, ~3 on desktop). A "page" = one card-stride of scroll.
  const caroRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(total);

  // One card's stride (width + gap) — read live so it works at any breakpoint.
  const cardStride = () => {
    const track = caroRef.current;
    if (!track || track.children.length < 2) return track?.clientWidth || 1;
    const a = track.children[0] as HTMLElement;
    const b = track.children[1] as HTMLElement;
    return b.offsetLeft - a.offsetLeft || a.offsetWidth;
  };

  // Recompute the page count from the layout (and on resize).
  useEffect(() => {
    const update = () => {
      const track = caroRef.current;
      if (!track) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      setPages(Math.max(1, Math.round(maxScroll / cardStride()) + 1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToPage = (i: number) => {
    const track = caroRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const np = Math.max(0, Math.min(i, pages - 1));
    track.scrollTo({ left: Math.min(np * cardStride(), maxScroll), behavior: "smooth" });
    setPage(np);
  };

  // Keep the active page in sync while the user swipes/scrolls the track.
  const rafRef = useRef(0);
  const onCaroScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const track = caroRef.current;
      if (!track) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      const p =
        track.scrollLeft >= maxScroll - 2
          ? pages - 1
          : Math.min(pages - 1, Math.round(track.scrollLeft / cardStride()));
      setPage(p);
    });
  };

  return (
    <section id="features" className="ed-section">
      <div className="ed-container">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <span className="ed-label">[ 03 ] — Features</span>
            <h2 className="ed-h2 mt-4">
              Minimal by design
              <br />
              <span className="ed-accent">Premium in feel</span>
            </h2>
          </div>
          <span className="ed-label hidden md:block max-w-[220px] text-right">
            Swipe through — tap a card to enlarge
          </span>
        </div>

        {/* Carousel — swipe on touch, arrows / drag on desktop. The next card
            peeks at the edge so it always reads as scrollable. */}
        <div className="tb-caro-wrap">
          <button
            type="button"
            aria-label="Previous"
            className="tb-caro-arrow tb-caro-prev"
            onClick={() => scrollToPage(page - 1)}
            disabled={page <= 0}
          >
            ‹
          </button>

          <div className="tb-caro" ref={caroRef} onScroll={onCaroScroll}>
            {items.map((it, i) => (
              <button
                key={it.slug}
                type="button"
                onClick={() => setLb(i)}
                className="tb-bento-card tb-caro-card"
              >
                <span className="tb-bento-media">
                  <img
                    src={`/demos/${it.slug}.webp`}
                    alt={it.title}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <span className="tb-bento-zoom" aria-hidden>⤢</span>
                </span>
                <span className="tb-bento-text">
                  <span className="tb-bento-idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="tb-bento-title">{it.title}</span>
                  <span className="tb-bento-body">{it.body}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Next"
            className="tb-caro-arrow tb-caro-next"
            onClick={() => scrollToPage(page + 1)}
            disabled={page >= pages - 1}
          >
            ›
          </button>
        </div>

        <div className="tb-caro-dots">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to page ${i + 1}`}
              className={"tb-caro-dot" + (i === page ? " is-active" : "")}
              onClick={() => scrollToPage(i)}
            />
          ))}
        </div>
      </div>

      {/* Lightbox — enlarged preview with prev/next (keys, buttons, swipe). */}
      <AnimatePresence>
        {lb != null && (
          <motion.div
            className="tb-lb"
            role="dialog"
            aria-modal="true"
            aria-label={`${items[lb].title} — enlarged`}
            onClick={() => setLb(null)}
            onTouchStart={onLbTouchStart}
            onTouchMove={onLbTouchMove}
            onTouchEnd={onLbTouchEnd}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button type="button" aria-label="Close" className="tb-lb-x" onClick={() => setLb(null)}>
              ×
            </button>
            <button
              type="button"
              aria-label="Previous feature"
              className="tb-lb-nav tb-lb-prev"
              onClick={(e) => { e.stopPropagation(); lbStep(-1); }}
            >
              ‹
            </button>
            <motion.figure
              key={items[lb].slug}
              className="tb-lb-fig"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <img loading="lazy" decoding="async" src={`/demos/${items[lb].slug}.webp`} alt={items[lb].title} />
              <figcaption>
                <span className="tb-bento-idx">{String(lb + 1).padStart(2, "0")}</span>
                <span className="tb-lb-title">{items[lb].title}</span>
                <span className="tb-lb-body">{items[lb].body}</span>
              </figcaption>
            </motion.figure>
            <button
              type="button"
              aria-label="Next feature"
              className="tb-lb-nav tb-lb-next"
              onClick={(e) => { e.stopPropagation(); lbStep(1); }}
            >
              ›
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
            <span className="ed-label">[ 04 ] — How it works</span>
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

function PlatformsBand() {
  const chip: CSSProperties = {
    display: "inline-flex", alignItems: "center", background: "#fff", borderRadius: 9, padding: "6px 11px",
  };
  const logo: CSSProperties = { height: 20, width: "auto", display: "block" };
  const news = [
    {
      t: "Truckstop support",
      d: "Everything you use on DAT now works on Truckstop too — one-click email, route map, FMCSA & RTS, the rate board.",
    },
    {
      t: "Posted load price analytics",
      d: "See how a broker moved the price through the day and across the lane — negotiate from data, not guesses.",
    },
    {
      t: "Dedicated loads finder",
      d: "Spot brokers who keep running the same lane and surface potential recurring & contract leads.",
    },
    {
      t: "Multiple email templates",
      d: "Save up to 3 templates — each with its own signature — and switch per broker or company.",
    },
  ];
  return (
    <section id="platforms" className="ed-section">
      <div className="ed-container">
        <div className="mb-10">
          <span className="ed-label">[ NEW ] — Two load boards, one tool</span>
          <h2 className="ed-h2 mt-4">
            Now on <span className="ed-accent">DAT</span>{" "}
            <span style={{ color: "var(--muted)" }}>&amp;</span>{" "}
            <span className="ed-accent">Truckstop</span>
          </h2>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <span className="ed-label" style={{ color: "var(--muted)" }}>Works with</span>
            <span style={chip}><img loading="lazy" decoding="async" style={logo} src="/dat.png" alt="DAT" /></span>
            <span style={chip}><img loading="lazy" decoding="async" style={logo} src="/truckstop.png" alt="Truckstop" /></span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {news.map((n) => (
            <div
              key={n.t}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "20px 22px",
                background: "var(--bg-2)",
                height: "100%",
              }}
            >
              <h3 className="ed-display text-xl" style={{ textTransform: "none", letterSpacing: "-0.01em" }}>
                {n.t}
              </h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: "var(--muted)" }}>
                {n.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const features = [
    "7-day free trial (No Credit Card)",
    "Cancel anytime (1 click)",
    "Works on DAT + Truckstop",
    "One-click email sending",
    "Multiple email templates (up to 3)",
    "Posted load price analytics",
    "Dedicated loads finder",
    "RTS factoring credit check",
    "Built-in Google Maps route",
    "Rate-per-mile calculator",
    "Copy & share load info",
    "Click-to-call broker numbers",
    "FMCSA broker report",
    "Refresh-loads button",
    "Dark mode",
    "Short-load filtering",
    "Keyboard navigation",
  ];
  return (
    <section id="pricing" className="ed-section">
      <div className="ed-container">
        <div className="mb-14">
          <span className="ed-label">[ 05 ] — Pricing</span>
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
                COMPANY OR DISPATCH TEAM?
              </h3>
              <p className="mt-3 max-w-lg text-lg" style={{ color: "var(--muted)" }}>
                Get custom team setup and add everyone by email. You get one bill,
                your dispatchers get instant access.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="ed-btn ed-btn-accent shrink-0" to="/business/request">
                <span>Set up a team</span> <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a className="ed-btn shrink-0" href="#contact">
                <span>Contact us</span>
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   Walkthrough video
   ============================================================ */

function Walkthrough() {
  const [playing, setPlaying] = useState(false);
  // Use the hi-res cover (1280×720) — it reflects a custom thumbnail and looks
  // crisp on the large player. Fall back to hqdefault if a video has no maxres.
  const thumb = `https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`;
  const thumbFallback = `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`;

  return (
    <section id="walkthrough" className="ed-section">
      <div className="ed-container">
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
                  onError={(e) => {
                    if (e.currentTarget.src !== thumbFallback) e.currentTarget.src = thumbFallback;
                  }}
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
        free trial can start.{" "}
        <Link
          to="/guide"
          className="ed-accent"
          style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          See the full step-by-step guide →
        </Link>
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
    q: "How do I set up RTS Credit Checks?",
    a: (
        <p>
          Open the TruckBox extension, go to the <strong>Factoring</strong> tab, select <strong>RTS</strong>,
          and click <strong>Login</strong>. After signing in to your RTS account,
          you'll be able to use RTS Credit Checks directly from the DAT load board.
        </p>
    ),
  },
  {
    q: "Can I use RTS if I'm not set up with them?",
    a: (
        <p>
          No. To use this feature, you must already have an active account with RTS Financial.
          If you're not currently set up with RTS, you'll need to contact them first.
        </p>
    ),
  },
  {
    q: "Something isn't working — what should I try first?",
    a: (
      <div>
        <p>Before anything else, run these three quick fixes in order:</p>
        <ol>
          <li>
            <strong>Update the extension</strong> if you haven't yet — open{" "}
            <strong>chrome://extensions</strong>, turn on Developer Mode, and press{" "}
            <strong>Update</strong>.
          </li>
          <li>
            <strong>Log out and log back in</strong> from the Truck Box popup.
          </li>
          <li>
            <strong>Refresh your DAT Search Loads page</strong> (F5) so Truck Box reloads on it.
          </li>
        </ol>
        <p>
          That clears up most issues. Still stuck? Use the chat button in the corner and we'll help.
        </p>
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
        Use the chat button in the corner of this page to message us directly — it's
        the fastest way to reach support.
      </p>
    ),
  },
  {
    q: "I'm logged in but get an error when sending email. How do I fix it?",
    a: (
        <p>
          This happens when Gmail's "Send email on your behalf" permission wasn't
          granted during sign-in. To fix it: log out, log back in with Google, and
          on the permissions screen make sure the <strong>"Send email"</strong>{" "}
          checkbox is checked before continuing.
        </p>
    ),
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="ed-section">
      <div className="ed-container">
        <div className="mb-12">
          <span className="ed-label">[ 07 ] — FAQ</span>
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
            <h2 className="ed-display mt-6 text-5xl md:text-7xl" style={{ textTransform: "none" }}>
              Privacy Policy &amp; Terms
            </h2>
            <p className="mt-2 ed-label">Last updated — June 25, 2026</p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-12 grid gap-6">
            <article className="tb-card p-6 sm:p-8 tb-prose">
              <h3 style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>Privacy Policy</h3>
              <p>
                <b>Truck Box</b> is operated by <b>TruckBox LLC</b> ("TruckBox LLC," "we," "us," or
                "our"), which is the controller responsible for the data described in this policy.
                Truck Box is a Chrome extension that helps users prepare and send broker outreach
                emails from supported load board pages (such as DAT and Truckstop) using the user's
                own Gmail account and Google-authorized access. Truck Box is designed to collect only
                the information needed for its features, and to use Google data only for
                user-requested, user-facing functionality.
              </p>
              <div className="tb-note">
                <b>Important summary:</b> Truck Box can send an email only when the user explicitly
                clicks to send it. Truck Box does <b>not</b> read the user's Gmail inbox, read
                Gmail messages, read attachments, or scan mailbox content.
              </div>

              <h3>Information we collect</h3>
              <ul>
                <li><b>Local extension settings.</b> Truck Box may store user-entered settings locally in the browser, such as name, MC number, phone number, templates, filter preferences, and extension settings.</li>
                <li><b>Load board information already visible to you.</b> On supported load board pages (DAT and Truckstop), Truck Box reads load details that are <b>already displayed on the page you are actively viewing</b>, such as broker email address, broker phone, origin, destination, pickup date, equipment, trip length, posted rate, and similar load details. This information is used to help compose the message you want to send and to power Truck Box's market features (see "Load market data &amp; analytics" below).</li>
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

              <h3>Load market data &amp; analytics</h3>
              <p>
                Truck Box offers market features such as posted-price history and a dedicated-loads
                finder. To provide these, Truck Box collects load posting details already visible to
                you and aggregates them to produce lane, broker, and pricing insights that are
                surfaced back to you in the extension.
              </p>
              <ul>
                <li><b>Only information already visible to you.</b> Truck Box collects only the load information that is already displayed on the load board page you are actively viewing. It does not access pages, accounts, search results, or data you are not viewing.</li>
                <li><b>No crawlers, scrapers, or background scanners.</b> Truck Box does not use automated crawlers, scrapers, scanners, or bots. It does not browse the load board on its own, query hidden or undocumented endpoints, or harvest data in the background. It only reads what is already on the page in front of you.</li>
                <li><b>Aggregate insight, not surveillance.</b> This information is used to build aggregate market intelligence (such as lane rates, posting frequency, and price trends). It is not used to read your Gmail, to build a profile about you, or to serve advertising.</li>
                <li><b>Retention.</b> Raw captured data is retained only as long as reasonably needed to build and maintain these insights, and is purged on a rolling basis.</li>
                <li><b>Your load board account.</b> You are responsible for using Truck Box in a way that is consistent with your own load board subscription and that platform's terms.</li>
              </ul>

              <h3>How we use information</h3>
              <ul>
                <li><b>To send emails the user explicitly requests.</b> Truck Box uses the Gmail API only to send an email when the user chooses to send that email.</li>
                <li><b>To compose and populate email content.</b> Supported page data and saved templates are used only to help prepare the draft content and recipient details the user is sending.</li>
                <li><b>To authenticate users.</b> Basic Google account information may be used to authenticate the user and confirm authorized access.</li>
                <li><b>To provide account, subscription, and security functionality.</b> Limited backend processing may be used for subscription checks, fraud prevention, abuse prevention, operational reliability, and customer support.</li>
                <li><b>To provide market and analytics features.</b> Load details already visible to you on the load board are used to build the aggregate market insights described in "Load market data &amp; analytics" above.</li>
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

              <h3>Third-party factoring connections (RTS Pro)</h3>
              <p>
                Truck Box includes an optional feature that displays a broker's factoring
                credit rating using your own factoring provider account (for example, RTS Pro).
                This connection is entirely optional and is only used if you choose to enable it.
              </p>
              <ul>
                <li><b>We never collect or store your factoring login.</b> You log in directly on the provider's own website (for example, <code>rtspro.com</code>). Truck Box never sees, receives, or stores your factoring username or password.</li>
                <li><b>We reuse your own browser session.</b> After you log in on the provider's site, Truck Box reads the session token from your own authenticated requests to that provider and stores it locally in your browser (<code>chrome.storage.local</code>) on your device.</li>
                <li><b>The token stays on your device and goes only to the provider.</b> The session token is sent solely to the factoring provider's own API to look up the broker credit rating you request. It is not transmitted to Truck Box's servers.</li>
                <li><b>You stay in control.</b> You can disconnect at any time in the extension, which immediately clears the stored session token from your browser. Tokens also expire on their own, after which you must log in again.</li>
              </ul>

              <h3>Maps &amp; route display (Google Maps)</h3>
              <p>
                Truck Box can show a route map for a load using Google Maps. To display the map and
                route, the relevant load location details (such as origin, destination, and the truck
                location you provide) are sent to Google Maps so it can render the route. Truck Box
                does not control Google Maps; your use of the map is also subject to{" "}
                <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Google's Terms of Service</a>{" "}
                and{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google's Privacy Policy</a>.
              </p>

              <h3>Broker authority &amp; FMCSA data</h3>
              <p>
                Truck Box can display publicly available broker authority and safety information from
                the FMCSA (the U.S. Federal Motor Carrier Safety Administration) and similar public
                sources. To do this, a broker identifier already shown to you (such as an MC/DOT
                number or company name) is used to look up publicly available records.
              </p>
              <ul>
                <li><b>Public, informational data.</b> This information comes from public records and is provided for your convenience and information only.</li>
                <li><b>No guarantee of accuracy.</b> Truck Box does not own, control, or verify FMCSA data and is not responsible for its accuracy, completeness, or timeliness. You should independently verify any broker before doing business.</li>
                <li><b>No affiliation.</b> Truck Box is not affiliated with or endorsed by the FMCSA or any government agency.</li>
              </ul>

              <h3>Storage &amp; Security</h3>
              <ul>
                <li><b>Local-first design.</b> Templates, settings, and preferences are primarily stored locally on the user's device.</li>
                <li><b>Limited backend use.</b> Backend services are used for account management, subscription verification, security, fraud prevention, abuse prevention, support, reliable service operation, and the market/analytics features described above.</li>
                <li><b>No sale of personal data.</b> We do not sell personal information, Google user data, or Gmail-related data.</li>
                <li><b>No unauthorized sharing.</b> We do not share Google user data except where necessary to provide a user-requested service, for security or legal compliance, or as otherwise permitted by applicable law and Google policy.</li>
                <li><b>Reasonable safeguards.</b> We use reasonable administrative, technical, and organizational measures designed to protect the data relevant to operation of Truck Box and related services.</li>
              </ul>

              <h3>Data deletion &amp; revoking access</h3>
              <ul>
                <li>Users can revoke Google account access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
                <li>Users can remove locally stored extension data by clearing extension storage, resetting the extension, or uninstalling the extension.</li>
                <li>If account, subscription, support, or captured market data associated with your account exists on our backend, you may request access to or deletion of it by contacting us through the contact form on this website (see the "Contact" section). We will respond within a reasonable time and as required by applicable law.</li>
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

              <h3>No affiliation &amp; trademarks</h3>
              <p>
                Truck Box is an independent, third-party browser add-on built for the user. It is
                <b> not affiliated with, endorsed by, sponsored by, or otherwise associated with</b>{" "}
                DAT, Truckstop, RTS / RTS Financial, Google, the FMCSA, or any other platform it
                works alongside. Truck Box does not host, control, or own those services or their
                data — it simply helps you act on information already shown to you in your own
                accounts on those services.
              </p>
              <p>
                All product names, logos, and trademarks — including "DAT," "Truckstop," "RTS,"
                "Google," "Gmail," and "FMCSA" — are the property of their respective owners and are
                used here only for identification and descriptive purposes. Use of these names does
                not imply any endorsement or partnership.
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
              <p style={{ fontSize: "0.9rem" }}>Last updated: <b>June 25, 2026</b></p>

              <h3>Acceptance</h3>
              <p>
                These Terms &amp; Conditions are a binding agreement between you and{" "}
                <b>TruckBox LLC</b> ("TruckBox LLC," "we," "us," or "our"), the company that operates
                Truck Box. By installing, accessing, or using Truck Box, you agree to these Terms
                &amp; Conditions and the Privacy Policy on this page. In particular, when you sign in or
                log in to Truck Box (including signing in with your Google account), you confirm that
                you have read, understood, and accepted these Terms &amp; Conditions and the Privacy
                Policy, and that you are authorized to do so. If you do not agree, do not sign in to
                or use Truck Box.
              </p>

              <h3>License</h3>
              <p>
                Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
                revocable license to use Truck Box for lawful personal or business use.
              </p>

              <h3>Description of service</h3>
              <p>
                Truck Box is an independent browser extension that works on top of supported load
                board pages (such as DAT and Truckstop). It helps users prepare and send outreach
                emails using the user's own Gmail account and user-authorized Google access, and it
                provides supporting tools such as route maps, rate calculations, broker information,
                and aggregate market analytics built from load details already visible to the user.
                Truck Box is a tool only — the user remains the sender of every email and the
                decision-maker for every action taken with it.
              </p>

              <h3>User responsibility</h3>
              <ul>
                <li>You are the sender of, and are solely responsible for, the content of every email you send using Truck Box, including compliance with anti-spam laws such as the U.S. CAN-SPAM Act and any equivalent laws that apply to you.</li>
                <li>You are responsible for maintaining your own valid accounts and subscriptions with any load board or third-party service (such as DAT, Truckstop, or your factoring provider), and for using Truck Box in a way that complies with those services' own terms of service and acceptable-use rules.</li>
                <li>You must use Truck Box in compliance with all applicable laws, third-party platform rules, and anti-spam requirements.</li>
                <li>You must not use Truck Box for spam, phishing, fraud, harassment, deception, unlawful solicitation, or abusive bulk messaging.</li>
                <li>You must not misuse Google APIs, bypass security controls, scrape data you are not authorized to access, or interfere with the integrity of the service or any third-party platform.</li>
              </ul>

              <h3>Google account and API access</h3>
              <p>
                By connecting your Google account, you authorize Truck Box to use the approved
                scopes described on this page solely for the limited purposes described in this
                Privacy Policy. Truck Box does not use Gmail access to read inbox content.
              </p>

              <h3>Third-party services &amp; no affiliation</h3>
              <p>
                Truck Box may interact with third-party services such as Google, supported load board
                websites (DAT, Truckstop), factoring providers (such as RTS), mapping services
                (Google Maps), and public data sources (such as the FMCSA). Your use of those
                third-party services remains subject to their own terms, privacy policies, and
                platform rules.
              </p>
              <p>
                Truck Box is an independent product and is <b>not affiliated with, endorsed by,
                sponsored by, or associated with</b> DAT, Truckstop, RTS, Google, the FMCSA, or any
                other third party. All third-party names, logos, and trademarks are the property of
                their respective owners and are used only for identification.
              </p>

              <h3>Third-party data is informational only</h3>
              <p>
                Information surfaced by Truck Box from third parties — including factoring credit
                ratings, broker authority and FMCSA records, route and distance estimates, rate
                calculations, and aggregate market analytics — is provided for your convenience and
                information only. It may be inaccurate, incomplete, delayed, or estimated. It is not
                financial, legal, or business advice, and you are responsible for independently
                verifying any information before relying on it or doing business with any broker.
              </p>

              <h3>Subscriptions, billing, and cancellation</h3>
              <p>
                Certain features may require an active subscription or valid account status.
                Pricing, trial availability, renewal terms, cancellation, and feature access are
                governed by the plan presented to the user at the time of purchase. If a free trial
                is offered, any billing terms shown during signup or checkout control.
              </p>
              <p>
                Unless otherwise stated at checkout, paid subscriptions renew automatically for
                successive billing periods until cancelled. You can cancel at any time, and
                cancellation stops future charges; access generally continues until the end of the
                current paid period. Except where required by applicable law, payments already made
                are non-refundable, and we are not obligated to provide refunds or credits for
                partial periods or unused time.
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
                Truck Box. To the maximum extent permitted by law, our total aggregate liability for
                any claim arising out of or relating to Truck Box will not exceed the amount you paid
                us for the service in the three (3) months before the event giving rise to the claim.
              </p>

              <h3>Indemnification</h3>
              <p>
                To the maximum extent permitted by law, you agree to indemnify and hold harmless
                TruckBox LLC, its owners, and its affiliates from any claims, damages, losses,
                liabilities, and expenses (including reasonable legal fees) arising out of or related to your use of
                Truck Box, the emails or other content you send, your violation of these Terms or
                applicable law, or your violation of the terms or rights of any third party
                (including any load board, factoring provider, Google, or broker).
              </p>

              <h3>Termination</h3>
              <p>
                You may stop using Truck Box at any time by uninstalling the extension and revoking
                Google access. We may suspend or terminate access if reasonably necessary to
                protect the service, enforce these Terms, address abuse, or comply with legal or
                platform requirements.
              </p>

              <h3>Changes to these Terms</h3>
              <p>
                We may update these Terms from time to time. When we do, we will update the "Last
                updated" date above. Your continued use of Truck Box after changes take effect means
                you accept the updated Terms.
              </p>

              <h3>Governing law</h3>
              <p>
                These Terms are governed by the laws of the State of Illinois, without regard to
                conflict of law principles, except where applicable law requires otherwise.
              </p>

              <h3>Severability</h3>
              <p>
                If any provision of these Terms is held unenforceable, that provision will be limited
                or removed to the minimum extent necessary, and the remaining provisions will stay in
                full force and effect.
              </p>
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================================================
   Get Started guide (route: /guide)
   Standalone onboarding walkthrough — NOT part of the homepage scroll.
   Reachable only via the shared NAV (header / sidebar / footer).
   ============================================================ */

/** Screenshot slot. Shows the image once it's dropped into /public/guide;
 *  until then (or if it fails to load) it renders a calm labeled placeholder
 *  with the exact filename to upload — see /public/guide/IMAGES.txt. */
/** True while the viewport is phone-sized. Used to gate the tap-to-zoom
 *  lightbox to mobile only. */
function useIsMobile(query = "(max-width: 767px)") {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return isMobile;
}

/** Fullscreen image viewer with pinch-to-zoom, drag-to-pan and double-tap.
 *  Background is frozen while open (fixed overlay + touch-action:none + body
 *  scroll lock). Mobile only — opened from GuideShot. */
function ImageZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const g = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    startDist: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    lastTap: 0,
  });

  // freeze the page behind the overlay
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const s = g.current;
    if (e.touches.length === 2) {
      s.mode = "pinch";
      s.startDist = dist(e.touches);
      s.startScale = scale;
      s.startTx = tx;
      s.startTy = ty;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - s.lastTap < 300) {
        scale > 1 ? reset() : setScale(2.5);
        s.lastTap = 0;
        s.mode = "none";
        return;
      }
      s.lastTap = now;
      s.mode = scale > 1 ? "pan" : "none";
      s.startX = e.touches[0].clientX;
      s.startY = e.touches[0].clientY;
      s.startTx = tx;
      s.startTy = ty;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = g.current;
    if (s.mode === "pinch" && e.touches.length === 2) {
      const next = clamp(s.startScale * (dist(e.touches) / s.startDist), 1, 5);
      setScale(next);
      if (next === 1) {
        setTx(0);
        setTy(0);
      }
    } else if (s.mode === "pan" && e.touches.length === 1 && scale > 1) {
      setTx(s.startTx + (e.touches[0].clientX - s.startX));
      setTy(s.startTy + (e.touches[0].clientY - s.startY));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = g.current;
    if (e.touches.length === 0) {
      s.mode = "none";
    } else if (e.touches.length === 1 && scale > 1) {
      s.mode = "pan";
      s.startX = e.touches[0].clientX;
      s.startY = e.touches[0].clientY;
      s.startTx = tx;
      s.startTy = ty;
    }
  };

  return (
    <div className="tb-zoom" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="tb-zoom-close" onClick={onClose} aria-label="Close image">
        <X className="h-6 w-6" />
      </button>
      <img loading="lazy" decoding="async"
        src={src}
        alt={alt}
        className="tb-zoom-img"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        draggable={false}
      />
    </div>
  );
}

function GuideShot({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const file = src.split("/").pop();
  const zoomable = isMobile && !failed;
  return (
    <>
      <figure className={`tb-shot${zoomable ? " tb-shot--zoomable" : ""}`}>
        {!failed ? (
          <>
            <img
              src={src}
              alt={alt}
              loading="lazy"
              onError={() => setFailed(true)}
              onClick={zoomable ? () => setOpen(true) : undefined}
            />
            {zoomable && (
              <span className="tb-shot-zoom" aria-hidden>
                <ZoomIn className="h-4 w-4" />
              </span>
            )}
          </>
        ) : (
          <div className="tb-shot-ph">
            <ImageIcon className="h-6 w-6" style={{ color: "var(--accent)" }} aria-hidden />
            <span className="ed-fcard-ph-note">Screenshot coming soon</span>
            <span className="tb-shot-file">{file}</span>
          </div>
        )}
      </figure>
      {open && zoomable && <ImageZoom src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

type Phase = "Set up" | "Connect" | "Send";

type GuideStep = {
  phase: Phase;
  short: string;
  icon: typeof Download;
  title: string;
  shots: string[];
  note?: { tone: "info" | "warn" | "calm"; text: React.ReactNode };
  cta?: boolean;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    phase: "Set up",
    short: "Install",
    icon: Download,
    title: "Install Truck Box",
    shots: ["/guide/01-install.webp"],
    cta: true,
  },
  {
    phase: "Set up",
    short: "Pin it",
    icon: Pin,
    title: "Pin it to your toolbar",
    shots: ["/guide/02-pin.webp"],
  },
  {
    phase: "Connect",
    short: "Open DAT",
    icon: MapPin,
    title: "Open DAT → Search Loads",
    shots: ["/guide/03-dat-search-loads.webp"],
    note: {
      tone: "info",
      text: (
        <>
          <b>Good to know:</b> Truck Box only works on the DAT <b>Search Loads</b> page.
          You won’t see it on other pages — that’s completely normal.
        </>
      ),
    },
  },
  {
    phase: "Connect",
    short: "Open popup",
    icon: MousePointerClick,
    title: "Open the Truck Box popup",
    shots: ["/guide/04-open-popup.webp"],
  },
  {
    phase: "Connect",
    short: "Connect Gmail",
    icon: LogIn,
    title: "Log in & connect Gmail",
    shots: ["/guide/05-login-connect-gmail.webp", "/guide/05b-consent-send-email-checkbox.webp"],
    note: {
      tone: "warn",
      text: (
        <>
          <b>Don’t miss this:</b> on the Google permission screen, check the box that lets
          Truck Box <b>send email on your behalf</b>. If you skip it, sending won’t work —
          no harm done, just sign in again and check it.
        </>
      ),
    },
  },
  {
    phase: "Connect",
    short: "Refresh",
    icon: RotateCw,
    title: "Refresh the DAT page",
    shots: ["/guide/06-refresh-dat.webp"],
    note: {
      tone: "calm",
      text: (
        <>
          This is the step people forget. If Truck Box isn’t showing up yet, a quick
          refresh is almost always the fix. You’ve got this.
        </>
      ),
    },
  },
  {
    phase: "Send",
    short: "Template",
    icon: FileText,
    title: "Set up your email template",
    shots: ["/guide/07-email-template.webp"],
  },
  {
    phase: "Send",
    short: "Send it",
    icon: Send,
    title: "Send your first email",
    shots: ["/guide/08-send-email.webp"],
  },
];

const GUIDE_FEATURES = [
  {
    icon: FileText,
    name: "Email Template",
    body: "Save your message once. Truck Box auto-fills the load and broker details, so every email is ready in a single click.",
  },
  {
    icon: Filter,
    name: "Map & Filter",
    body: "See routes on a map and filter loads fast — so you spend your time only on the loads worth chasing.",
  },
  {
    icon: DollarSign,
    name: "RTS Credit Check",
    body: "Check a broker’s factoring credit rating right inside DAT, using your own RTS Pro account.",
    isNew: true,
  },
  {
    icon: Gauge,
    name: "Stats",
    body: "Track how many emails you’ve sent and stay on top of your outreach at a glance.",
  },
  {
    icon: Map,
    name: "Google Maps Built In",
    body: "See each load’s route on a real Google map without leaving DAT — no extra tabs, no copy-pasting addresses.",
    isNew: true,
  },
  {
    icon: Calculator,
    name: "RPM Calculator",
    body: "Get the rate-per-mile on every load instantly, so the best-paying runs stand out at a glance.",
    isNew: true,
  },
];

const PHASE_ORDER: Phase[] = ["Set up", "Connect", "Send"];

/** At-a-glance end-to-end flow: one continuous rail with the 8 steps as
 *  numbered dots, phase names sitting above their segment — so a new user
 *  sees the whole path before reading the detailed steps below. */
function JourneyMap() {
  const steps = GUIDE_STEPS.map((s, i) => ({ ...s, n: i + 1 }));
  return (
    <Reveal delay={0.05}>
      <div className="tb-rail">
        <div className="tb-rail-inner">
          {/* phase labels — flex-grow proportional to each phase's step count,
              so each label sits above its segment of the rail */}
          <div className="tb-rail-phases">
            {PHASE_ORDER.map((phase) => (
              <span
                key={phase}
                className="tb-rail-phase"
                style={{ flexGrow: steps.filter((s) => s.phase === phase).length }}
              >
                {phase}
              </span>
            ))}
          </div>

          {/* the rail itself: continuous line + numbered dots */}
          <div className="tb-rail-track">
            {steps.map((s) => (
              <a key={s.n} href={`#${s.n}`} className="tb-rail-node">
                <span className="tb-rail-dot">{s.n}</span>
                <span className="tb-rail-label">{s.short}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function Guide() {
  return (
    <section id="guide" className="ed-section" style={{ paddingTop: 150 }}>
      <div className="ed-container">
        {/* ---------- hero ---------- */}
        <Reveal delay={0.2}>
          <div className="max-w-3xl">
            <span className="ed-label">[ Guide ] — From install to first email</span>
            <h1 className="ed-h2 mt-4">
              The five-minute <span className="ed-accent" style={{ fontStyle: "italic" }}>setup.</span>
            </h1>
            <p className="mt-6 text-lg" style={{ color: "var(--muted)", lineHeight: 1.65 }}>
              A calm, step-by-step walkthrough. Follow along and you’ll be sending broker
              emails from your own Gmail in a few minutes. Nothing here can break anything —
              if you get stuck, you can always start a step over.
            </p>
          </div>
        </Reveal>

        {/* ---------- journey overview (the whole flow at a glance) ---------- */}
        <div className="mt-12 md:mt-16">
          <JourneyMap />
        </div>

        {/* ---------- steps ---------- */}
        <div className="tb-steps mt-16 md:mt-24">
          {GUIDE_STEPS.map((s, i) => {
            const Icon = s.icon;
            const newPhase = i === 0 || GUIDE_STEPS[i - 1].phase !== s.phase;
            const phaseIndex = PHASE_ORDER.indexOf(s.phase) + 1;
            return (
              <Fragment key={s.title}>
                {newPhase && (
                  <Reveal className="tb-phase">
                    <span className="tb-phase-index">{String(phaseIndex).padStart(2, "0")}</span>
                    <span className="tb-phase-name">{s.phase}</span>
                    <span className="tb-phase-rule" aria-hidden />
                  </Reveal>
                )}
                <Reveal id={`${i + 1}`} delay={0.04} className="tb-step">
                <div className="tb-step-num">{i + 1}</div>
                <div className="tb-step-body">
                  <div className="tb-step-head">
                    <Icon className="h-5 w-5 tb-step-icon" aria-hidden />
                    <h2 className="tb-step-title">{s.title}</h2>
                  </div>

                  {s.note && (
                    <div className={`tb-note tb-note--${s.note.tone}`}>{s.note.text}</div>
                  )}

                  {s.cta && (
                    <a
                      className="ed-btn ed-btn-accent mt-5"
                      href={INSTALL_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>Add to Chrome</span> <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}

                  <div className="tb-step-shots">
                    {s.shots.map((src) => (
                      <GuideShot key={src} src={src} alt={s.title} />
                    ))}
                  </div>
                </div>
                </Reveal>
              </Fragment>
            );
          })}
        </div>

        {/* ---------- reassurance ---------- */}
        <Reveal>
          <div className="tb-guide-calm mt-20">
            <ShieldCheck className="h-7 w-7" style={{ color: "var(--accent)", flex: "0 0 auto" }} aria-hidden />
            <div>
              <h2
                className="ed-display"
                style={{ textTransform: "none", fontSize: "clamp(1.5rem, 4vw, 2.2rem)", letterSpacing: "-0.02em" }}
              >
                It’s all good — you’ve got this.
              </h2>
              <p className="mt-2" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                Truck Box never reads your inbox. It only sends the emails you click to send,
                from your own Gmail. Take it one step at a time — and if anything looks off,
                tap the chat in the corner and we’ll walk you through it.
              </p>
            </div>
          </div>
        </Reveal>

        {/* ---------- features ---------- */}
        <div className="mt-24">
          <Reveal>
            <span className="ed-label">What you get</span>
            <h2
              className="ed-h2 mt-4"
              style={{ textTransform: "none", fontSize: "clamp(2rem, 6vw, 4rem)" }}
            >
              Built to get you<br />to the broker first
            </h2>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="tb-feature-grid mt-10">
              {GUIDE_FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div className="tb-feature" key={f.name}>
                    <div className="tb-feature-top">
                      <span className="tb-feature-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="tb-feature-icon">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="tb-feature-head">
                      <h3>{f.name}</h3>
                      {f.isNew && <span className="tb-feature-new">New</span>}
                    </div>
                    <p>{f.body}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>

        {/* ---------- final CTA ---------- */}

        <Reveal>
          <a
              href={INSTALL_URL}
              target="_blank"
              rel="noreferrer"
              className="ed-btn ed-btn-accent mt-7 inline-flex items-center gap-2"
          >
            <span>Install Truck Box — Free</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}


/* ============================================================
   Contact
   ============================================================ */

function ContactForm() {
  const [state, handleSubmit] = useForm("xnjyvqjv");

  if (state.succeeded) {
    return (
      <div className="ed-form-done">
        <span className="ed-label ed-accent">Message sent</span>
        <h3
          className="ed-display text-3xl md:text-4xl mt-3"
          style={{ textTransform: "none", letterSpacing: "-0.02em" }}
        >
          Thanks — we&rsquo;ll reply fast.
        </h3>
        <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>
          Your message is in. We&rsquo;ll get back to you at the email you provided.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ed-form" noValidate>
      {/* Honeypot — bots fill it, humans never see it. Formspree drops these. */}
      <input
        type="text"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="ed-honeypot"
      />

      <div className="ed-field">
        <label htmlFor="cf-email" className="ed-label">Email</label>
        <input
          id="cf-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="ed-input"
        />
        <ValidationError prefix="Email" field="email" errors={state.errors} className="ed-error" />
      </div>

      <div className="ed-field">
        <label htmlFor="cf-phone" className="ed-label">
          Phone <span style={{ textTransform: "none", opacity: 0.7 }}>(optional)</span>
        </label>
        <input
          id="cf-phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="+1 (555) 000-0000"
          className="ed-input"
        />
        <ValidationError prefix="Phone" field="phone" errors={state.errors} className="ed-error" />
      </div>

      <div className="ed-field">
        <label htmlFor="cf-subject" className="ed-label">Subject</label>
        <input
          id="cf-subject"
          type="text"
          name="_subject"
          required
          placeholder="What's this about?"
          className="ed-input"
        />
        <ValidationError prefix="Subject" field="_subject" errors={state.errors} className="ed-error" />
      </div>

      <div className="ed-field">
        <label htmlFor="cf-message" className="ed-label">Message</label>
        <textarea
          id="cf-message"
          name="message"
          required
          rows={5}
          placeholder="Tell us what you need…"
          className="ed-input ed-textarea"
        />
        <ValidationError prefix="Message" field="message" errors={state.errors} className="ed-error" />
      </div>

      <ValidationError errors={state.errors} className="ed-error" />

      <button type="submit" className="ed-btn ed-btn-accent" disabled={state.submitting}>
        <span>{state.submitting ? "Sending…" : "Send message"}</span>
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </form>
  );
}

function Contact() {
  const channels = [
    { label: "Book a call", handle: "calendly.com/truckboxapp", href: CALENDLY_URL, cta: "Free 15-min demo" },
    { label: "Instagram", handle: "@truckbox.app", href: "https://instagram.com/truckbox.app", cta: "Follow updates" },
    { label: "Facebook", handle: "/truckboxapp", href: "https://facebook.com/truckboxapp", cta: "Community" },
  ];

  return (
    <section id="contact" className="ed-section">
      <div className="ed-container">
        <div className="mb-12">
          <span className="ed-label">[ 08 ] — Contact</span>
          <h2 className="ed-h2 mt-4">
            Talk <span className="ed-accent">to us</span>
          </h2>
          <p className="mt-5 max-w-md text-lg" style={{ color: "var(--muted)" }}>
            Login issues, billing, template setup, or product feedback — we reply fast.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-start">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              <span className="ed-label">Or reach us directly</span>
              <div className="mt-4">
                {channels.map((c) => (
                  <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="ed-row">
                    <div className="flex items-baseline gap-5">
                      <span className="ed-label hidden sm:block w-24">{c.label}</span>
                      <span
                        className="ed-row-title ed-display text-2xl md:text-3xl"
                        style={{ textTransform: "none", letterSpacing: "-0.02em" }}
                      >
                        {c.handle}
                      </span>
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="ed-label hidden md:block">{c.cta}</span>
                      <ArrowUpRight className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
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
            <Link className="ed-btn" to="/faq">
              <span>Read FAQ</span>
            </Link>
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
        <div
            className="ed-container pt-12"
            style={{
              paddingBottom: "max(2.5rem, calc(env(safe-area-inset-bottom) + 1rem))",
            }}
        >
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-3">
              {NAV.map((n) =>
                  n.route ? (
                      <Link
                          key={n.href}
                          to={n.href}
                          className="ed-label hover:text-[color:var(--ink)] transition-colors"
                      >
                        {n.label}
                      </Link>
                  ) : (
                      <a
                          key={n.href}
                          href={n.href}
                          className="ed-label hover:text-[color:var(--ink)] transition-colors"
                      >
                        {n.label}
                      </a>
                  )
              )}
            </div>

            <div className="flex justify-center md:justify-end gap-3">
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

          <div
              className="mt-8 pt-5 flex flex-col items-center text-center gap-2 md:flex-row md:justify-between md:text-left"
              style={{ borderTop: "1px solid var(--line)" }}
          >
            <div className="flex flex-col items-center md:items-start">
            <span className="ed-label">
              © {new Date().getFullYear()} TruckBox LLC — registered in Illinois, USA
            </span>

              <span className="ed-label mt-1 flex items-center justify-center md:justify-start gap-1">
              Crafted with coffee and java
              <img loading="lazy" decoding="async"
                  src="/java-logo.png"
                  alt="Java"
                  width={18}
                  height={18}
                  className="inline-block shrink-0"
                  style={{
                    objectFit: "contain",
                    verticalAlign: "middle",
                  }}
              />
            </span>
            </div>

            <span className="ed-label">Chicago, USA</span>
          </div>
        </div>
      </footer>
  );
}