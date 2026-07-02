import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Sun, Moon, LogOut, HelpCircle, User } from "lucide-react";
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
// Backend ErrorCode.PHONE_VERIFICATION_REQUIRED — a distinct 403 that means "verify your phone"
// (vs a generic 403/expired token, which means "log in again").
const PHONE_VERIFICATION_REQUIRED = 1023;

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
      // A verification-scoped token (unverified phone) is rejected with a DISTINCT 403 code —
      // route to the phone-verification step. An expired/invalid token gives a generic 401/403
      // (no phone code), so send the user back to log in — NOT to phone verify (which used to show
      // even for already-verified users whose session had simply expired).
      if (e instanceof ApiError && e.status === 403 && e.code === PHONE_VERIFICATION_REQUIRED) {
        setNeedsPhone(true);
        return;
      }
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
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
  if (needsPhone) return <PhoneVerify onVerified={load} onSignOut={signOut} />;
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
        <div className="flex items-center gap-2">
          <AccountMenu
            email={ctx.email}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          />
          <button
            type="button"
            className="tb-icon-btn"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Desktop account menu — floats top-right so it never stretches with the sidebar */}
      <div className="hidden md:block" style={{ position: "fixed", top: "1.1rem", right: "1.6rem", zIndex: 50 }}>
        <AccountMenu
          email={ctx.email}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        />
      </div>

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

function AccountMenu({
  email,
  theme,
  onToggleTheme,
}: {
  email: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in srgb, var(--accent) 16%, transparent)",
          color: "var(--accent)",
          border: "1px solid var(--hairline)",
          cursor: "pointer",
        }}
      >
        <User size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 230,
              zIndex: 70,
              background: "var(--bg-2)",
              border: "1px solid var(--hairline)",
              boxShadow: "0 16px 44px rgba(0, 0, 0, 0.28)",
              padding: "0.4rem",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.6rem 0.55rem",
                fontSize: "0.72rem",
                color: "var(--muted)",
                wordBreak: "break-all",
                lineHeight: 1.35,
                borderBottom: "1px solid var(--hairline)",
                marginBottom: 4,
              }}
            >
              {email}
            </div>

            <MenuRow
              icon={theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              label={theme === "light" ? "Dark mode" : "Light mode"}
              onClick={onToggleTheme}
            />
            <MenuRow icon={<HelpCircle size={15} />} label="Need help?" href={SUPPORT_TELEGRAM} />
            <MenuRow icon={<LogOut size={15} />} label="Sign out" onClick={signOut} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    background: "transparent",
    cursor: "pointer",
    padding: "0.55rem 0.6rem",
    color: "var(--ink)",
    fontSize: "0.86rem",
    textDecoration: "none",
    transition: "background .15s var(--ease)",
  };
  const enter = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.background = "var(--tb-hover)");
  const leave = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.background = "transparent");
  const body = (
    <>
      <span style={{ color: "var(--muted)", display: "flex" }}>{icon}</span>
      {label}
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={style} onMouseEnter={enter} onMouseLeave={leave}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style} onMouseEnter={enter} onMouseLeave={leave}>
      {body}
    </button>
  );
}
