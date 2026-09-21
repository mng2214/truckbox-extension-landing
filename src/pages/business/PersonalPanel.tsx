import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api";
import type { AccountContext } from "./types";
import { ConfirmDialog } from "./ConfirmDialog";

const NO_SUBSCRIPTION = 1013;
const ALREADY_CANCELLING = 1012;

type PlatformStats = {
  platform: string;
  emailSentCount: number;
  mapViewedCount: number;
  phoneCallCount: number;
};
type MyStats = {
  emailSentCount: number;
  mapViewedCount: number;
  phoneCallCount: number;
  platforms: PlatformStats[];
};

type Win = { emailsSent: number; mapsOpened: number; callsPlaced: number };
type UserStatus = {
  trialEnd: string | null;
  planExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
};
type TeamStats = { dispatchers: { total: Win }[] };

function fmtTrialLeft(trialEnd: string): string | null {
  const ms = new Date(trialEnd).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "ends today";
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

function fmtTimeSaved(actions: number): string {
  const totalMin = Math.floor((actions * 30) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PersonalPanel({ ctx }: { ctx: AccountContext }) {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Win | null>(null);
  const [busy, setBusy] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [plan, setPlan] = useState<UserStatus | null>(null);

  const isManager = ctx.panels.includes("team") && !!ctx.org;
  const onTrial = ctx.effectiveStatus === "TRIAL";

  useEffect(() => {
    api
      .get<MyStats>("/api/v1/analytics/my-stats")
      .then(setStats)
      .catch(() => setStatsError(true));
  }, []);

  const loadPlan = useCallback(
    () =>
      api
        .get<UserStatus>("/api/v1/user/status")
        .then((status) => {
          setPlan(status);
          if (status.cancelAtPeriodEnd) setError(null);
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    if (ctx.org) return;
    loadPlan();
  }, [ctx.org, loadPlan]);

  useEffect(() => {
    if (!isManager) return;
    api
      .get<TeamStats>("/api/v1/manager/team-stats")
      .then((s) =>
        setCompany(
          s.dispatchers.reduce(
            (a, d) => ({
              emailsSent: a.emailsSent + d.total.emailsSent,
              mapsOpened: a.mapsOpened + d.total.mapsOpened,
              callsPlaced: a.callsPlaced + d.total.callsPlaced,
            }),
            { emailsSent: 0, mapsOpened: 0, callsPlaced: 0 }
          )
        )
      )
      .catch(() => setCompany(null));
  }, [isManager]);

  const openPortal = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setPortalLoading(true);
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/portal");
      window.location.href = url;
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === NO_SUBSCRIPTION
          ? "Billing opens once you subscribe. The free trial takes no payment details, so there are no invoices yet."
          : "Could not open billing portal. Please try again.",
      );
      setBusy(false);
      setPortalLoading(false);
    }
  };

  const subscribe = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setCheckoutLoading(true);
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/create-checkout-session");
      window.location.href = url;
    } catch {
      setError("Could not start checkout. Please try again.");
      setBusy(false);
      setCheckoutLoading(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/v1/billing/cancel-subscription");
      await loadPlan();
      setNotice("Cancelled. You keep full access until the end of the billing period.");
    } catch (e) {
      if (e instanceof ApiError && e.code === ALREADY_CANCELLING) {
        setNotice("Your subscription is already set to end at the end of the billing period.");
        loadPlan();
      } else {
        setError(
          e instanceof ApiError && e.code === NO_SUBSCRIPTION
            ? "You don't have a paid subscription yet, so there is nothing to cancel."
            : "Could not cancel subscription. Please try again.",
        );
      }
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  const trialLeft = onTrial && plan?.trialEnd ? fmtTrialLeft(plan.trialEnd) : null;
  const endingOn = plan?.cancelAtPeriodEnd ? plan.planExpiresAt : null;

  const totalActions = stats
    ? stats.emailSentCount + stats.mapViewedCount + stats.phoneCallCount
    : 0;

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="ed-display text-[6vw] lg:text-[2.5rem]">Overview</h1>
        <p style={{ color: "var(--muted)" }}>
          {ctx.email}
          {ctx.effectiveStatus ? ` · ${ctx.effectiveStatus}` : ""}
          {trialLeft ? (
            <>
              {" · "}
              <span style={{ color: "var(--accent)" }}>{trialLeft}</span>
            </>
          ) : null}
          {endingOn ? (
            <>
              {" · "}
              <span style={{ color: "var(--danger, #c0392b)" }}>
                cancelled, ends{" "}
                {new Date(endingOn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {company && (
        <div className="flex flex-col gap-3">
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Whole team · all time
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total emails" value={String(company.emailsSent)} />
            <StatCard label="Total maps" value={String(company.mapsOpened)} />
            <StatCard label="Total calls" value={String(company.callsPlaced)} />
            <StatCard
              label="Company saved time"
              value={fmtTimeSaved(company.emailsSent + company.mapsOpened + company.callsPlaced)}
              accent
            />
          </div>
        </div>
      )}

      <div>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--muted)" }}
        >
          Your activity
        </h2>
        {!stats && !statsError ? (
          <p style={{ color: "var(--muted)" }}>Loading stats…</p>
        ) : statsError ? (
          <p style={{ color: "var(--muted)" }}>Stats unavailable.</p>
        ) : stats ? (
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            <StatLine label="Emails sent" value={String(stats.emailSentCount)} />
            <StatLine label="Maps opened" value={String(stats.mapViewedCount)} />
            <StatLine label="Calls placed" value={String(stats.phoneCallCount)} />
            <StatLine label="Time saved" value={fmtTimeSaved(totalActions)} accent />
          </div>
        ) : null}
      </div>

      {!ctx.org && (
        <div
          className="flex flex-col gap-2 p-6 rounded-lg border"
          style={{ borderColor: "var(--hairline)" }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted)" }}
          >
            Billing
          </h2>
          {onTrial ? (
            <div className="flex flex-col gap-3 items-start">
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Free trial{trialLeft ? `, ${trialLeft}` : ""} — no card on file. Subscribe any time
                to keep your access when the trial ends.
              </p>
              <button
                className="ed-btn ed-btn-accent"
                disabled={busy}
                aria-busy={checkoutLoading}
                onClick={subscribe}
              >
                {checkoutLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="tb-spinner"
                      style={{ borderColor: "rgba(255,255,255,0.45)", borderTopColor: "#fff" }}
                      aria-hidden
                    />
                    Opening…
                  </span>
                ) : (
                  <span>Subscribe — $7 / month</span>
                )}
              </button>
            </div>
          ) : (
          <div className="flex gap-3 flex-wrap">
            <button
              className="ed-btn ed-btn-accent"
              disabled={busy}
              aria-busy={portalLoading}
              onClick={openPortal}
            >
              {portalLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="tb-spinner"
                    style={{ borderColor: "rgba(255,255,255,0.45)", borderTopColor: "#fff" }}
                    aria-hidden
                  />
                  Opening…
                </span>
              ) : (
                <span>Billing &amp; invoices</span>
              )}
            </button>
            {!endingOn && (
              <button
                className="ed-btn"
                disabled={busy || !!notice}
                onClick={() => setConfirmCancel(true)}
              >
                <span>Cancel subscription</span>
              </button>
            )}
          </div>
          )}
          {endingOn && !onTrial && (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Subscription ends{" "}
              {new Date(endingOn).toLocaleDateString("en-US", { month: "long", day: "numeric" })} —
              you keep full access until then.
            </p>
          )}
          {error && <p style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}
          {notice && <p style={{ color: "var(--sub)", fontSize: "0.85rem" }}>{notice}</p>}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        message="You keep full access until the end of the current billing period. After that, your extension access ends."
        confirmLabel="Cancel subscription"
        cancelLabel="Keep subscription"
        destructive
        busy={busy}
        onConfirm={cancel}
        onClose={() => setConfirmCancel(false)}
      />
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-lg border"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

function StatLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: accent ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}
