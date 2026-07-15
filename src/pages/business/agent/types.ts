// Wire types for the Agent (outreach) API — mirrors backend OutreachDtos / CampaignDraft.

export type DraftBrokerRow = {
  brokerId: number;
  brokerName: string;
  mcNumber: string | null;
  origin: string;
  destination: string;
  activeDays30d: number;
  totalReposted30d: number;
  plannedEmail: string | null;
  plannedReason: string | null;
  available: boolean;
  preChecked: boolean;
};

/**
 * Display-only cleanup of an email body: cut the quoted tail ("On … wrote:" + "> …" lines)
 * so the timeline shows just the new text. Raw bodies stay untouched in the DB/API.
 */
export function stripQuotedTail(body: string | null): string {
  if (!body) return "";
  const lines = body.split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith(">") || (/^On .{5,120} wrote:$/.test(l) && i > 0)) {
      cut = i;
      break;
    }
  }
  const stripped = lines.slice(0, cut).join("\n").trimEnd();
  return stripped.length > 0 ? stripped : body; // a pure-quote email still shows something
}

export type CampaignDraft = {
  campaignId: number;
  brokers: DraftBrokerRow[];
  maxBrokers: number;
  mcRequired: boolean;
  companyRequired: boolean;
  firstNameRequired: boolean;
};

export type CampaignSummary = {
  id: number;
  status: "DRAFT" | "RUNNING" | "PAUSED_AUTH" | "COMPLETED" | "CANCELLED";
  origin: string;
  destination: string;
  brokerCount: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type AgentMessage = {
  direction: "OUT" | "IN";
  subject: string | null;
  body: string | null;
  sentAt: string | null;
};

export type ThreadStatus =
  | "QUEUED"
  | "DRAFTING"
  | "SENT"
  | "AWAITING_REPLY"
  | "FOLLOW_UP_SENT"
  | "REPLIED"
  | "ANALYZING"
  | "NEEDS_USER"
  | "DONE"
  | "NO_REPLY"
  | "BOUNCED"
  | "RETRY_NEXT_CONTACT"
  | "STOPPED";

export type AgentThread = {
  id: number;
  brokerId: number;
  brokerName: string;
  contactEmail: string;
  contactReason: string | null;
  status: ThreadStatus;
  clarifyRounds: number;
  extracted: string | null;
  firstSentAt: string | null;
  lastActivityAt: string | null;
  messages: AgentMessage[];
};

export type CampaignDetail = {
  summary: CampaignSummary;
  threads: AgentThread[];
  reportMd: string | null;
  reportJson: string | null;
};

export const TERMINAL_STATUSES: ThreadStatus[] = ["DONE", "NO_REPLY", "BOUNCED", "STOPPED"];

export function isTerminal(s: ThreadStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}
