import { useEffect, useState, useCallback, useRef } from "react";
import { api, ApiError } from "../../lib/api";
import { auth } from "../../lib/auth";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import type { AccountContext } from "./types";
import { Bounce } from "./Bounce";
import { PersonalPanel } from "./PersonalPanel";
import { TeamPanel } from "./TeamPanel";
import { StatsPanel } from "./StatsPanel";

// TODO: replace with the real TruckBox support Telegram handle.
const SUPPORT_TELEGRAM = "https://t.me/your_handle";

function signOut() {
  auth.clearToken();
  window.location.href = "/";
}

export default function Cabinet() {
  const [ctx, setCtx] = useState<AccountContext | null>(null);
  const [authed, setAuthed] = useState(auth.isAuthed());
  const [section, setSection] = useState("personal");
  const [error, setError] = useState<string | null>(null);
  // Pick the default tab only on the first load; later refreshes (e.g. after a
  // seat/member change via onChanged) must keep the user on their current tab.
  const sectionInit = useRef(false);

  const load = useCallback(async () => {
    try {
      const c = await api.get<AccountContext>("/api/v1/account/context");
      setCtx(c);
      if (!sectionInit.current) {
        setSection(c.panels[0] ?? "personal");
        sectionInit.current = true;
      }
    } catch (e) {
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

  // Premium dark cabinet background + hide the marketing Crisp chat while mounted.
  useEffect(() => {
    const w = window as unknown as { $crisp?: unknown[] };
    document.body.classList.add("tb-cabinet-bg");
    w.$crisp?.push(["do", "chat:hide"]);
    return () => {
      document.body.classList.remove("tb-cabinet-bg");
      w.$crisp?.push(["do", "chat:show"]);
    };
  }, []);

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8">
        <h1 className="ed-display text-[8vw] lg:text-[3.5rem]">Account</h1>
        <p style={{ color: "var(--muted)" }}>Sign in to manage your plan and team.</p>
        <GoogleSignIn onSignedIn={() => setAuthed(true)} />
      </div>
    );
  }
  if (error) return <div className="min-h-screen flex items-center justify-center">{error}</div>;
  if (!ctx) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (ctx.verdict === "BOUNCE")
    return <Bounce reason={ctx.bounceReason ?? "INSTALL"} onSignOut={signOut} telegram={SUPPORT_TELEGRAM} />;

  const isManager = ctx.panels.includes("team") && !!ctx.org;

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-56 border-r p-6 flex flex-col gap-2"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div className="ed-label mb-4">TruckBox</div>
        {ctx.panels.includes("personal") && (
          <NavItem label="Overview" active={section === "personal"} onClick={() => setSection("personal")} />
        )}
        {isManager && (
          <NavItem label="Team" active={section === "team"} onClick={() => setSection("team")} />
        )}
        {isManager && (
          <NavItem label="Statistics" active={section === "statistics"} onClick={() => setSection("statistics")} />
        )}

        <div className="mt-auto flex flex-col items-stretch gap-3 pt-6">
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
      </aside>
      <main className="flex-1 p-10">
        {section === "personal" && <PersonalPanel ctx={ctx} />}
        {section === "team" && ctx.org && <TeamPanel onChanged={load} />}
        {section === "statistics" && isManager && <StatsPanel />}
      </main>
    </div>
  );
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left py-2"
      style={{ color: active ? "var(--ink)" : "var(--muted)", fontWeight: active ? 700 : 400 }}
    >
      {label}
    </button>
  );
}
