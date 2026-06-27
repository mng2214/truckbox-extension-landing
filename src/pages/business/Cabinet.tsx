import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../../lib/api";
import { auth } from "../../lib/auth";
import { GoogleSignIn } from "../../components/GoogleSignIn";
import type { AccountContext } from "./types";
import { Bounce } from "./Bounce";
import { PersonalPanel } from "./PersonalPanel";
import { TeamPanel } from "./TeamPanel";

export default function Cabinet() {
  const [ctx, setCtx] = useState<AccountContext | null>(null);
  const [authed, setAuthed] = useState(auth.isAuthed());
  const [section, setSection] = useState("personal");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await api.get<AccountContext>("/api/v1/account/context");
      setCtx(c);
      setSection(c.panels[0] ?? "personal");
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
  if (ctx.verdict === "BOUNCE") return <Bounce reason={ctx.bounceReason ?? "INSTALL"} />;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r p-6 flex flex-col gap-2" style={{ borderColor: "var(--hairline)" }}>
        <div className="ed-label mb-4">TruckBox</div>
        {ctx.panels.includes("personal") && (
          <NavItem label="Overview" active={section === "personal"} onClick={() => setSection("personal")} />
        )}
        {ctx.panels.includes("team") && ctx.org && (
          <NavItem label="Team" active={section === "team"} onClick={() => setSection("team")} />
        )}
        <button
          className="ed-btn mt-auto"
          onClick={() => {
            auth.clearToken();
            setAuthed(false);
            setCtx(null);
            setError(null);
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-10">
        {section === "personal" && <PersonalPanel ctx={ctx} />}
        {section === "team" && ctx.org && <TeamPanel onChanged={load} />}
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
