import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu, X, Sun, Moon, LogOut, HelpCircle, User, Building2, ArrowLeft,
  LayoutDashboard, Users, BarChart3, Sparkles, Mail, UserCircle,
} from "lucide-react";
import { api, ApiError, sessionId } from "../../lib/api";
import { OracleMark } from "../../components/OracleMark";
import { usePageMeta } from "../../lib/meta";
import { auth } from "../../lib/auth";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import { MicrosoftSignIn } from "../../components/MicrosoftSignIn";
import type { AccountContext } from "./types";
import { Bounce } from "./Bounce";
import { PersonalPanel } from "./PersonalPanel";
import { TeamPanel } from "./TeamPanel";
import { StatsPanel } from "./StatsPanel";
import { PhoneVerify } from "./PhoneVerify";
import { AccountsPanel } from "./AccountsPanel";
import { TeamInviteBanner } from "./TeamInviteBanner";
import { CompanyInfoPanel } from "./CompanyInfoPanel";
import { MailboxesPanel } from "./MailboxesPanel";

const DiscoveryPanel = lazy(() =>
  import("./DiscoveryPanel").then((m) => ({ default: m.DiscoveryPanel }))
);

const AgentPanel = lazy(() =>
  import("./AgentPanel").then((m) => ({ default: m.AgentPanel }))
);

const SUPPORT_TELEGRAM = "https://t.me/mngartur";
const EASE = [0.16, 1, 0.3, 1] as const;
const PHONE_VERIFICATION_REQUIRED = 1023;

function signOut() {
  auth.clearToken();
  window.location.href = "/";
}

