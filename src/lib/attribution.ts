/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { API_BASE, deviceId } from "./api";

const TOUCH_KEY = "tb-first-touch";
const DIRECT = "direct";
const SOURCE_PARAMS = ["utm_source", "source", "src", "from", "ref"];
const DEVICE_ID = /^[A-Za-z0-9_-]{8,100}$/;
const NOT_AN_ARRIVAL = ["/guide", "/r/", "/i/", "/unsubscribe/", "/business/oauth", "/admin2214", "/success", "/cancel"];
const REFERRAL = "referral";
const SEARCH_ENGINES = ["google.", "bing.", "yahoo.", "duckduckgo.", "yandex.", "baidu."];

export type Touch = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landingPath: string;
  at: string;
};

function clip(value: string | null | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function readTouch(): Touch | null {
  try {
    const raw = localStorage.getItem(TOUCH_KEY);
    return raw ? (JSON.parse(raw) as Touch) : null;
  } catch {
    return null;
  }
}

function externalReferrer(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    return host && !host.endsWith("truckbox.app") && host !== location.hostname ? host : null;
  } catch {
    return null;
  }
}

function touchFromThisVisit(): Touch {
  const query = new URLSearchParams(location.search);
  const sourceParam = SOURCE_PARAMS.find((name) => (query.get(name) || "").trim());
  const referrer = externalReferrer();
  const source = clip(sourceParam ? query.get(sourceParam) : referrer, 100) ?? DIRECT;
  const isSearch = referrer != null && SEARCH_ENGINES.some((engine) => referrer.includes(engine));
  const medium =
    clip(query.get("utm_medium"), 100) ?? (sourceParam || !referrer ? null : isSearch ? "organic" : "referral");
  return {
    source,
    medium,
    campaign: clip(query.get("utm_campaign"), 150),
    content: clip(query.get("utm_content"), 150),
    term: clip(query.get("utm_term"), 150),
    referrer,
    landingPath: location.pathname.slice(0, 300),
    at: new Date().toISOString(),
  };
}

function reportTouch(targetDeviceId: string, touch: Touch): void {
  if (!DEVICE_ID.test(targetDeviceId)) return;
  try {
    void fetch(API_BASE + "/api/v1/public/attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: targetDeviceId,
        source: touch.source,
        medium: touch.medium,
        campaign: touch.campaign,
        content: touch.content,
        term: touch.term,
        referrer: touch.referrer,
        landingPath: touch.landingPath,
      }),
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // A beacon: never break the page.
  }
}

function keepTouch(touch: Touch): void {
  const existing = readTouch();
  const invite = touch.source === REFERRAL;
  if (existing && !invite && !(existing.source === DIRECT && touch.source !== DIRECT)) return;
  try {
    localStorage.setItem(TOUCH_KEY, JSON.stringify(touch));
  } catch {
    return;
  }
  reportTouch(deviceId(), touch);
}

export function captureFirstTouch(): void {
  try {
    if (NOT_AN_ARRIVAL.some((prefix) => location.pathname.startsWith(prefix))) return;
    keepTouch(touchFromThisVisit());
  } catch {
    // Attribution is best effort.
  }
}

export function bridgeTouchToExtension(): void {
  try {
    const extensionDevice = new URLSearchParams(location.search).get("d");
    const touch = readTouch();
    if (extensionDevice && touch) reportTouch(extensionDevice, touch);
  } catch {
    // Attribution is best effort.
  }
}

function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export async function followTrackedLink(code: string): Promise<string> {
  try {
    const response = await fetch(
      API_BASE + "/api/v1/public/links/" + encodeURIComponent(code) + "/click",
      { method: "POST", credentials: "omit" },
    );
    if (!response.ok) return "/";
    const link = (await response.json()) as { code: string; campaign: string; targetPath: string };
    const target = isInternalPath(link.targetPath) ? link.targetPath : "/";
    keepTouch({
      source: "email",
      medium: "cold",
      campaign: clip(link.campaign, 150),
      content: clip(link.code, 150),
      term: null,
      referrer: null,
      landingPath: target.slice(0, 300),
      at: new Date().toISOString(),
    });
    return target;
  } catch {
    return "/";
  }
}

export function followInvite(code: string): void {
  const cleaned = code.trim().toLowerCase();
  if (!/^[a-z0-9]{6,16}$/.test(cleaned)) return;
  try {
    keepTouch({
      source: REFERRAL,
      medium: "invite",
      campaign: null,
      content: cleaned,
      term: null,
      referrer: externalReferrer(),
      landingPath: location.pathname.slice(0, 300),
      at: new Date().toISOString(),
    });
  } catch {
    // Attribution is best effort.
  }
}
