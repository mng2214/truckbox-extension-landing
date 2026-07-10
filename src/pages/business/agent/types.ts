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

export type CampaignDraft = {
  campaignId: number;
  brokers: DraftBrokerRow[];
  maxBrokers: number;
  mcRequired: boolean;
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