export default function Cabinet() {
  usePageMeta({ title: "Business cabinet — TruckBox", description: "Manage your TruckBox team.", path: "/business", noindex: true });
  const [ctx, setCtx] = useState<AccountContext | null>(null);
  const [authed, setAuthed] = useState(auth.isAuthed());
  const params = useParams();
  const navigate = useNavigate();
  const section = params.section ?? null;
  const [error, setError] = useState<string | null>(null);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [noAccount, setNoAccount] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof localStorage !== "undefined" && localStorage.getItem("tb-theme") === "dark"
      ? "dark"
      : "light",
  );

  const load = useCallback(async () => {
    try {
      const c = await api.get<AccountContext>("/api/v1/account/context");
      setCtx(c);
      setNeedsPhone(false);
    } catch (e) {
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

  if (!authed && noAccount) {
    return (
      <Bounce
        reason="NO_ACCOUNT"
        telegram={SUPPORT_TELEGRAM}
        onSignOut={() => setNoAccount(false)}
        signOutLabel="Back to sign in"
      />
    );
  }
  if (!authed) {
    const expired =
      typeof sessionStorage !== "undefined" && sessionStorage.getItem("tb-session-expired") === "1";
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center gap-8 px-6 text-center"
        style={{ position: "relative" }}
      >
        <a
          href="/"
          className="ed-btn tb-back-btn"
          style={{ position: "absolute", top: "1.25rem", left: "1.25rem", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to site
        </a>
        <h1 className="ed-display text-[8vw] lg:text-[3.5rem]">Account</h1>
        <p style={{ color: expired ? "var(--danger)" : "var(--muted)" }}>
          {expired
            ? "Your session expired — please sign in again."
            : "Back office login."}
        </p>
        <GoogleSignIn
          onNoAccount={() => setNoAccount(true)}
          onSignedIn={() => {
            sessionStorage.removeItem("tb-session-expired");
            setAuthed(true);
          }}
        />
        <MicrosoftSignIn
          onNoAccount={() => setNoAccount(true)}
          onSignedIn={() => {
            sessionStorage.removeItem("tb-session-expired");
            setAuthed(true);
          }}
        />
      </div>
    );
  }
  if (error) return <div className="min-h-screen flex items-center justify-center px-6 text-center">{error}</div>;
  if (needsPhone) return <PhoneVerify onVerified={load} onSignOut={signOut} />;
  if (!ctx) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (ctx.verdict === "BOUNCE") {
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

  const allowed = (s: string): boolean => {
    if (s === "personal") return ctx.panels.includes("personal");
    if (s === "team" || s === "statistics") return isManager;
    if (s === "discovery") return ctx.panels.includes("discovery");
    if (s === "agent") return ctx.panels.includes("agent");
    if (s === "mailboxes" || s === "accounts" || s === "company") return true;
    return false;
  };
  const defaultSection = ctx.panels[0] ?? "personal";
  if (!section || !allowed(section)) {
    return <Navigate to={`/business/${defaultSection}`} replace />;
  }

  const goto = (s: string) => {
    navigate(`/business/${s}`);
    setNavOpen(false);
  };

  const navBody = (
    <>
      <div className="mb-7 px-1 flex items-center justify-between gap-2">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.15rem",
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
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {ctx.panels.includes("personal") && (
          <>
            <span className="tb-nav-label is-first">Dashboard</span>
            <NavItem label="Overview" icon={<LayoutDashboard />} active={section === "personal"} onClick={() => goto("personal")} />
          </>
        )}

        {isManager && (
          <>
            <span className={"tb-nav-label" + (ctx.panels.includes("personal") ? "" : " is-first")}>
              Management
            </span>
            <NavItem label="Team" icon={<Users />} active={section === "team"} onClick={() => goto("team")} />
            <NavItem
              label="Statistics"
              icon={<BarChart3 />}
              active={section === "statistics"}
              onClick={() => goto("statistics")}
            />
          </>
        )}

        {(ctx.panels.includes("discovery") || ctx.panels.includes("agent")) && (
          <span className="tb-nav-label">Tools</span>
        )}
        {ctx.panels.includes("discovery") && (
          <NavItem
            label="Oracle"
            sub="Dedicated lanes"
            icon={<OracleMark size={16} />}
            premium
            active={section === "discovery"}
            onClick={() => goto("discovery")}
          />
        )}
        {ctx.panels.includes("agent") && (
          <NavItem
            label="Agent"
            sub="Auto outreach"
            icon={<Sparkles />}
            premium
            active={section === "agent"}
            onClick={() => goto("agent")}
          />
        )}

        <span className="tb-nav-label">Settings</span>
        <NavItem label="Mailboxes" icon={<Mail />} active={section === "mailboxes"} onClick={() => goto("mailboxes")} />
        <NavItem label="Accounts" icon={<UserCircle />} active={section === "accounts"} onClick={() => goto("accounts")} />
        <NavItem label="Company info" icon={<Building2 />} active={section === "company"} onClick={() => goto("company")} />
      </nav>

      <div className="mt-auto pt-8 flex flex-col gap-1">
        <span
          className="px-3 py-2"
          style={{
            fontSize: "0.72rem",
            color: "var(--muted)",
            wordBreak: "break-all",
            lineHeight: 1.35,
          }}
        >
          {ctx.email}
        </span>
        <button type="button" className="tb-nav" onClick={() => setHelpOpen(true)}>
          <HelpCircle />
          Need help?
        </button>
        <NavItem label="Sign out" icon={<LogOut />} active={false} onClick={signOut} />
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:flex" style={{ position: "relative" }}>
      <aside
        className="tb-aside hidden md:flex w-60 shrink-0 border-r p-5 flex-col gap-1"
        style={{ borderColor: "var(--hairline)", minHeight: "100vh" }}
      >
        {navBody}
      </aside>

      <header className="tb-topbar md:hidden">
        <span
          style={{
            fontFamily: "var(--font-sans)",
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
        <TeamInviteBanner onAccepted={load} />
        {section === "personal" && <PersonalPanel ctx={ctx} />}
        {section === "team" && ctx.org && <TeamPanel onChanged={load} />}
        {section === "statistics" && isManager && <StatsPanel />}
        {section === "discovery" && ctx.panels.includes("discovery") && (
          <Suspense fallback={<div style={{ color: "var(--muted)" }}>Loading…</div>}>
            <DiscoveryPanel />
          </Suspense>
        )}
        {section === "agent" && ctx.panels.includes("agent") && (
          <Suspense fallback={<div style={{ color: "var(--muted)" }}>Loading…</div>}>
            <AgentPanel campaignId={params.id ? Number(params.id) : null} />
          </Suspense>
        )}
        {section === "mailboxes" && <MailboxesPanel />}
        {section === "accounts" && <AccountsPanel />}
        {section === "company" && <CompanyInfoPanel />}
      </main>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const id = sessionId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the id is on screen to copy by hand */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="tb-drawer-scrim"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Need help?"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, calc(100vw - 2.5rem))",
              background: "var(--bg-2)",
              border: "1px solid var(--hairline)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              padding: "1.6rem",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                className="ed-display"
                style={{ fontSize: "1.4rem", color: "var(--ink)", lineHeight: 1.1 }}
              >
                Need help?
              </h2>
              <button type="button" className="tb-icon-btn" aria-label="Close" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <p style={{ color: "var(--muted)", fontSize: "0.86rem", marginTop: "0.7rem" }}>
              Send us this session ID — it lets us find exactly what happened on your account.
            </p>

            <div
              className="mt-3 flex items-center gap-2"
              style={{ border: "1px solid var(--hairline)", padding: "0.5rem 0.6rem" }}
            >
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.76rem",
                  color: "var(--ink)",
                  flex: 1,
                  wordBreak: "break-all",
                }}
              >
                {id}
              </code>
              <button
                type="button"
                className="ed-btn"
                style={{ padding: "0.3rem 0.7rem", fontSize: "0.76rem", whiteSpace: "nowrap" }}
                onClick={copy}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <a
              className="ed-btn ed-btn-accent mt-4"
              href={SUPPORT_TELEGRAM}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                justifyContent: "center",
              }}
            >
              <TelegramMark />
              Chat with us on Telegram
            </a>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TelegramMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.3 18.9 19.1c-.23 1.02-.84 1.27-1.7.79l-4.7-3.47-2.27 2.19c-.25.25-.46.46-.95.46l.34-4.8L18.4 6.4c.38-.34-.08-.53-.59-.19L6.05 13.6l-4.63-1.45c-1-.32-1.02-1 .21-1.49l18.1-6.98c.84-.3 1.57.2 1.21 2.62Z" />
    </svg>
  );
}

function NavItem({
  label,
  sub,
  icon,
  active,
  premium,
  onClick,
}: {
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active: boolean;
  premium?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={"tb-nav" + (active ? " is-active" : "") + (premium ? " is-premium" : "")}
    >
      {icon}
      {sub ? (
        <span className="tb-nav-text">
          <span>{label}</span>
          <span className="tb-nav-sub">{sub}</span>
        </span>
      ) : (
        label
      )}
      {premium && (
        <span className="tb-prem-spark" aria-label="Premium">
          <Sparkles />
        </span>
      )}
    </button>
  );
}
