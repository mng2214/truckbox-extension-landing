/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

export type Verdict = "ALLOW" | "BOUNCE";
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
