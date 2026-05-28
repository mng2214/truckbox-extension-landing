import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  ArrowRight,
  Check,
  ChevronDown,
  Mail,
  Keyboard,
  LayoutTemplate,
  Filter,
  MapPin,
  BarChart3,
  Play,
  Send,
  Instagram,
  Facebook,
} from "lucide-react";

type NavItem = { href: string; label: string; route?: boolean };

const NAV: NavItem[] = [
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

export { NAV, INSTALL_URL, CALENDLY_URL, TELEGRAM_URL };


export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <div className="tb-bg-grid" />
      <div className="tb-bg-blobs" aria-hidden />
      <Header />
      <main>
        <Hero />
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

export function Header() {

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: scrolled ? "1px solid var(--hairline)" : "1px solid transparent",
      }}
    >
      <div className="tb-container flex items-center justify-between" style={{ minHeight: 64 }}>
        <a href="#top" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--gradient)" }}
            aria-hidden
          >
            <Send className="h-4 w-4" />
          </span>
          <span>Truck Box</span>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) =>
            n.route ? (
              <Link
                key={n.href}
                to={n.href}
                className="nav-link px-3 py-2 rounded-full text-sm font-medium"
              >
                {n.label}
              </Link>
            ) : (
              <a
                key={n.href}
                href={n.href}
                className="nav-link px-3 py-2 rounded-full text-sm font-medium"
              >
                {n.label}
              </a>
            )
          )}

        </nav>

        <div className="hidden md:flex items-center gap-2">
          <a className="tb-btn tb-btn-primary text-sm" href={INSTALL_URL} target="_blank" rel="noreferrer">
            Install <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="tb-section" style={{ paddingTop: 140 }}>
      <div className="tb-container text-center">

        <Reveal delay={0.05}>
          <h1
            className="mx-auto mt-6 max-w-4xl font-extrabold tracking-tight"
            style={{
              fontSize: "clamp(2.4rem, 6vw, 4.4rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            A cleaner & faster way to send broker emails from{" "}
            <span className="tb-grad-text">one.dat.com</span>.
          </h1>
        </Reveal>

        <Reveal delay={0.12}>
          <p
            className="mx-auto mt-6 max-w-2xl text-lg"
            style={{ color: "var(--muted)", lineHeight: 1.6 }}
          >
            Truck Box adds one-click outreach, saved templates, load filtering, route context, and
            lightweight stats so your DAT workflow feels simpler, sharper, and faster every day.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a className="tb-btn tb-btn-primary" href={INSTALL_URL} target="_blank" rel="noreferrer">
              Install Chrome Extension <ArrowRight className="h-4 w-4" />
            </a>
            <a className="tb-btn tb-btn-demo" href={CALENDLY_URL} target="_blank" rel="noreferrer">
              Schedule Free Demo
            </a>
            <a className="tb-btn tb-btn-secondary" href="#learning">
              Watch how it works
            </a>
          </div>
          <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>
            Start with a <strong style={{ color: "var(--ink)" }}>7-day free trial</strong>. No
            credit card required for the trial.
          </p>
        </Reveal>

        <Reveal delay={0.25}>
          <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
            {[
              { k: "1 click", v: "Email sending from DAT rows" },
              { k: "$7/mo", v: "Simple flat subscription" },
              { k: "Minimal setup", v: "Google login and ready templates" },
            ].map((m) => (
              <motion.div
                key={m.k}
                whileHover={{ y: -3 }}
                className="tb-card p-5 text-left"
              >
                <div className="font-extrabold text-xl tb-grad-text">{m.k}</div>
                <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                  {m.v}
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Mail,
      title: "One-click email sending",
      body: "Send professional broker emails directly from supported DAT load rows.",
    },
    {
      icon: Keyboard,
      title: "Keyboard navigation on DAT",
      body: "Move through loads with W/S, switch tabs with A/D, open maps with Q, send emails with E, and toggle details with Space.",
    },
    {
      icon: LayoutTemplate,
      title: "Reusable templates",
      body: "Keep your subject and body ready so outreach stays consistent and fast.",
    },
    {
      icon: Filter,
      title: "Short-load filtering",
      body: "Hide loads under your preferred miles threshold and stay focused on better lanes.",
    },
    {
      icon: MapPin,
      title: "Google Map context",
      body: "Open Google Maps support right from the workflow to evaluate lanes faster.",
    },
    {
      icon: BarChart3,
      title: "Simple activity stats",
      body: "See your total email activity inside the extension without extra dashboards.",
    },
  ];

  return (
    <section id="features" className="tb-section">
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="tb-pill">Features</span>
            <h2
              className="mt-5 font-bold"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Minimal by design. Premium in feel.
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              Everything is focused on helping carriers move faster without turning DAT into a
              cluttered tool.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.04}>
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="tb-card p-6 h-full"
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4"
                  style={{ background: "var(--pri-soft)", color: "var(--pri)" }}
                >
                  <it.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg" style={{ color: "var(--ink)" }}>
                  {it.title}
                </h3>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                  {it.body}
                </p>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", t: "Install the extension", d: "Add Truck Box to Chrome and pin it for quick access." },
    { n: "2", t: "Sign in with Google", d: "Connect your Gmail account and activate the free trial." },
    { n: "3", t: "Work inside DAT", d: "Open DAT, use your templates, filter loads, and send with one click." },
  ];
  return (
    <section className="tb-section" style={{ paddingTop: 0 }}>
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-xl mx-auto">
            <h2 className="font-bold" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.3rem)" }}>
              Start in 3 simple steps
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              Fast onboarding, simple workflow, no heavy training needed.
            </p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.06}>
              <motion.div whileHover={{ y: -4 }} className="tb-card p-6 h-full">
                <div
                  className="text-5xl font-extrabold tb-grad-text leading-none"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  {s.n}
                </div>
                <h3 className="mt-4 font-bold text-lg">{s.t}</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  {s.d}
                </p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

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
    <section id="pricing" className="tb-section">
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="tb-pill">Pricing</span>
            <h2
              className="mt-5 font-bold"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Simple subscription
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              Start with a 7-day free trial, then continue with Truck Box Pro.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 mx-auto max-w-xl">
            <motion.div
              whileHover={{ y: -3 }}
              className="tb-card p-8 text-center relative overflow-hidden"
              style={{ borderColor: "rgba(29,78,216,0.22)" }}
            >
              <div
                aria-hidden
                className="absolute -top-20 -right-20 h-56 w-56 rounded-full"
                style={{ background: "var(--gradient)", opacity: 0.08 }}
              />
              <span className="tb-pill">For active DAT work</span>
              <div className="mt-5 flex items-baseline justify-center gap-1">
                <span
                  className="font-extrabold tb-grad-text"
                  style={{ fontSize: "4rem", letterSpacing: "-0.03em", lineHeight: 1 }}
                >
                  $7
                </span>
                <span style={{ color: "var(--muted)" }}>/ month</span>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Start with the free 1-week trial first. No credit card required. Cancel anytime.
              </p>

              <ul className="mt-6 text-left grid gap-2 mx-auto max-w-sm">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: "var(--pri-soft)", color: "var(--pri)" }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span style={{ color: "var(--ink)" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-2 justify-center">
                <a className="tb-btn tb-btn-primary" href={INSTALL_URL} target="_blank" rel="noreferrer">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </a>
                <a className="tb-btn tb-btn-demo" href={CALENDLY_URL} target="_blank" rel="noreferrer">
                  Book Free Demo
                </a>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Learning() {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`;

  return (
    <section id="learning" className="tb-section">
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="tb-pill">Learning</span>
            <h2
              className="mt-5 font-bold"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Learn how to use Truck Box
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              A short walkthrough of how Truck Box works inside DAT — from login to sending broker
              emails with one click.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 mx-auto max-w-4xl">
            <div
              className="tb-card overflow-hidden relative aspect-video"
              style={{ background: "#0b1e33" }}
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
                    alt="Truck Box walkthrough video preview"
                    className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-95 transition-opacity"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex h-20 w-20 items-center justify-center rounded-full text-white"
                      style={{
                        background: "var(--gradient)",
                        boxShadow: "0 18px 40px rgba(29,78,216,0.45)",
                      }}
                    >
                      <Play className="h-8 w-8 ml-1" fill="currentColor" />
                    </motion.span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { t: "Login and first setup", d: "Google sign-in, extension setup, and first steps." },
              { t: "Template configuration", d: "How to create a clean, reusable message template." },
              { t: "Workflow inside DAT", d: "Real outreach flow from the DAT board." },
            ].map((c, i) => (
              <motion.div
                key={c.t}
                whileHover={{ y: -3 }}
                className="tb-card p-5"
                transition={{ delay: i * 0.05 }}
              >
                <h3 className="font-bold">{c.t}</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  {c.d}
                </p>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "How do I get started?",
    a: (
      <p>
        Install the Truck Box Chrome extension, open the popup, and click{" "}
        <strong>Sign in with Google</strong>. After login, your account is ready and your free
        trial can start.
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
        First log in with Google and start the free 7 days trial. After the trial, you can continue
        with the paid Truck Box subscription from the billing flow on the website or inside the
        app.
      </p>
    ),
  },
  {
    q: "How do I cancel my subscription?",
    a: (
      <p>
        You can cancel anytime from your billing or subscription page. After cancelation, your
        current paid period stays active until it ends, and you will not be charged again.
      </p>
    ),
  },
  {
    q: "How do I edit my email template?",
    a: (
      <p>
        Open the Truck Box extension popup, go to the <strong>Email Template</strong> tab, and
        update your subject or body. Save the template, and Truck Box will use it for future
        emails.
      </p>
    ),
  },
  {
    q: "Can I use placeholders in the template?",
    a: (
      <p>
        Yes. You can use placeholders like <code>{`{{origin}}`}</code>,{" "}
        <code>{`{{destination}}`}</code>, <code>{`{{pickupDate}}`}</code>,{" "}
        <code>{`{{equipment}}`}</code>, <code>{`{{length}}`}</code>, <code>{`{{weight}}`}</code>,{" "}
        <code>{`{{myName}}`}</code>, <code>{`{{myMc}}`}</code>, and <code>{`{{myPhone}}`}</code>.
      </p>
    ),
  },
  {
    q: "How does keyboard navigation work?",
    a: (
      <div>
        <p>
          Truck Box includes keyboard shortcuts that help dispatchers move through DAT loads faster
          without using a mouse.
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
        Usually this happens if the Google session expired, permissions were revoked, or Chrome
        needs to refresh the extension auth state. Try logging out inside the extension, then sign
        in again. If it still does not work, contact support.
      </p>
    ),
  },
  {
    q: "Where do I get help?",
    a: (
      <p>
        For now, the fastest support channel is Telegram. Use the support button on this page to
        message directly.
      </p>
    ),
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="tb-section">
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="tb-pill">FAQ</span>
            <h2
              className="mt-5 font-bold"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Quick answers for common questions
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              Open any question below to see the answer.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 max-w-3xl mx-auto">
          {FAQS.map((f, i) => {
            const isOpen = openIdx === i;
            return (
              <Reveal key={f.q} delay={i * 0.03}>
                <article className="tb-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-5 py-5 text-left"
                  >
                    <span className="font-bold" style={{ color: "var(--ink)" }}>
                      {f.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                      style={{
                        background: isOpen ? "var(--gradient)" : "var(--pri-soft)",
                        color: isOpen ? "#fff" : "var(--pri)",
                      }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div
                          className="tb-prose px-5 pb-5 pt-1"
                          style={{ borderTop: "1px solid var(--hairline)" }}
                        >
                          {f.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Privacy() {
  return (
    <section id="privacy" className="tb-section">
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="tb-pill">Legal</span>
            <h2
              className="mt-5 font-bold"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Privacy Policy &amp; Terms
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              This page explains what Truck Box does, what information it uses, how Google account
              access is handled, and the rules for using the service.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Last updated: <b>March 20, 2026</b>
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 grid gap-6 max-w-3xl mx-auto">
            <article className="tb-card p-6 sm:p-8 tb-prose">
              <h3 style={{ fontSize: "1.4rem", margin: "0 0 12px" }}>Privacy Policy</h3>
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
                <li>Users can revoke Google account access at <a style={{ color: "var(--pri)" }} href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.</li>
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
              <h3 style={{ fontSize: "1.4rem", margin: "0 0 12px" }}>
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
              <h3 style={{ fontSize: "1.4rem", margin: "0 0 12px" }}>Terms &amp; Conditions</h3>
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

function Contact() {
  const channels = [
    {
      label: "Telegram",
      handle: "@mngartur",
      href: TELEGRAM_URL,
      cta: "Fastest reply",
    },
    {
      label: "Book a call",
      handle: "calendly.com/truckboxapp",
      href: CALENDLY_URL,
      cta: "Free 15-min demo",
    },
    {
      label: "Instagram",
      handle: "@truckbox.app",
      href: "https://instagram.com/truckbox.app",
      cta: "Follow updates",
    },
    {
      label: "Facebook",
      handle: "/truckboxapp",
      href: "https://facebook.com/truckboxapp",
      cta: "Community",
    },
  ];

  return (
    <section id="contact" className="tb-section">
      <div className="tb-container">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="tb-pill">Contact</span>
            <h2
              className="mt-5 font-bold"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
            >
              Talk to us
            </h2>
            <p className="mt-3" style={{ color: "var(--muted)" }}>
              Login issues, billing, template setup, or product feedback — we reply fast.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
            {channels.map((c) => (
              <motion.a
                key={c.label}
                whileHover={{ y: -3 }}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="tb-card p-5 flex items-center justify-between gap-4 group"
              >
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    {c.label}
                  </div>
                  <div className="font-bold mt-1" style={{ color: "var(--ink)" }}>
                    {c.handle}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {c.cta}
                  </div>
                </div>
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                  style={{ background: "var(--pri-soft)", color: "var(--pri)" }}
                >
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </motion.a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="tb-section" style={{ paddingTop: 0 }}>
      <div className="tb-container">
        <Reveal>
          <div
            className="rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden"
            style={{ background: "var(--gradient)", color: "#fff" }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.5), transparent 40%)",
              }}
            />
            <div className="relative">
              <h2
                className="font-extrabold"
                style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", letterSpacing: "-0.02em" }}
              >
                Install Truck Box. Make your DAT workflow lighter.
              </h2>
              <p className="mt-3 opacity-90 max-w-xl mx-auto">
                Clean setup, simple pricing, and a more polished daily routine for outreach.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <a
                  className="tb-btn"
                  style={{ background: "#fff", color: "var(--pri)" }}
                  href={INSTALL_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Install Extension <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  className="tb-btn"
                  style={{
                    background: "transparent",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.5)",
                  }}
                  href="#faq"
                >
                  Read FAQ
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--hairline)" }}>
      <div
        className="tb-container py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
        style={{ color: "var(--muted)" }}
      >
        <div>© {new Date().getFullYear()} Truck Box — All rights reserved.</div>
        <div className="flex flex-wrap gap-4 items-center">
          {NAV.map((n) =>
            n.route ? (
              <Link key={n.href} to={n.href} className="hover:text-[color:var(--ink)]">
                {n.label}
              </Link>
            ) : (
              <a key={n.href} href={n.href} className="hover:text-[color:var(--ink)]">
                {n.label}
              </a>
            )
          )}

        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://instagram.com/truckbox.app"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "var(--pri-soft)", color: "var(--pri)" }}
          >
            <Instagram className="h-4 w-4" />
          </a>
          <a
            href="https://facebook.com/truckboxapp"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "var(--pri-soft)", color: "var(--pri)" }}
          >
            <Facebook className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export function TelegramFloat() {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Ask a question on Telegram"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-white font-medium text-sm shadow-lg hover:scale-[1.03] transition-transform"
      style={{
        background: "var(--gradient)",
        boxShadow: "0 14px 30px rgba(29,78,216,0.35)",
      }}
    >
      <Send className="h-4 w-4" />
      <span className="hidden sm:inline">Ask a question</span>
    </a>
  );
}
