export type Verdict = "ALLOW" | "BOUNCE";
/** NO_ACCOUNT is client-side only: a web sign-in by someone who never signed up in the extension. */
export type BounceReason = "INSTALL" | "PAYMENT" | "USE_EXTENSION" | "NO_ACCOUNT";
export type OrgRole = "OWNER" | "MANAGER" | "MEMBER";

export type AccountContext = {
  verdict: Verdict;
  bounceReason: BounceReason | null;
  panels: string[];
  email: string;
  effectiveStatus: string | null;
  org: { id: number; name: string; role: OrgRole; seats: number; cancelAtPeriodEnd: boolean } | null;
};
