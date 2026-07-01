import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Sun, Moon } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { auth } from "../../lib/auth";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import type { AccountContext } from "./types";
import { Bounce } from "./Bounce";
import { PersonalPanel } from "./PersonalPanel";
import { TeamPanel } from "./TeamPanel";
import { StatsPanel } from "./StatsPanel";
import { PhoneVerify } from "./PhoneVerify";

// Oracle (stealth): lazy-loaded so its code is not in the main bundle for non-entitled users.
const DiscoveryPanel = lazy(() =>
  import("./DiscoveryPanel").then((m) => ({ default: m.DiscoveryPanel }))
);

const SUPPORT_TELEGRAM = "https://t.me/mngartur";
const EASE = [0.16, 1, 0.3, 1] as const;

function signOut() {
  auth.clearToken();
  window.location.href = "/";
}

export default function Cabinet() {
  const [ctx, setCtx] = useState<AccountContext | null>(null);
  const [authed, setAuthed] = useState(auth.isAuthed());
  const [section, setSection] = useState("personal");
  const [error, setError] = useState<string | null>(null);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  // Light is the default for the back office; respected as dark only if the user explicitly chose it.
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof localStorage !== "undefined" && localStorage.getItem("tb-theme") === "dark"
      ? "dark"
      : "light",
  );
  const sectionInit = useRef(false);

  const load = useCallback(async () => {
    try {
      const c = await api.get<AccountContext>("/api/v1/account/context");
      setCtx(c);
      setNeedsPhone(false);
      if (!sectionInit.current) {
        setSection(c.panels[0] ?? "personal");
        sectionInit.current = true;
      }
    } catch (e) {
      // A verification-scoped token (unverified phone) is rejected with 403 on every non-phone
      // path — route to the phone-verification step instead of a generic error.
      if (e instanceof ApiError && e.status === 403) {
        setNeedsPhone(true);
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        auth.clearToken();
        setAuthed(false);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  useEffect(() => {
    const w = window as unknown as { $crisp?: unknown[] };
    document.body.classList.add("tb-cabinet-bg");
    w.$crisp?.push(["do", "chat:hide"]);
    return () => {
      document.body.classList.remove("tb-cabinet-bg");
      w.$crisp?.push(["do", "chat:show"]);
    };
  }, []);

  // Light mode is scoped to the cabinet: set data-theme on <html> while mounted,
  // remove it on unmount so the (dark-only) landing is never affected.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    localStorage.setItem("tb-theme", theme);
    return () => root.removeAttribute("data-theme");
  }, [theme]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center">
        <h1 className="ed-display text-[8vw] lg:text-[3.5rem]">Account</h1>
        <p style={{ color: "var(--muted)" }}>Sign in to manage your plan and team.</p>
        <GoogleSignIn onSignedIn={() => setAuthed(true)} />
      </div>
    );
  }
  if (error) return <div className="min-h-screen flex items-center justify-center px-6 text-center">{error}</div>;
  if (needsPhone) return <PhoneVerify onVerified={load} />;
  if (!ctx) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (ctx.verdict === "BOUNCE") {
    // Org owner with an unpaid/lapsed org: let them resume checkout for the existing org.
    const ownerNeedsPayment = ctx.bounceReason === "PAYMENT" && ctx.org?.role === "OWNER";
    const completeOrgPayment = async () => {
      try {
        const { url } = await api.post<{ url: string }>("/api/v1/manager/team/checkout", {
          token: "",
        });
        window.location.href = url;
      } catch {
        setError("Could not start checkout. Please try again.");
      }
    };
    return (
      <Bounce
        reason={ctx.bounceReason ?? "INSTALL"}
        onSignOut={signOut}
        telegram={SUPPORT_TELEGRAM}
        ctaOverride={
          ownerNeedsPayment ? { label: "Complete payment", onClick: completeOrgPayment } : undefined
        }
      />
    );
  }

  const isManager = ctx.panels.includes("team") && !!ctx.org;

  const goto = (s: string) => {
    setSection(s);
    setNavOpen(false);
  };

  const navBody = (
    <>
      <div
        className="mb-7 px-1"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.15rem",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--ink)",
        }}
      >
        Truck<span style={{ color: "var(--accent)" }}>Box</span>
      </div>

      <nav className="flex flex-col gap-1">
        {ctx.panels.includes("personal") && (
          <NavItem label="Overview" active={section === "personal"} onClick={() => goto("personal")} />
        )}
        {isManager && <NavItem label="Team" active={section === "team"} onClick={() => goto("team")} />}
        {isManager && (
          <NavItem label="Statistics" active={section === "statistics"} onClick={() => goto("statistics")} />
        )}
        {ctx.panels.includes("discovery") && (
          <NavItem label="Oracle" active={section === "discovery"} onClick={() => goto("discovery")} />
        )}
      </nav>

      <div
        className="mt-auto flex flex-col items-stretch gap-3 pt-5"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <button
          type="button"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="flex items-center justify-center gap-2"
          style={{
            background: "transparent",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "0.82rem",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            transition: "color .2s var(--ease)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
        >
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
        <div
          style={{
            color: "var(--muted)",
            fontSize: "0.72rem",
            textAlign: "center",
            wordBreak: "break-all",
            lineHeight: 1.3,
          }}
        >
          {ctx.email}
        </div>
        <a
          href={SUPPORT_TELEGRAM}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "var(--muted)",
            fontSize: "0.82rem",
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          Need help?
        </a>
        <button className="ed-btn" style={{ justifyContent: "center", width: "100%" }} onClick={signOut}>
          <span>Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Static desktop sidebar */}
      <aside
        className="tb-aside hidden md:flex w-60 shrink-0 border-r p-5 flex-col gap-1"
        style={{ borderColor: "var(--hairline)", minHeight: "100vh" }}
      >
        {navBody}
      </aside>

      {/* Mobile top bar */}
      <header className="tb-topbar md:hidden">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.05rem",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          Truck<span style={{ color: "var(--accent)" }}>Box</span>
        </span>
        <button
          type="button"
          className="tb-icon-btn"
          aria-label="Open menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile off-canvas drawer */}
      <AnimatePresence>
        {navOpen && (
          <div className="md:hidden">
            <motion.div
              className="tb-drawer-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={() => setNavOpen(false)}
            />
            <motion.aside
              className="tb-aside tb-drawer flex flex-col gap-1 p-5"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.35, ease: EASE }}
              role="dialog"
              aria-modal="true"
              aria-label="Account navigation"
            >
              <button
                type="button"
                className="tb-icon-btn self-end mb-2"
                aria-label="Close menu"
                onClick={() => setNavOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              {navBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0 p-5 sm:p-8 md:p-10">
        {section === "personal" && <PersonalPanel ctx={ctx} />}
        {section === "team" && ctx.org && <TeamPanel onChanged={load} />}
        {section === "statistics" && isManager && <StatsPanel />}
        {section === "discovery" && ctx.panels.includes("discovery") && (
          <Suspense fallback={<div style={{ color: "var(--muted)" }}>Loading…</div>}>
            <DiscoveryPanel />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={"tb-nav" + (active ? " is-active" : "")}>
      {label}
    </button>
  );
}
