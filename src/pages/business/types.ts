export type Verdict = "ALLOW" | "BOUNCE";
export type BounceReason = "INSTALL" | "PAYMENT" | "USE_EXTENSION";
export type OrgRole = "OWNER" | "MANAGER" | "MEMBER";

export type AccountContext = {
  verdict: Verdict;
  bounceReason: BounceReason | null;
  panels: string[];
  email: string;
  effectiveStatus: string | null;
  org: { id: number; name: string; role: OrgRole; seats: number; cancelAtPeriodEnd: boolean } | null;
};
