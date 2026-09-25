/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useCallback, useEffect, useRef, useState, Fragment, Suspense, lazy, type ReactNode } from "react";
import { usePageMeta } from "./lib/meta";
import { ProviderLogo } from "./components/ProviderLogo";
import { getLandingTheme, setLandingTheme, THEME_EVENT, type LandingTheme } from "./lib/theme";
import { auth } from "./lib/auth";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import Lenis from "lenis";
import { useForm, ValidationError } from "@formspree/react";

import {
  Sun,
  Moon,
  ArrowUpRight,
  Plus,
  Minus,
  Play,
  Menu,
  X,
  Instagram,
  Facebook,
  MapPin,
  Check,
  RotateCw,
  FileText,
  Image as ImageIcon,
  Download,
  Pin,
  MousePointerClick,
  LogIn,
  Send,
  ShieldCheck,
  ZoomIn,
} from "lucide-react";

type NavItem = { href: string; label: string; route?: boolean; desktopOnly?: boolean };

/* ===== Site-wide constants ============================================== */

const NAV: NavItem[] = [
  { href: "/demo", label: "Demo", route: true, desktopOnly: true },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/business/start", label: "Teams", route: true },
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

/* ===== Motion and scroll primitives ===================================== */

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

  useEffect(() => {
    if (!location.hash) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const go = () => {
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

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 130, damping: 30, mass: 0.3 });
  return <motion.div className="tb-progress" style={{ scaleX }} aria-hidden />;
}

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

/* ===== Page shell — order of sections on / ============================== */

export default function App() {
  usePageMeta({
    title: "TruckBox — One-Click Broker Emails for DAT & Truckstop",
    description:
      "Chrome extension for truck dispatchers: send broker emails from the DAT One and Truckstop load boards in one click, or let Auto Emailer send them for you the moment a load is posted. Templates, broker credit checks (RTS, Apex, Triumph), route maps, profit and rate-per-mile calculator with tolls. $7/mo, 7-day free trial.",
    path: "/",
  });
  return (
    <div className="min-h-screen">
      <Spotlight />
      <div className="tb-bg-vignette" aria-hidden />
      <ScrollProgress />
      <AnnouncementBar />
      <Header />
      <main>
        <Hero />
        <Numbers />
        <Integrations />
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

/* ===== Header, theme toggle, announcement bar =========================== */

function ThemeToggle() {
  const [theme, setTheme] = useState<LandingTheme>(() => getLandingTheme());
  useEffect(() => {
    const sync = () => setTheme(getLandingTheme());
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  const next: LandingTheme = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="tb-theme-toggle"
      onClick={() => setLandingTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === "light" ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [signedIn] = useState(() => {
    try {
      return auth.isAuthed();
    } catch {
      return false;
    }
  });
  const accountLabel = signedIn ? "Dashboard" : "Sign in";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          background: scrolled ? "var(--header-bg)" : "transparent",
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
            className="tb-brand flex items-center gap-3"
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
                src="/logo-96.webp"
                alt=""
                width={30}
                height={30}
                className="tb-brand-mark"
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
              {"Truck Box".split("").map((ch, i) => (
                <span
                  key={i}
                  className="tb-brand-letter"
                  style={{ animationDelay: `${i * 28}ms` }}
                  aria-hidden
                >
                  {ch === " " ? "\u00a0" : ch}
                </span>
              ))}
              <span className="sr-only">Truck Box</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 xl:gap-8">
            {NAV.map((n) => (
              <Link
                key={n.href}
                to={n.href}
                className="tb-nav-link ed-label whitespace-nowrap"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <ThemeToggle />
            <Link className="ed-btn ed-btn-accent whitespace-nowrap" to="/business">
              <span>{accountLabel}</span> <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="lg:hidden flex items-center gap-3">
            <ThemeToggle />
            <Link
              className="ed-btn ed-btn-accent"
              style={{ padding: "9px 16px", letterSpacing: "0.1em", whiteSpace: "nowrap" }}
              to="/business"
            >
              <span>{accountLabel}</span>
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
              {NAV.filter((n) => !n.desktopOnly).map((n, i) => {
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

const PLAN_FEATURES = [
    "7-day free trial (No Credit Card)",
    "Cancel anytime (1 click)",
    "Works on DAT + Truckstop",
    "One-click email sending",
    "Auto Emailer \u2014 sends for you on a watched search",
    "Multiple email templates (up to 3)",
    "Gmail & Outlook — Google or Microsoft sign-in",
    "Multiple sender mailboxes (up to 3 extra)",
    "Posted load price analytics",
    "Saved loads with notes and lane price history",
    "Dedicated loads finder",
    "Factoring credit check (RTS, Apex, Triumph)",
    "Built-in Google Maps route",
    "Rate-per-mile calculator",
    "Profit calculator (fuel, tolls, driver pay)",
    "Toll estimate for the lane, one click",
    "Copy & share load info",
    "Click-to-call broker numbers",
    "FMCSA broker report",
    "Refresh-loads button",
    "Dark mode",
    "Short-load filtering",
    "Keyboard navigation",
  ];

const PLAN_FEATURE_COUNT = PLAN_FEATURES.length;

const PLAN_TERMS = ["7-day free trial (No Credit Card)", "Cancel anytime (1 click)"];

const NEWS_KEY = "tb-news-2026-09";
const NEWS_SNOOZE_DAYS = 14;

const NEWS_ITEMS = [
  {
    tag: "New",
    text: "Outlook & Microsoft 365, multiple mailboxes, and teams from $7 a seat",
    cta: "See what's new →",
    to: "/#features",
  },
  {
    tag: "Live",
    text: "Try TruckBox on a simulated load board — no install, no account",
    cta: "Open the demo →",
    to: "/demo",
  },
  {
    tag: "New",
    text: "Auto Emailer — set your filters on a DAT search and it emails the broker for you",
    cta: "See how it works →",
    to: "/#features",
  },
];

const NEWS_ROTATE_MS = 7000;

function AnnouncementBar() {
  const [open, setOpen] = useState(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(NEWS_KEY));
      if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return true;
      return Date.now() - dismissedAt > NEWS_SNOOZE_DAYS * 86400000;
    } catch {
      return true;
    }
  });

  const [item, setItem] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(
      () => setItem((i) => (i + 1) % NEWS_ITEMS.length),
      NEWS_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(NEWS_KEY, String(Date.now()));
    } catch {}
  };
  const current = NEWS_ITEMS[item];
  return (
    <div className="tb-news">
      <Link key={item} to={current.to} className="tb-news-body tb-news-in">
        <span className="tb-news-tag">{current.tag}</span>
        <span>{current.text}</span>
        <span className="tb-news-go">{current.cta}</span>
      </Link>
      <button type="button" className="tb-news-x" onClick={close} aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ===== Section 01 — Numbers and integrations ============================ */

function CountUp({ to, decimals = 0, prefix = "", suffix = "" }: {
  to: number; decimals?: number; prefix?: string; suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [reduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    const start = performance.now();
    const DURATION = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, to]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function Numbers() {
  const stats: { value: ReactNode; label: string; sub: string; href?: string }[] = [
    {
      value: (
        <>
          <CountUp to={3} />
          <span className="tb-stat-unit">h</span>
        </>
      ),
      label: "Saved every week",
      sub: "per full-time dispatcher",
    },
    { value: <CountUp to={1} />, label: "Click to email a broker", sub: "template fills itself" },
    { value: <CountUp to={30} />, label: "Days of price history", sub: "on every lane you open" },
    {
      value: (
        <>
          <CountUp to={5} decimals={1} />
          <span className="tb-stat-star">★</span>
        </>
      ),
      label: "Chrome Web Store",
      sub: "100+ dispatchers",
      href: "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd/reviews",
    },
    {
      value: <CountUp to={PLAN_FEATURE_COUNT} />,
      label: "Features for $7",
      sub: "no tiers, no add-ons",
      href: "/#pricing",
    },
  ];
  return (
    <section className="tb-numbers-wrap">
      <div className="ed-container">
        <Reveal>
          <div className="flex items-end justify-between gap-6 mb-8">
            <div>
              <span className="ed-label">Why choose us</span>
              <h2 className="ed-h2 mt-3" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>
                Dispatchers pick Truck Box for the hours it gives back
              </h2>
            </div>
          </div>
        </Reveal>
        <div className="tb-numbers">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 0.06}>
              {s.href ? (
                <a
                  className="tb-stat tb-stat-link"
                  href={s.href}
                  {...(s.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  <span className="tb-stat-value ed-display">{s.value}</span>
                  <span className="tb-stat-label">{s.label}</span>
                  <span className="tb-stat-sub">{s.sub} →</span>
                </a>
              ) : (
                <div className="tb-stat">
                  <span className="tb-stat-value ed-display">{s.value}</span>
                  <span className="tb-stat-label">{s.label}</span>
                  <span className="tb-stat-sub">{s.sub}</span>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  const items = [
    { img: "/dat.png", alt: "DAT", note: "Load board" },
    { img: "/truckstop.png", alt: "Truckstop", note: "Load board" },
    { node: <ProviderLogo provider="GOOGLE" size={30} />, alt: "Gmail", note: "Send from" },
    { node: <ProviderLogo provider="MICROSOFT" size={28} />, alt: "Outlook", note: "Send from" },
    { img: "/logos/rts.webp", alt: "RTS", note: "Credit check" },
    { img: "/logos/triumph.webp", alt: "Triumph", note: "Credit check" },
    { img: "/logos/apex.webp", alt: "Apex Capital", note: "Credit check" },
    { img: "/logos/gmaps.svg", alt: "Google Maps", note: "Routes" },
    { img: "/logos/fmcsa.svg", alt: "FMCSA", note: "Authority" },
  ];

  return (
    <section className="ed-section" style={{ paddingTop: 0 }}>
      <div className="ed-container">
        <Reveal>
          <div className="flex items-end justify-between gap-6 mb-8">
            <span className="ed-label">Plays well with your stack</span>
          </div>
        </Reveal>
      </div>

        <div className="tb-marquee">
          <div className="tb-marquee-track">
            {[0, 1].map((copy) =>
              items.map((it) => (
                <div className="tb-int" key={`${copy}-${it.alt}`} aria-hidden={copy === 1}>
                  <span className="tb-int-mark">
                    {it.img ? <img src={it.img} alt={it.alt} loading="lazy" decoding="async" /> : it.node}
                  </span>
                  <span className="tb-int-name">{it.alt}</span>
                  <span className="tb-int-note">{it.note}</span>
                </div>
              )),
            )}
          </div>
        </div>
    </section>
  );
}

const HeroDemo = lazy(() => import("./pages/demo/HeroDemo"));

/* ===== Hero and social proof ============================================ */

function HeroVisual() {
  return (
    <Suspense fallback={<div className="tb-hero-demo-skeleton" />}>
      <HeroDemo />
    </Suspense>
  );
}

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
          <span className="ed-label hidden sm:block">Chicago, USA · Est. 2025</span>
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
              Brokers answer whoever writes first. One key turns any DAT or Truckstop load into a ready quote,
              sent from your own Gmail or Outlook — with 30 days of that lane's prices already on screen.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a ref={tryRef} className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>TRY FREE</span> <ArrowUpRight className="h-4 w-4" />
              </a>
              <a className="ed-btn" href={CALENDLY_URL} target="_blank" rel="noreferrer">
                <span>Book Live Demo</span>
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
              <span className="tb-hero-note">
                Google or Microsoft sign-in · we never see your DAT password
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <motion.div style={{ y: mockY }}>
              <HeroVisual />
            </motion.div>
          </Reveal>
        </div>
      </motion.div>
    </section>
  );
}

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
              className="tb-rating ed-display text-5xl leading-none"
              style={{ textTransform: "none", letterSpacing: "-0.02em" }}
            >
              5.0 <span className="ed-accent tb-star">★</span>
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

        <div className="tb-reviews grid md:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.name} delay={i * 0.08}>
              <figure className="tb-review">
                <span className="tb-review-mark" aria-hidden>“</span>
                <blockquote className="text-lg leading-relaxed">{r.text}</blockquote>
                <figcaption className="ed-label mt-6">
                  <span className="tb-review-stars" aria-label="5 stars">★★★★★</span>
                  {r.name}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

type FeatureVisualKind = "platforms" | "mailboxes" | "analytics";
type FeatureItem = {
  slug: string;
  title: string;
  body: string;
  visual?: FeatureVisualKind;
  logos?: { src: string; alt: string }[];
  plan?: string[];
};

/* ===== Section 03 — Features: cards, panels, lightbox =================== */

function FeatureLogos({ item }: { item: FeatureItem }) {
  if (!item.logos) return null;
  return (
    <span className="tb-feature-logos">
      {item.logos.map((l) => (
        <img key={l.src} src={l.src} alt={l.alt} loading="lazy" decoding="async" draggable={false} />
      ))}
    </span>
  );
}

function FeatureMedia({ item, alt = "" }: { item: FeatureItem; alt?: string }) {
  if (!item.visual) {
    return <img src={`/demos/${item.slug}.webp`} alt={alt} loading="lazy" decoding="async" draggable={false} />;
  }
  return (
    <div className={"tb-fv tb-fv-" + item.visual} role="img" aria-label={alt || item.title}>
      {item.visual === "platforms" && (
        <>
          <div className="tb-fv-group">
            <div className="tb-fv-kicker">Works inside</div>
            <div className="tb-fv-chips">
              <span className="tb-fv-chip">
                <img src="/dat.png" alt="DAT" loading="lazy" decoding="async" draggable={false} />
              </span>
              <span className="tb-fv-chip">
                <img src="/truckstop.png" alt="Truckstop" loading="lazy" decoding="async" draggable={false} />
              </span>
            </div>
          </div>
          <div className="tb-fv-group">
            <div className="tb-fv-kicker">Sends from</div>
            <div className="tb-fv-chips">
              <span className="tb-fv-chip">
                <ProviderLogo provider="GOOGLE" size={26} />
                <b>Gmail</b>
              </span>
              <span className="tb-fv-chip">
                <ProviderLogo provider="MICROSOFT" size={24} />
                <b>Outlook</b>
              </span>
            </div>
          </div>
        </>
      )}
      {item.visual === "mailboxes" && (
        <>
          <div className="tb-fv-kicker">Send from</div>
          <div className="tb-fv-list">
            {[
              { p: "GOOGLE" as const, a: "ops@smartfreight.com", t: "Smart Freight · Reefer" },
              { p: "MICROSOFT" as const, a: "dispatch@acmelogistics.com", t: "Acme Logistics · Dry van" },
              { p: "GOOGLE" as const, a: "loads@bluelinecarriers.com", t: "Blueline · Flatbed" },
            ].map((m, i) => (
              <div key={m.a} className={"tb-fv-row" + (i === 1 ? " is-on" : "")}>
                <ProviderLogo provider={m.p} size={20} />
                <div>
                  <b>{m.a}</b>
                  <span>Template: {m.t}</span>
                </div>
                {i === 1 && <em>✓</em>}
              </div>
            ))}
          </div>
          <div className="tb-fv-note">Each email keeps its own templates, name and MC</div>
        </>
      )}
      {item.visual === "analytics" && (
        <>
          <div className="tb-fv-kicker">This load today · Chicago, IL → Dallas, TX</div>
          <svg className="tb-fv-chart" viewBox="0 0 320 150" aria-hidden="true">
            <line x1="0" y1="130" x2="320" y2="130" />
            <polyline points="10,98 60,92 110,80 160,84 210,62 260,50 310,40" />
            {[
              [10, 98], [60, 92], [110, 80], [160, 84], [210, 62], [260, 50], [310, 40],
            ].map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r="4" />
            ))}
            <text x="10" y="146">6 AM</text>
            <text x="150" y="146">12 PM</text>
            <text x="286" y="146">Now</text>
          </svg>
          <div className="tb-fv-stats">
            <div><span>Low</span><b>$1,850</b></div>
            <div><span>High</span><b>$2,400</b></div>
            <div><span>Posted today</span><b>14×</b></div>
          </div>
        </>
      )}
    </div>
  );
}

const BA_VIEWS = {
  details: {
    label: "DAT",
    before: "/compare/before.webp",
    after: "/compare/after.webp",
    ratio: "1742 / 1110",
  },
  darkmode: {
    label: "Day / Night",
    before: "/compare/day.webp",
    after: "/compare/night.webp",
    ratio: "1924 / 1068",
  },
  truckstop: {
    label: "Truckstop",
    pair: { before: "/compare/truckstop-before.webp", after: "/compare/truckstop-after.webp" },
    ratio: "1450 / 950",
  },
} as const;
type BaView = keyof typeof BA_VIEWS;

function BeforeAfter() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hinted = useRef(false);
  const [pos, setPos] = useState(50);
  const [view, setView] = useState<BaView>("details");
  const [anim, setAnim] = useState(false);
  const cur = BA_VIEWS[view];
  const pair = "pair" in cur ? cur.pair : undefined;
  const before = "before" in cur ? cur.before : undefined;
  const after = "after" in cur ? cur.after : undefined;
  const isStatic = !!pair;

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
  }, []);

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
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div className="tb-ba-tabs">
              {(Object.keys(BA_VIEWS) as BaView[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  className={"tb-ba-tab" + (k === view ? " is-on" : "")}
                  aria-pressed={k === view}
                >
                  {BA_VIEWS[k].label}
                </button>
              ))}
            </div>
          </div>

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
                color: "var(--on-accent)",
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
              aspectRatio: isStatic ? undefined : cur.ratio,
              overflow: isStatic ? "visible" : "hidden",
              borderRadius: 18,
              border: isStatic ? "none" : "1px solid var(--line)",
              background: isStatic ? "transparent" : "#eef1f6",
              userSelect: "none",
              touchAction: "none",
              cursor: isStatic ? "default" : "ew-resize",
            }}
          >
            {isStatic ? (
              <div className="tb-ts-pair">
                {[
                  { src: pair!.before, label: "Before", after: false },
                  { src: pair!.after, label: "★ After", after: true },
                ].map((p) => (
                  <figure key={p.src} className={"tb-ts-card" + (p.after ? " is-after" : "")}>
                    <figcaption className="tb-ts-label">{p.label}</figcaption>
                    <img
                      loading="lazy"
                      decoding="async"
                      src={p.src}
                      alt={
                        p.after
                          ? "Truckstop load board with Truck Box: broker email in one click, route map and rate per mile"
                          : "The same Truckstop load board without Truck Box"
                      }
                      draggable={false}
                    />
                  </figure>
                ))}
              </div>
            ) : (
            <>
            <img loading="lazy" decoding="async"
              src={after}
              alt="DAT One load board with Truck Box: one-click broker email, route map with deadhead and profit calculator inside the load"
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

            <img loading="lazy" decoding="async"
              src={before}
              alt="The same DAT One load board without Truck Box"
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

function FeaturePanels({ items, onOpen }: { items: FeatureItem[]; onOpen: (i: number) => void }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const reduce =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !inView || reduce) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % items.length), 5000);
    return () => window.clearTimeout(t);
  }, [active, paused, inView, reduce, items.length]);

  return (
    <div
      ref={ref}
      className="tb-fpanels hidden lg:flex"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map((it, i) => {
        const open = i === active;
        const num = String(i + 1).padStart(2, "0");
        return (
          <div
            key={it.slug}
            role="button"
            tabIndex={0}
            aria-expanded={open}
            aria-label={it.title}
            className={"tb-fpanel" + (open ? " is-open" : "")}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => (open ? onOpen(i) : setActive(i))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(i);
              }
            }}
          >
            <div className="tb-fpanel-closed" aria-hidden>
              <span className="tb-fpanel-num">/{num}</span>
              <span className="tb-fpanel-vtitle">{it.title}</span>
            </div>

            <div className="tb-fpanel-open">
              <div className="tb-fpanel-media">
                <FeatureMedia item={it} />
                <span className="tb-bento-zoom" aria-hidden>⤢</span>
              </div>
              <div className="tb-fpanel-text">
                <span className="tb-fpanel-num is-accent">/{num}</span>
                <h3 className="tb-fpanel-title">{it.title}</h3>
                <p className="tb-fpanel-body">{it.body}</p>
                <FeatureLogos item={it} />
              </div>
            </div>

            {open && !paused && inView && !reduce && <span className="tb-fpanel-timer" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}

function Features() {
  const items: FeatureItem[] = [
    {
      slug: "email",
      plan: ["One-click email sending", "Auto Emailer \u2014 sends for you on a watched search"],
      title: "One-click email — or none at all",
      body: "Email the broker straight from a DAT or Truckstop load with your template filled in — no copy-paste, no extra tab. Or set your rate, deadhead and weight limits on a search and let Auto Emailer send it for you, the minute a matching load is posted.",
    },
    {
      slug: "rts",
      plan: ["Factoring credit check (RTS, Apex, Triumph)"],
      title: "Factoring credit check",
      body: "A broker's credit rating and days-to-pay right on the load, from 3 factoring companies — RTS, Triumph and Apex Capital — with your own account.",
      logos: [
        { src: "/logos/rts.webp", alt: "RTS Financial" },
        { src: "/logos/triumph.webp", alt: "Triumph" },
        { src: "/logos/apex.webp", alt: "Apex Capital" },
      ],
    },
    {
      slug: "platforms",
      plan: ["Works on DAT + Truckstop", "Gmail & Outlook \u2014 Google or Microsoft sign-in"],
      title: "Multiple platforms",
      body: "Works right inside DAT and Truckstop and sends from your own Gmail or Outlook — personal accounts or Microsoft 365 work mailboxes.",
      visual: "platforms",
    },
    {
      slug: "analytics",
      plan: ["Posted load price analytics"],
      title: "Lane price analytics",
      body: "See how many times a load was posted today and how its price changed during the day — know when to call and what to ask.",
      visual: "analytics",
    },
    {
      slug: "saved",
      plan: ["Saved loads with notes and lane price history"],
      title: "Saved loads",
      body: "Star a load and it stays after the posting is gone — with your own notes, a pickup calendar and what the lane pays now. Email the broker days later without hunting for it again.",
    },
    {
      slug: "profit",
      plan: ["Rate-per-mile calculator", "Profit calculator (fuel, tolls, driver pay)", "Toll estimate for the lane, one click"],
      title: "Profit calculator",
      body: "The rate minus fuel, tolls and the driver's cut, right where the rate is — plus the break-even you can't go below. Diesel fills in from the national average, miles with or without deadhead.",
    },
    {
      slug: "mailboxes",
      plan: ["Multiple sender mailboxes (up to 3 extra)"],
      title: "Multiple mailboxes",
      body: "Connect several Gmail or Outlook addresses. Each has its own templates, name and MC — pick the sender per load.",
      visual: "mailboxes",
    },
  ];

  const covered = new Set([...items.flatMap((it) => it.plan ?? []), ...PLAN_TERMS]);
  const extras = PLAN_FEATURES.filter((feature) => !covered.has(feature));

  const total = items.length;
  const [lb, setLb] = useState<number | null>(null);
  const lbStep = (delta: number) =>
    setLb((v) => (v == null ? v : (((v + delta) % total) + total) % total));

  useEffect(() => {
    items.forEach((it) => {
      if (it.visual) return;
      const img = new Image();
      img.src = `/demos/${it.slug}.webp`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const lbMulti = useRef(false);
  const onLbTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
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
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lbStep(dx < 0 ? 1 : -1);
    }
  };

  const caroRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(total);

  const cardStride = () => {
    const track = caroRef.current;
    if (!track || track.children.length < 2) return track?.clientWidth || 1;
    const a = track.children[0] as HTMLElement;
    const b = track.children[1] as HTMLElement;
    return b.offsetLeft - a.offsetLeft || a.offsetWidth;
  };

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
        </div>

        <FeaturePanels items={items} onOpen={setLb} />

        <div className="lg:hidden">
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
                  <FeatureMedia item={it} alt={it.title} />
                  <span className="tb-bento-zoom" aria-hidden>⤢</span>
                </span>
                <span className="tb-bento-text">
                  <span className="tb-bento-idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="tb-bento-title">{it.title}</span>
                  <span className="tb-bento-body">{it.body}</span>
                  <FeatureLogos item={it} />
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

        <div className="tb-extras">
          <Reveal className="tb-extras-head">
            <span className="ed-label">Also included</span>
            <p>
              All <b>{PLAN_FEATURE_COUNT} features</b> come in the same $7 plan — nothing is held
              back for a bigger tier.
            </p>
          </Reveal>
          <ul className="tb-extras-list">
            {extras.map((feature, index) => (
              <motion.li
                key={feature}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}
              >
                <Check className="h-4 w-4" aria-hidden />
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

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
              <FeatureMedia item={items[lb]} alt={items[lb].title} />
              <figcaption>
                <span className="tb-bento-idx">{String(lb + 1).padStart(2, "0")}</span>
                <span className="tb-lb-title">{items[lb].title}</span>
                <span className="tb-lb-body">{items[lb].body}</span>
                <FeatureLogos item={items[lb]} />
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

/* ===== Section 04 — How it works ======================================== */

function HowItWorks() {
  const steps = [
    { t: "Install the extension", d: "Add Truck Box to Chrome and pin it for quick access." },
    { t: "Sign in with Google or Microsoft", d: "Connect Gmail or Outlook and activate the free trial." },
    {
      t: "Work inside DAT or Truckstop",
      d: "Open DAT or Truckstop, use your templates, filter loads, and send with one click.",
    },
  ];
  const view = { once: true, margin: "-80px" } as const;
  return (
    <section className="ed-section">
      <div className="ed-container">
        <div className="flex items-end justify-between gap-6 mb-14">
          <div>
            <span className="ed-label">[ 04 ] — How it works</span>
            <h2 className="ed-h2 mt-4">Start in 3 steps</h2>
          </div>
        </div>

        <div>
          {steps.map((s, i) => (
            <div
              key={s.t}
              className="tb-hiw grid md:grid-cols-[auto_1fr] gap-6 md:gap-12 items-start py-10"
            >
              <motion.span
                aria-hidden
                className="tb-hiw-line"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={view}
                transition={{ duration: 1.1, ease: EASE }}
              />
              <motion.span
                className="tb-hiw-num-mask text-[5rem] md:text-[8rem] leading-none"
                initial="hidden"
                whileInView="shown"
                viewport={view}
              >
                <motion.span
                  className="tb-hiw-num ed-display ed-outline text-[5rem] md:text-[8rem] leading-none"
                  variants={{ hidden: { y: "105%", rotate: 6 }, shown: { y: "0%", rotate: 0 } }}
                  transition={{ duration: 1, ease: EASE, delay: 0.1 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </motion.span>
              </motion.span>
              <div className="md:pt-6">
                <motion.h3
                  className="tb-hiw-title ed-display text-4xl md:text-6xl"
                  style={{ textTransform: "none", letterSpacing: "-0.025em" }}
                  initial={{ opacity: 0, x: 48, filter: "blur(8px)" }}
                  whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  viewport={view}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
                >
                  <span className="tb-hiw-fill">{s.t}</span>
                </motion.h3>
                <motion.span
                  aria-hidden
                  className="tb-hiw-bar"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={view}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
                />
                <motion.p
                  className="tb-hiw-desc mt-4 max-w-md text-lg"
                  style={{ color: "var(--muted)" }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={view}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
                >
                  {s.d}
                </motion.p>
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}


/* ===== Section 05 — Pricing and teams =================================== */

function TeamsOffer() {
  const [seats, setSeats] = useState(3);
  const step = (d: number) => setSeats((n) => Math.min(200, Math.max(1, n + d)));
  return (
    <>
      <div>
        <span className="ed-label ed-accent">For teams</span>
        <h3
          className="ed-display text-3xl md:text-4xl mt-3"
          style={{ textTransform: "none", letterSpacing: "-0.02em" }}
        >
          COMPANY OR DISPATCH TEAM?
        </h3>
        <p className="mt-3 max-w-lg text-lg" style={{ color: "var(--muted)" }}>
          $7 per seat per month. One bill, a manager back office with team stats, add or remove
          seats any time.
        </p>
      </div>
      <div className="flex flex-col gap-4 md:items-end">
        <div className="flex items-center gap-3">
          <button type="button" className="tb-seat-step" aria-label="Fewer seats" onClick={() => step(-1)}>
            −
          </button>
          <span className="ed-display text-2xl" style={{ minWidth: 110, textAlign: "center" }}>
            {seats} seat{seats === 1 ? "" : "s"}
          </span>
          <button type="button" className="tb-seat-step" aria-label="More seats" onClick={() => step(1)}>
            +
          </button>
          <span className="ed-label" style={{ color: "var(--ink)", fontWeight: 700 }}>
            = ${seats * 7}/mo
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="ed-btn ed-btn-accent shrink-0" to="/business/start">
            <span>Start a team</span> <ArrowUpRight className="h-4 w-4" />
          </Link>
          <a className="ed-btn shrink-0" href="#contact">
            <span>Contact us</span>
          </a>
        </div>
      </div>
    </>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="ed-section">
      <div className="ed-container">
        <div className="mb-14">
          <span className="ed-label">[ 05 ] — Pricing</span>
          <h2 className="ed-h2 mt-4">Simple subscription</h2>
          <p className="mt-4 text-lg" style={{ color: "var(--muted)" }}>
            One plan, <b style={{ color: "var(--ink)" }}>$7 a month</b> — no tiers to compare,
            nothing locked behind a bigger one.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-center">
          <Reveal>
            <div className="tb-price-row flex items-start gap-4">
              <span className="tb-price ed-display text-[8rem] md:text-[12rem] leading-[0.8]" aria-label="$7">
                <span className="tb-price-cur ed-accent" aria-hidden>$</span>
                <span className="tb-price-num ed-accent" aria-hidden>7</span>
              </span>
              <span className="ed-label mt-6">/ per user<br />month</span>
            </div>
            <div className="tb-plan-cta mt-7">
            <div className="tb-trial">
              <div className="tb-trial-item">
                <b>7 days</b>
                <span>free trial</span>
              </div>
              <div className="tb-trial-item">
                <b>No card</b>
                <span>to start</span>
              </div>
              <div className="tb-trial-item">
                <b>1 click</b>
                <span>to cancel</span>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="ed-btn ed-btn-accent" href={INSTALL_URL} target="_blank" rel="noreferrer">
                <span>Start Free Trial</span> <ArrowUpRight className="h-4 w-4" />
              </a>
              <Link className="ed-btn" to="/demo">
                <span>Try before you buy</span>
              </Link>
            </div>
            </div>
            <p className="mt-6 ed-label" style={{ letterSpacing: "0.14em" }}>
              We only send email, we never read your inbox.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="min-w-0">
            <div className="tb-incl">
              <span className="tb-incl-num">
                <CountUp to={PLAN_FEATURE_COUNT} />
              </span>
              <span className="tb-incl-cap">features included</span>
              <p>
                <b>Every one of them, for everyone.</b> No hidden fees, no paid add-ons, no premium
                tier — the $7 plan is the only plan.
              </p>
              <a className="ed-btn" href="#features">
                <span>See what you get</span>
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div
            className="mt-16 md:mt-20 flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
            style={{ borderTop: "1px solid var(--line)", paddingTop: 40 }}
          >
            <TeamsOffer />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ===== Section 06 — Walkthrough ========================================= */

function Walkthrough() {
  const [playing, setPlaying] = useState(false);
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
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                  >
                    <Play className="h-5 w-5" fill="currentColor" />
                    <span className="ed-label" style={{ color: "var(--on-accent)" }}>Play walkthrough</span>
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

const FAQ_CATEGORIES = [
  { id: "start", label: "Getting started", note: "Install, sign in, updates" },
  { id: "email", label: "Email & templates", note: "Mailboxes, senders, placeholders" },
  { id: "auto", label: "Auto Emailer", note: "Watched searches, tabs, limits" },
  { id: "board", label: "On the load board", note: "Truckstop, shortcuts, credit checks" },
  { id: "office", label: "Back office", note: "Mailboxes, logins, seats, reports" },
  { id: "billing", label: "Plans & billing", note: "Price, trial, teams, cancelling" },
  { id: "account", label: "Account & privacy", note: "Logins, permissions, safety" },
  { id: "help", label: "Troubleshooting", note: "When something stops working" },
];

const FAQS = [
  {
    q: "How do I get started?",
    cat: "start",
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
    cat: "start",
    a: (
      <p>
        Chrome usually updates extensions automatically. You can also open{" "}
        <strong>chrome://extensions</strong>, enable Developer Mode, and press{" "}
        <strong>Update</strong> to refresh manually.{" "}
        <Link
          to="/guide"
          className="ed-accent"
          style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          See the Guide →
        </Link>
      </p>
    ),
  },
  {
    q: "Does Truck Box work with Outlook?",
    cat: "email",
    a: (
      <p>
        Yes. Click <strong>Sign in with Microsoft</strong> in the extension popup and Truck Box
        sends from your Outlook — personal <strong>Outlook.com / Hotmail</strong> accounts and{" "}
        <strong>Microsoft 365</strong> work mailboxes both work. Gmail and Google Workspace are
        supported the same way through <strong>Sign in with Google</strong>.
      </p>
    ),
  },
  {
    q: "Can I send from more than one email address?",
    cat: "office",
    a: (
      <p>
        Yes. Open the{" "}
        <Link to="/business" className="ed-accent" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
          back office
        </Link>{" "}
        → <strong>Mailboxes</strong> and connect extra Gmail or Outlook addresses (up to 3 on top of
        the one you sign in with). Handy if you dispatch for several carriers: each address gets its
        own template, name and MC.
      </p>
    ),
  },
  {
    q: "How do I choose which address an email is sent from?",
    cat: "email",
    a: (
      <p>
        Every template is tied to one sender. In the extension popup open <strong>Template</strong>,
        pick the address under <strong>Send from</strong> and save. On DAT or Truckstop, the arrow
        next to the email button lets you switch templates — and with it the sender — for that load.
      </p>
    ),
  },
  {
    q: "Can I log in with both Google and Microsoft?",
    cat: "office",
    a: (
      <p>
        Yes. In the{" "}
        <Link to="/business" className="ed-accent" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
          back office
        </Link>{" "}
        → <strong>Accounts</strong> you can link your Google and Microsoft logins to the same Truck Box
        account, so either one signs you in to the same subscription, templates and mailboxes.
      </p>
    ),
  },
  {
    q: "What can I do in the back office?",
    cat: "office",
    a: (
      <div>
        <p>
          The{" "}
          <Link to="/business" className="ed-accent" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
            back office
          </Link>{" "}
          opens with the same login you use in the extension. Under <strong>Settings</strong> you
          manage <strong>Mailboxes</strong> (the Gmail and Outlook addresses you send from),{" "}
          <strong>Accounts</strong> (your Google and Microsoft logins) and{" "}
          <strong>Company info</strong> (the name, MC and phone that fill your templates).{" "}
          <strong>Overview</strong> shows your own numbers — emails sent, sent automatically, maps
          opened, calls placed and the time they saved you.
        </p>
        <p>
          If you run a team, a <strong>Management</strong> section appears on top with{" "}
          <strong>Team</strong> (people, invites and seats) and <strong>Statistics</strong> (the
          same numbers per dispatcher, plus a PDF report).
        </p>
      </div>
    ),
  },
  {
    q: "How do I invite a dispatcher and add seats?",
    cat: "office",
    a: (
      <p>
        Open the back office → <strong>Team</strong>, type the dispatcher's email and send the
        invite; they get a link and sign in with their own Google or Microsoft account. Each person
        with extension access takes one seat at $7/month. If you invite someone with no free seat
        left, Truck Box shows what the extra seat costs for the rest of the month and adds it on
        confirmation. The stepper next to <strong>Seats used</strong> adds or removes seats — you
        can't drop below the number of people who currently have access, so remove their access
        first. Dispatchers who already pay for Truck Box themselves keep their plan until its paid
        period ends, so nobody pays twice.
      </p>
    ),
  },
  {
    q: "How do I get a report on my team?",
    cat: "office",
    a: (
      <div>
        <p>
          Back office → <strong>Statistics</strong> shows the whole team and each dispatcher: total
          emails, how many of them Auto Emailer sent, maps opened, calls placed and the time saved.
          The <strong>Download PDF report</strong> button at the top turns the same numbers into a
          one-file report you can keep or forward.
        </p>
        <p>
          On top of that, Truck Box emails a weekly summary every Monday — a personal one to each
          dispatcher, and a team one to the manager.
        </p>
      </div>
    ),
  },
  {
    q: "How does Auto Emailer work?",
    cat: "auto",
    a: (
      <p>
        Open a DAT <strong>Search Loads</strong> tab, set the search you want to work, then open the{" "}
        <strong>Auto Emailer</strong> panel and set your limits — minimum rate, rate per mile,
        deadhead, weight and trip length. Press <strong>Start</strong> and Truck Box watches that
        board, refreshes it on the interval you pick and emails the broker the moment a load matches.
        Every send lands in the panel log, and you can stop it at any time.
      </p>
    ),
  },
  {
    q: "Do I need more than one browser tab for Auto Emailer?",
    cat: "auto",
    a: (
      <div>
        <p>
          Yes, if you want to cover more than one lane. <strong>One browser tab watches one
          search.</strong> To run a second corridor at the same time, open DAT in another browser
          tab, set that search up there and press <strong>Start</strong> again — the panel has an{" "}
          <strong>Open another DAT tab</strong> button for exactly this. Two searches sharing a
          single tab take turns instead of running together.
        </p>
        <p>
          Leave the watching tab alone while it runs. Scrolling, clicking rows or opening load
          details pauses the board refresh, so Truck Box stops seeing fresh postings. Keep a second
          DAT tab open for your own searching and let the Auto Emailer tab sit untouched in the
          background.
        </p>
      </div>
    ),
  },
  {
    q: "Does it work on Truckstop too?",
    cat: "board",
    a: (
      <p>
        Yes. Truck Box works on both <strong>DAT One</strong> and <strong>Truckstop</strong> — one-click
        email, route map, FMCSA and factoring credit checks are on both boards, with the same
        templates and settings.
      </p>
    ),
  },
  {
    q: "Does Truck Box read my email? Is it safe?",
    cat: "account",
    a: (
      <p>
        No, it can't read your email. Truck Box asks Google and Microsoft only for permission to{" "}
        <strong>send</strong> email — it has no access to open, read or delete anything in your
        inbox. It never sees your email, DAT or Truckstop passwords, and you can revoke access any
        time in your Google or Microsoft account settings.
      </p>
    ),
  },
  {
    q: "What does Truck Box store about me?",
    cat: "account",
    a: (
      <p>
        Your account email and name, the mailboxes you connect (address, provider and the token
        needed to send from them) and counters of what you used — emails sent, maps opened, calls
        placed — which is what your stats and your manager's team report are built from. Templates,
        your MC, phone and filter preferences live in the extension in your browser. No passwords,
        no inbox content, no load board credentials. The full text is on the{" "}
        <Link to="/privacy" className="ed-accent" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
          privacy page
        </Link>
        .
      </p>
    ),
  },
  {
    q: "What does it cost? Are there any add-ons?",
    cat: "billing",
    a: (
      <p>
        $7 per user per month after a free 7-day trial (no credit card needed). Every feature is
        included — no hidden fees, no paid add-ons, no premium tier. Cancel anytime in one click.
      </p>
    ),
  },
  {
    q: "Do you have a plan for dispatch companies?",
    cat: "billing",
    a: (
      <p>
        Yes — $7 per seat per month on one bill, with a manager back office for seats, invites and
        team stats. Set it up yourself in a couple of minutes on the{" "}
        <Link to="/business/start" className="ed-accent" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
          team signup page
        </Link>
        . Dispatchers who already pay for Truck Box just accept the invite; their personal plan ends
        with its paid period, so nobody pays twice.
      </p>
    ),
  },
  {
    q: "Why can't I send from my Outlook address?",
    cat: "email",
    a: (
      <p>
        Usually the Microsoft account has no Outlook mailbox behind it — for example a work account
        without an Exchange license, or a personal Microsoft account made with a Gmail address. Sign
        in with an account that has an Outlook inbox (you can open it at outlook.com), or ask your IT
        admin to enable a mailbox. If a mailbox shows <strong>Disconnected</strong>, press{" "}
        <strong>Reconnect</strong> in Mailboxes.
      </p>
    ),
  },
  {
    q: "How do I subscribe?",
    cat: "billing",
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
    cat: "billing",
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
    cat: "email",
    a: (
      <p>
        Open the Truck Box extension popup, go to the <strong>Template</strong> tab,
        and update your subject or body. Save the template, and Truck Box will use it for
        future emails.
      </p>
    ),
  },
  {
    q: "Can I use placeholders in the template?",
    cat: "email",
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
    cat: "board",
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
    q: "How do I set up factoring credit checks (RTS, Apex, Triumph)?",
    cat: "board",
    a: (
        <p>
          Open the TruckBox extension, go to the <strong>Factoring</strong> tab, select your provider
          — <strong>RTS</strong>, <strong>Apex Capital</strong> or <strong>Triumph</strong> — and click <strong>Login</strong>.
          After signing in to your factoring account, you'll be able to check broker credit directly from the DAT load board.
        </p>
    ),
  },
  {
    q: "Can I use credit checks if I don't factor with RTS, Apex or Triumph?",
    cat: "board",
    a: (
        <p>
          No. To use this feature, you must already have an active account with RTS Financial,
          Apex Capital or Triumph. If you're not set up with one of them, you'll need to contact them first.
        </p>
    ),
  },
  {
    q: "Something isn't working — what should I try first?",
    cat: "help",
    a: (
      <div>
        <p>Before anything else, run these three quick fixes in order:</p>
        <ol>
          <li>
            <strong>Update the extension</strong> if you haven't yet — open{" "}
            <strong>chrome://extensions</strong>, turn on Developer Mode, and press{" "}
            <strong>Update</strong> (see the <Link to="/guide" className="ed-accent" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Guide</Link>).
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
    cat: "help",
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
    cat: "help",
    a: (
      <p>
        Use the chat button in the corner of this page to message us directly — it's
        the fastest way to reach support.
      </p>
    ),
  },
  {
    q: "I'm logged in but get an error when sending email. How do I fix it?",
    cat: "help",
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

/* ===== Section 07 — FAQ ================================================= */

export function FAQ({ lead = false }: { lead?: boolean }) {
  // On /faq this section is the page, so its heading is the h1; on the landing it stays an h2
  // under the hero's h1. Same class either way — the tag changes, the look does not.
  const Heading = lead ? "h1" : "h2";
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const openCategory = (id: string) => {
    setActiveCat(id);
    setOpenIdx(0);
  };

  return (
    <section id="faq" className="ed-section">
      <div className="ed-container">
        <div className="mb-12">
          <span className="ed-label">[ 07 ] — FAQ</span>
          <Heading className="ed-h2 mt-4">Common questions</Heading>
        </div>

        <div className="tb-faq-body">
          <div className="tb-faq-cats tb-faq-fade" style={{ display: activeCat ? "none" : undefined }}>
          {FAQ_CATEGORIES.map((c, i) => {
            const count = FAQS.filter((f) => f.cat === c.id).length;
            return (
              <button key={c.id} type="button" className="tb-faq-cat" onClick={() => openCategory(c.id)}>
                <span className="ed-label ed-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="tb-faq-cat-name">{c.label}</span>
                <span className="tb-faq-cat-note">{c.note}</span>
                <span className="tb-faq-cat-foot">
                  <span>{count} {count === 1 ? "question" : "questions"}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>

        {FAQ_CATEGORIES.map((c) => {
          const on = activeCat === c.id;
          const items = FAQS.filter((f) => f.cat === c.id);
          return (
            <div key={c.id} className="tb-faq-fade" style={{ display: on ? undefined : "none" }}>
              <div className="tb-faq-bar">
                <button type="button" className="tb-faq-back" onClick={() => setActiveCat(null)}>
                  <ArrowUpRight className="h-4 w-4" />
                  <span>All topics</span>
                </button>
                <span className="tb-faq-bar-name">{c.label}</span>
              </div>

              <div>
                {items.map((f, i) => {
                  const isOpen = on && openIdx === i;
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
          );
        })}
        </div>

        <div className="tb-faq-ask">
          <div>
            <span className="ed-label ed-accent">Still have a question?</span>
            <p>Write to us directly — we answer the same day, usually within minutes.</p>
          </div>
          <div className="tb-faq-ask-links">
            <a className="tb-faq-ask-link" href="https://t.me/mngartur" target="_blank" rel="noreferrer">
              <span className="tb-faq-ask-k">Telegram</span>
              <span className="tb-faq-ask-v">@mngartur</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a className="tb-faq-ask-link" href="mailto:info@truckbox.app">
              <span className="tb-faq-ask-k">Email</span>
              <span className="tb-faq-ask-v">info@truckbox.app</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Privacy page ===================================================== */

export function Privacy({ lead = false }: { lead?: boolean }) {
  const Heading = lead ? "h1" : "h2";
  return (
    <section id="privacy" className="tb-section" style={{ paddingTop: 150 }}>
      <div className="tb-container">
        <Reveal>
          <div className="max-w-2xl">
            <Heading className="ed-display mt-6 text-5xl md:text-7xl" style={{ textTransform: "none" }}>
              Privacy Policy &amp; Terms
            </Heading>
            <p className="mt-2 ed-label">Last updated — September 19, 2026</p>
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
                clicks to send it. Truck Box does <b>not</b> read the user's Gmail or Outlook inbox,
                read messages, read attachments, or scan mailbox content. It reads load information
                only from the load board page the user is looking at, inside the user's own
                logged-in session.
              </div>

              <h3>Information we collect</h3>
              <ul>
                <li><b>Local extension settings.</b> Truck Box may store user-entered settings locally in the browser, such as name, MC number, phone number, templates, filter preferences, and extension settings.</li>
                <li><b>Load board information already visible to you.</b> On supported load board pages (DAT and Truckstop), Truck Box reads load details that are <b>already displayed on the page you are actively viewing</b>, such as broker email address, broker phone, origin, destination, pickup date, equipment, trip length, posted rate, and similar load details. This information is used to help compose the message you want to send and to power Truck Box's market features (see "Load market data &amp; analytics" below).</li>
                <li><b>Basic Google or Microsoft account information.</b> During sign-in, Google or Microsoft may provide basic profile information such as account email, profile identifier, and display name for authentication and account access purposes.</li>
                <li><b>OAuth tokens.</b> Truck Box uses Google and Microsoft OAuth tokens only to authenticate approved API requests related to sign-in and sending user-requested emails from the mailboxes the user connects.</li>
                <li><b>Connected mailboxes.</b> If you connect additional Gmail or Outlook mailboxes, we store the mailbox address, provider, connection status, and the tokens needed to send the emails you request from it.</li>
                <li><b>Team information.</b> If you use Truck Box through a company (team) plan, we process the company name, MC number, seat and member emails, invitation status, and usage statistics that are shown to the team's owner and managers.</li>
                <li><b>Account or subscription information.</b> If Truck Box uses a backend for account status, subscription verification, abuse prevention, support, or product security, limited account-level information may be processed for those purposes.</li>
              </ul>

              <h3>The public demo at truckbox.app/demo</h3>
              <p>
                The demo is open to anyone, with no sign-up. Because it is public, we keep a server
                log of the traffic it receives so we can see how it is used and protect it from
                abuse.
              </p>
              <ul>
                <li><b>What is logged.</b> The IP address the request came from, the browser's user agent, screen and window size, language, time zone, the page address and the referring page, and which demo actions were used (opened the demo, signed into the demo account, sent a demo email, saved a demo load). A random identifier is stored in the browser so repeat visits from the same browser can be counted.</li>
                <li><b>What is not logged.</b> No real name, no real email address, no account and no payment data — the demo has none of these. We do not use canvas, audio or other device fingerprinting, and we do not track you across other websites.</li>
                <li><b>Why.</b> To understand how the demo performs, to size the product, and to identify automated abuse of a page that anyone can open.</li>
                <li><b>What we do with it.</b> We review the log by hand. Where the traffic is a scanner or a scripted client, we may look up the network name the address belongs to and block that address or its network from the demo. No decision about a Truck Box account is made from these logs.</li>
                <li><b>Retention.</b> Demo traffic logs are deleted automatically after 180 days.</li>
                <li><b>Not tied to your account.</b> These logs are not linked to a Truck Box account, and they are not sold, shared or used for advertising.</li>
              </ul>

              <h3>Website analytics and support chat</h3>
              <p>
                Two third-party services run on truckbox.app itself — not in the extension, and not
                inside your mailbox or load board.
              </p>
              <ul>
                <li><b>Google Analytics.</b> Measures page views and where visitors arrive from, so we can tell which pages are worth keeping. It sets its own cookies and receives your IP address and user agent. It is not used for advertising, and we do not build profiles or remarketing audiences from it.</li>
                <li><b>Crisp.</b> Runs the chat bubble on the site. It stores an identifier for your chat session so a conversation survives a page reload, and it receives whatever you type into the chat.</li>
                <li><b>Turning them off.</b> Browser settings, tracking protection and content blockers all stop both, and the site keeps working without them. The public demo, the extension and the cabinet do not depend on either.</li>
              </ul>

              <h3>Information we do not collect from your mailbox</h3>
              <ul>
                <li>We do <b>not</b> collect or store Gmail or Outlook inbox messages.</li>
                <li>We do <b>not</b> read the content of your email conversations.</li>
                <li>We do <b>not</b> access email attachments, contacts, or calendars.</li>
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
                <li><b>Only your own session and your own results.</b> Truck Box runs inside your browser, in the load board session you signed in to yourself, and sees only the search results and loads that the load board chooses to show to your account under your own subscription. It never signs in on your behalf, never asks for or stores your DAT or Truckstop password, and never accesses another user's account or data.</li>
                <li><b>No access beyond your permissions.</b> Truck Box cannot see anything your load board account is not already permitted to see, and it does not unlock, bypass, or expand any limits, filters, or paid features of the load board.</li>
                <li><b>No crawlers, scrapers, or background scanners.</b> Truck Box does not use automated crawlers, scrapers, scanners, or bots. It does not browse the load board on its own, query hidden or undocumented endpoints, or harvest data in the background. It only reads what is already on the page in front of you.</li>
                <li><b>Aggregate insight, not surveillance.</b> This information is used to build aggregate market intelligence (such as lane rates, posting frequency, and price trends). It is not used to read your email, to build a profile about you, or to serve advertising, and insights shown to other users do not identify you.</li>
                <li><b>No resale of load board data.</b> We do not sell, publish, or redistribute raw load board listings.</li>
                <li><b>Retention.</b> Raw captured data is retained only as long as reasonably needed to build and maintain these insights, and is purged on a rolling basis.</li>
                <li><b>Your load board account.</b> You are responsible for using Truck Box in a way that is consistent with your own load board subscription and that platform's terms.</li>
              </ul>

              <h3>How we use information</h3>
              <ul>
                <li><b>To send emails the user explicitly requests.</b> Truck Box uses the Gmail API or Microsoft Graph only to send an email when the user chooses to send that email.</li>
                <li><b>To run your account.</b> Sign-in, subscriptions and billing, team seats, support, and preventing fraud and abuse of the service.</li>
                <li><b>To compose and populate email content.</b> Supported page data and saved templates are used only to help prepare the draft content and recipient details the user is sending.</li>
                <li><b>To authenticate users.</b> Basic Google account information may be used to authenticate the user and confirm authorized access.</li>
                <li><b>To provide account, subscription, and security functionality.</b> Limited backend processing may be used for subscription checks, fraud prevention, abuse prevention, operational reliability, and customer support.</li>
                <li><b>To provide market and analytics features.</b> Load details already visible to you on the load board are used to build the aggregate market insights described in "Load market data &amp; analytics" above.</li>
                <li><b>No advertising use.</b> We do not use Google user data or Gmail-related data for advertising, remarketing, profiling, or personalized ads.</li>
                <li><b>No generalized AI training.</b> We do not use Google or Microsoft user data, mailbox data, or email content to train generalized artificial intelligence or machine learning models.</li>
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

              <h3>Microsoft (Outlook) permissions</h3>
              <p>If you sign in with Microsoft or connect an Outlook mailbox, Truck Box requests only:</p>
              <ul>
                <li><code>Mail.Send</code> — used only to send emails the user explicitly chooses to send.</li>
                <li><code>User.Read</code>, <code>openid</code>, <code>email</code>, <code>profile</code> — used for sign-in and to identify the signed-in account.</li>
                <li><code>offline_access</code> — lets a connected mailbox keep sending without asking you to sign in again each time.</li>
              </ul>
              <div className="tb-note">
                <b>Truck Box does not request Outlook read access.</b> It cannot read, search, move,
                or delete messages in your mailbox. You can remove its access at{" "}
                <a href="https://account.live.com/consent/Manage" target="_blank" rel="noreferrer">account.live.com/consent/Manage</a>{" "}
                (personal accounts) or through your organization's Microsoft 365 administrator.
              </div>

              <h3>Third-party factoring connections (RTS Pro, Apex Capital, Triumph)</h3>
              <p>
                Truck Box includes an optional feature that displays a broker's factoring
                credit rating using your own factoring provider account (RTS Pro, Apex Capital or Triumph).
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
                <li><b>No sale of personal data.</b> We do not sell personal information, Google or Microsoft user data, or mailbox data.</li>
                <li><b>Service providers.</b> We use trusted providers to run the service — for example hosting, payments (Stripe), SMS phone verification, email delivery, and customer chat. They process data only on our behalf and only as needed to provide their service.</li>
                <li><b>Legal requests.</b> We may disclose information if required by law, subpoena, or court order, or when reasonably necessary to investigate fraud, abuse, or violations of our Terms, or to protect the rights and safety of our users, third parties, or Truck Box.</li>
                <li><b>No unauthorized sharing.</b> We do not share Google user data except where necessary to provide a user-requested service, for security or legal compliance, or as otherwise permitted by applicable law and Google policy.</li>
                <li><b>Reasonable safeguards.</b> We use reasonable administrative, technical, and organizational measures designed to protect the data relevant to operation of Truck Box and related services.</li>
              </ul>

              <h3>Data deletion &amp; revoking access</h3>
              <ul>
                <li>Users can revoke Google account access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
                <li>Users can remove locally stored extension data by clearing extension storage, resetting the extension, or uninstalling the extension.</li>
                <li>If account, subscription, support, or captured market data associated with your account exists on our backend, you may request access to or deletion of it by contacting us through the contact form on this website (see the "Contact" section). We will respond within a reasonable time and as required by applicable law.</li>
                <li>After Google or Microsoft access is revoked, Truck Box will no longer be able to send emails from that mailbox until the user signs in or reconnects it again.</li>
                <li>We may keep limited records (such as billing records and records of abuse or fraud) where required by law or needed to protect the service.</li>
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
                DAT, Truckstop, RTS / RTS Financial, Apex Capital, Triumph, Google, the FMCSA, or any other platform it
                works alongside. Truck Box does not host, control, or own those services or their
                data — it simply helps you act on information already shown to you in your own
                accounts on those services.
              </p>
              <p>
                All product names, logos, and trademarks — including "DAT," "Truckstop," "RTS," "Apex Capital," "Triumph,"
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
              <p style={{ fontSize: "0.9rem" }}>Last updated: <b>September 19, 2026</b></p>

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

              <h3>Acceptable use</h3>
              <p>
                Truck Box is a productivity tool for legitimate freight dispatching. When using it you
                agree <b>not</b> to:
              </p>
              <ul>
                <li>Use Truck Box for any unlawful purpose or in connection with any illegal activity, including fraud, double brokering, cargo theft, identity theft, or money laundering.</li>
                <li>Impersonate any carrier, broker, company, or person, use an MC/DOT number or company name you are not authorized to use, or send emails containing false or misleading information.</li>
                <li>Send spam, unsolicited bulk email, phishing, malware, or harassing, threatening, or abusive messages.</li>
                <li>Automate Truck Box or the load board with bots, scripts, macros, auto-clickers, or other tools that send emails, open loads, or collect data without a person actively using it.</li>
                <li>Scrape, harvest, copy, export, resell, or redistribute load board data, broker contact details, or Truck Box analytics, or use them to build a competing database or product.</li>
                <li>Use Truck Box with a load board, factoring, or email account that is not yours or that you are not authorized to use, or share your Truck Box account, seat, or login with anyone else.</li>
                <li>Bypass, disable, or interfere with any security feature, usage limit, or access control of Truck Box, a load board, a factoring provider, Google, or Microsoft.</li>
                <li>Reverse engineer, decompile, modify, or tamper with the extension or our servers, or access our APIs other than through the extension and website as provided.</li>
                <li>Overload, disrupt, or attempt unauthorized access to Truck Box or any third-party service, or probe, scan, or test their vulnerabilities without our written permission.</li>
                <li>Violate the terms of service of DAT, Truckstop, your factoring provider, Google, Microsoft, or any other platform you use with Truck Box.</li>
              </ul>
              <p>
                We may monitor usage patterns (such as unusual sending volume or automated activity)
                to detect abuse. If we believe you have broken these rules, we may warn you, limit
                features, or suspend or terminate your account immediately and without refund, and
                we may report illegal activity to the relevant authorities and cooperate with law
                enforcement.
              </p>

              <h3>Your account</h3>
              <ul>
                <li>You must be at least 18 years old and able to enter into a binding contract, and the information you give us (including your company name, MC number, and phone number) must be accurate.</li>
                <li>Each subscription or team seat is for one person. You are responsible for keeping your login secure and for all activity under your account.</li>
                <li>If you use Truck Box through a company plan, the company that manages the team is responsible for the people it invites and for their use of the service, and its owner and managers can see team usage statistics.</li>
                <li>Tell us promptly if you believe your account has been used without your permission.</li>
              </ul>

              <h3>Load board data</h3>
              <p>
                Load listings and related information belong to the load board and the parties who
                posted them. Truck Box only reads what your own load board account already shows you,
                in your own browser, to help you act on it. Truck Box does not grant you any right to
                that data beyond what your load board subscription allows, and you remain responsible
                for how you use it.
              </p>

              <h3>No guarantee of results</h3>
              <p>
                Truck Box helps you work faster, but we do not guarantee that you will book any load,
                receive replies from brokers, or earn any particular amount. Load boards, email
                providers, and factoring providers can change their websites or services at any time,
                which may temporarily or permanently affect some features.
              </p>

              <h3>Google and Microsoft account access</h3>
              <p>
                By connecting your Google or Microsoft account, you authorize Truck Box to use the
                approved permissions described on this page solely for the limited purposes described
                in this Privacy Policy. Truck Box does not use that access to read inbox content.
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
                You may stop using Truck Box at any time by cancelling your subscription,
                uninstalling the extension, and revoking Google or Microsoft access. We may suspend or terminate access if reasonably necessary to
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

              <h3>Entire agreement &amp; assignment</h3>
              <p>
                These Terms, together with the Privacy Policy and any terms shown at checkout, are the
                entire agreement between you and TruckBox LLC about Truck Box. You may not transfer your
                account or these Terms without our consent; we may assign them in connection with a
                merger, acquisition, or sale of assets.
              </p>

              <h3>Events beyond our control</h3>
              <p>
                We are not responsible for delays or failures caused by events outside our reasonable
                control, including outages or changes of third-party services (load boards, Google,
                Microsoft, payment or hosting providers), internet failures, or acts of government.
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

/* ===== Guide and update pages =========================================== */

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

const PHASE_ORDER: Phase[] = ["Set up", "Connect", "Send"];

function JourneyMap() {
  const steps = GUIDE_STEPS.map((s, i) => ({ ...s, n: i + 1 }));
  return (
    <Reveal delay={0.05}>
      <div className="tb-rail">
        <div className="tb-rail-inner">
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
            <Link to="/update" className="ed-btn mt-6 inline-flex items-center gap-2">
              <RotateCw className="h-4 w-4" aria-hidden />
              <span>Already installed? How to update version</span>
            </Link>
          </div>
        </Reveal>

        <div className="mt-12 md:mt-16">
          <JourneyMap />
        </div>

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

function CopyChromeUrl({ url = "chrome://extensions" }: { url?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };
  return (
    <>
      <button type="button" className="tb-copy-url" onClick={copy} title="Copy address">
        <b>{url}</b>
      </button>
      {copied && <span className="tb-copy-url-hint"> Copied — paste it in the address bar</span>}
    </>
  );
}

export function UpdateGuide() {
  return (
    <section id="update" className="ed-section" style={{ paddingTop: 150 }}>
      <div className="ed-container">
        <Reveal delay={0.2}>
          <div className="max-w-3xl">
            <span className="ed-label">[ Update ] — Already installed?</span>
            <h1 className="ed-h2 mt-4">
              How to update <span className="ed-accent" style={{ fontStyle: "italic" }}>version.</span>
            </h1>
            <p className="mt-6 text-lg" style={{ color: "var(--muted)", lineHeight: 1.65 }}>
              Chrome updates Truck Box on its own, but that can take a few hours. When we ship a
              fix, you can grab it right away:
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="mt-10">
          <ol className="tb-update-steps">
            <li>
              Open <CopyChromeUrl /> in the address bar.
            </li>
            <li>Turn on <b>Developer mode</b> (top right).</li>
            <li>Click <b>Update</b> (top left).</li>
            <li>Check the version on the Truck Box card, then refresh the DAT page.</li>
          </ol>
          <div className="tb-note tb-note--calm mt-6">
            You can turn Developer mode off again afterwards — it’s only needed for the Update button.
          </div>
          <div className="tb-step-shots">
            <GuideShot src="/guide/09-update-version.webp" alt="chrome://extensions — Developer mode (1) and Update (2)" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ===== Section 08 — Contact, final CTA, footer ========================== */

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
              {NAV.map((n) => {
                const cls =
                    "ed-label hover:text-[color:var(--ink)] transition-colors" +
                    (n.desktopOnly ? " hidden lg:inline" : "");
                return n.route ? (
                    <Link key={n.href} to={n.href} className={cls}>
                      {n.label}
                    </Link>
                ) : (
                    <a key={n.href} href={n.href} className={cls}>
                      {n.label}
                    </a>
                );
              })}
              <Link
                to="/dat-load-board-tools"
                className="ed-label hover:text-[color:var(--ink)] transition-colors"
              >
                Load board tools
              </Link>
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