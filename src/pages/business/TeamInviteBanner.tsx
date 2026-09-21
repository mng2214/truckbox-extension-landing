import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";

type Invite = { memberId: number; organizationName: string; withSeat: boolean };

export function TeamInviteBanner({ onAccepted }: { onAccepted: () => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Invite[]>("/api/v1/account/team-invites")
      .then((list) => setInvite(list[0] ?? null))
      .catch(() => {});
  }, []);

  if (!invite) return null;

  const answer = (kind: "accept" | "decline") => {
    setBusy(true);
    setError(null);
    api
      .post(`/api/v1/account/team-invites/${invite.memberId}/${kind}`, {})
      .then(() => {
        setInvite(null);
        if (kind === "accept") onAccepted();
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again."))
      .finally(() => setBusy(false));
  };

  return (
    <div
      role="status"
      style={{
        border: "1px solid var(--accent)",
        background: "var(--accent-tint)",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        display: "flex",
        gap: "0.75rem 1rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 320px", color: "var(--ink)", lineHeight: 1.5 }}>
        <b>{invite.organizationName}</b> invites you to their team. They'll pay for your access and see
        your activity stats.
        {invite.withSeat && " A personal plan you pay for yourself will be cancelled at the end of its paid period."}
        {error && <div style={{ color: "var(--danger)", marginTop: 6 }}>{error}</div>}
      </div>
      <button type="button" className="ed-btn ed-btn-accent" disabled={busy} onClick={() => answer("accept")}>
        Accept
      </button>
      <button type="button" className="ed-btn" disabled={busy} onClick={() => answer("decline")}>
        Decline
      </button>
    </div>
  );
}
