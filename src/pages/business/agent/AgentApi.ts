import { api } from "../../../lib/api";
import type { CampaignDetail, CampaignDraft, CampaignSummary } from "./types";

// Stealth probe: 404 = user has no Agent entitlement → render nothing agent-related.
export async function probeAgent(): Promise<{ available: boolean; connected: boolean }> {
  try {
    const res = await api.get<{ connected: boolean }>("/api/v1/outreach/google/status");
    return { available: true, connected: res.connected };
  } catch {
    return { available: false, connected: false };
  }
}

export function sendGoogleConsent(code: string): Promise<{ connected: boolean }> {
  return api.post<{ connected: boolean }>("/api/v1/outreach/google/consent", {
    code,
    redirectUri: "postmessage", // GIS popup code flow uses the "postmessage" pseudo-redirect
  });
}

export function createDraft(requestId: number): Promise<CampaignDraft> {
  return api.post<CampaignDraft>(`/api/v1/discovery/requests/${requestId}/campaign`, {});
}

export function confirmCampaign(
  campaignId: number,
  brokerIds: number[],
  mcNumber: string | null,
  companyName: string | null,
  firstName: string | null,
): Promise<CampaignSummary> {
  return api.put<CampaignSummary>(`/api/v1/outreach/campaigns/${campaignId}/confirm`, {
    brokerIds,
    mcNumber,
    companyName,
    firstName,
  });
}

export function listCampaigns(): Promise<CampaignSummary[]> {
  return api.get<CampaignSummary[]>("/api/v1/outreach/campaigns");
}

export function getCampaign(id: number): Promise<CampaignDetail> {
  return api.get<CampaignDetail>(`/api/v1/outreach/campaigns/${id}`);
}

export function cancelCampaign(id: number): Promise<CampaignSummary> {
  return api.post<CampaignSummary>(`/api/v1/outreach/campaigns/${id}/cancel`, {});
}

export function stopThread(id: number): Promise<void> {
  return api.post<void>(`/api/v1/outreach/threads/${id}/stop`, {});
}
