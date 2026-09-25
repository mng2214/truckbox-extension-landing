/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { trackDemo } from "../../../lib/demoTrack";
import {
  DEMO_LOADS,
  DEMO_MAILBOXES,
  DEMO_TEMPLATES,
  DEMO_USER,
  laneHistory,
  laneIntraday,
  seedSavedLoads,
  type DemoLoad,
} from "../mock/data";

type Msg = Record<string, unknown> & { type?: string; payload?: Record<string, unknown> };
type Reply = Record<string, unknown>;

const STORE_KEY = "tbdemo:storage";
const SAVED_KEY = "tbdemo:savedLoads";

const SIGNED_OUT: Record<string, unknown> = {
  deviceId: "demo-device",
  sessionId: "demo-session",
  tbDarkMode: false,
  mapEnabled: true,
  rtsEnabled: true,
  apexEnabled: true,
  triumphEnabled: true,
  dupFilterEnabled: false,
  tripFilterEnabled: false,
  datOwnEmailBtnEnabled: true,
};

const SIGNED_IN: Record<string, unknown> = {
  backendToken: "demo-token",
  loginProvider: "GOOGLE",

  templatesCache: { templates: DEMO_TEMPLATES },

  rtsToken: "demo-rts-token",
  rtsTokenExp: Math.floor(Date.now() / 1000) + 30 * 86400,
  rtsShow: true,
};

export type DemoEvent =
  | {
      kind: "email";
      to: string;
      subject: string;
      body: string;
      from: string;
      broker: string;
      template: string;
      sentAt: string;
    }
  | { kind: "signin" }
  | { kind: "signout" }
  | { kind: "blocked"; what: string };

type Listener = (event: DemoEvent) => void;

type Template = { id: number; name: string; active?: boolean; subject: string; body: string };

const fill = (template: string | undefined, context: Record<string, unknown>) => {
  if (!template) return "";
  const miles = String(context.tripMiles ?? context.miles ?? "").replace(/[^0-9]/g, "");
  const values: Record<string, string> = {
    origin: String(context.origin ?? "the pickup"),
    destination: String(context.destination ?? "the drop"),
    pickupDate: String(context.pickupDate ?? ""),
    equipment: String(context.equipment ?? ""),
    length: String(context.length ?? "").replace(/[^0-9]/g, ""),
    weight: String(context.weight ?? ""),
    rate: String(context.rate ?? ""),
    referenceId: String(context.referenceId ?? ""),
    miles: miles || "—",
    broker: String(context.brokerName ?? ""),
    name: DEMO_USER.name,
    company: DEMO_USER.company,
    mc: DEMO_USER.mcNumber,
    myName: DEMO_USER.name,
    myMc: DEMO_USER.mcNumber,
    myPhone: DEMO_USER.phone,
  };
  return template.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
};

class DemoRuntime {
  private data: Record<string, unknown> = { ...SIGNED_OUT };
  private storageListeners: ((changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void)[] = [];
  private messageListeners: ((msg: Msg, sender: unknown, reply: (r: Reply) => void) => void)[] = [];
  private eventListeners: Listener[] = [];
  private savedLoads: Record<string, unknown>[] = [];

  private autoSettings: Record<string, unknown> | null = null;
  private autoNotices: Record<string, unknown>[] = [];
  private autoLog: Record<string, unknown>[] = [];
  private autoLedger = new Set<string>();
  private autoRuns = new Map<string, Record<string, unknown>>();
  private sentThisSession = 0;

  private cancelAtPeriodEnd = false;

  constructor() {
    this.restore();
  }

  private restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      const saved = localStorage.getItem(SAVED_KEY);

      this.savedLoads = saved ? JSON.parse(saved) : seedSavedLoads();
    } catch {
      this.savedLoads = seedSavedLoads();
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      localStorage.setItem(SAVED_KEY, JSON.stringify(this.savedLoads));
    } catch {}
  }

  reset() {
    this.data = { ...SIGNED_OUT };
    this.savedLoads = seedSavedLoads();
    this.persist();
    this.emit({ kind: "signout" });
  }

  on(listener: Listener) {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  private emit(event: DemoEvent) {
    this.eventListeners.forEach((l) => l(event));
  }

  get signedIn() {
    return !!this.data.backendToken;
  }

  signIn() {
    this.setMany(SIGNED_IN);
    this.emit({ kind: "signin" });
  }

  signOut() {
    ["backendToken", "loginProvider", "templatesCache"].forEach((k) => this.remove(k));
    this.emit({ kind: "signout" });
  }

  get(keys: string | string[] | Record<string, unknown> | null | undefined) {
    if (keys == null) return { ...this.data };
    const names = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out: Record<string, unknown> = {};
    for (const name of names) {
      if (name in this.data) out[name] = this.data[name];
      else if (keys && !Array.isArray(keys) && typeof keys === "object") out[name] = (keys as Record<string, unknown>)[name];
    }
    return out;
  }

  setMany(values: Record<string, unknown>) {
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const [key, value] of Object.entries(values)) {
      changes[key] = { oldValue: this.data[key], newValue: value };
      this.data[key] = value;
    }
    this.persist();
    this.storageListeners.forEach((l) => l(changes, "local"));
  }

  remove(keys: string | string[]) {
    const names = typeof keys === "string" ? [keys] : keys;
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const name of names) {
      changes[name] = { oldValue: this.data[name], newValue: undefined };
      delete this.data[name];
    }
    this.persist();
    this.storageListeners.forEach((l) => l(changes, "local"));
  }

  addStorageListener(fn: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void) {
    this.storageListeners.push(fn);
  }

  addMessageListener(fn: (msg: Msg, sender: unknown, reply: (r: Reply) => void) => void) {
    this.messageListeners.push(fn);
  }

  private deliverToListeners(msg: Msg): Reply | undefined {
    let answer: Reply | undefined;
    this.messageListeners.forEach((fn) => {
      try {
        fn(msg, { id: "demo" }, (r) => {
          answer = r;
        });
      } catch {}
    });
    return answer;
  }

  send(msg: Msg): Reply {
    const type = String(msg?.type || "");
    const payload = (msg?.payload || {}) as Record<string, unknown>;

    switch (type) {
      case "auth_me":

        return this.signedIn
          ? {
              ok: true,
              signedIn: true,
              user: { email: DEMO_USER.email, name: DEMO_USER.name, mcNumber: DEMO_USER.mcNumber },
            }
          : { ok: false, signedIn: false, needLogin: true };

      case "token":
      case "auth_status":
        return { ok: true, signedIn: this.signedIn };

      case "templates_get":
      case "template_get": {
        const cache = (this.data.templatesCache as { templates?: unknown[] }) ?? { templates: DEMO_TEMPLATES };

        if (!this.data.templatesCache) this.setMany({ templatesCache: cache });
        return { ok: true, data: cache };
      }

      case "template_set":
      case "templates_save": {
        const templates = (msg.templates ?? payload.templates ?? msg.data) as unknown[];
        if (Array.isArray(templates)) this.setMany({ templatesCache: { templates } });
        return { ok: true };
      }

      case "auth_providers":
        return { ok: true, data: { google: true, microsoft: true } };

      case "auth_login":
      case "auth_login_microsoft":

        this.emit({ kind: "blocked", what: "sign-in" });
        return { ok: true, pending: true, demo: true };

      case "auth_logout":
        this.signOut();
        return { ok: true };

      case "user_status_get": {
        const renews = new Date(Date.now() + 26 * 86400000).toISOString();
        return {
          ok: true,
          data: {
            email: DEMO_USER.email,
            name: DEMO_USER.name,
            mcNumber: DEMO_USER.mcNumber,
            companyName: DEMO_USER.company,
            planStatus: "ACTIVE",
            canUseExtension: true,
            cancelAtPeriodEnd: this.cancelAtPeriodEnd,
            planExpiresAt: renews,
            trialEnd: null,
            teamMember: false,
            teamOwner: false,
            hasSeat: true,
            oracle: true,
          },
        };
      }

      case "stats_get":
        return {
          ok: true,
          data: {
            total: 486 + this.sentThisSession,
            mapViewedCount: 212,
            phoneCallCount: 97,
            dat: { email: 361 + this.sentThisSession, map: 168, call: 74 },
            truckstop: { email: 125, map: 44, call: 23 },
          },
        };

      case "team_invites":
        return { ok: true, data: [] };

      case "manager_team_stats":
        return { ok: true, data: { members: [], seats: 0 } };

      case "rts_status":
        return { ok: true, data: { connected: true, demo: true } };

      case "rts_disconnect":
      case "triumph_disconnect":
      case "apex_disconnect":
      case "trip_filter_apply":
      case "open_change_phone":
        return { ok: true };

      case "mailboxes_list":
        return { ok: true, data: { mailboxes: DEMO_MAILBOXES, max: 3 } };

      case "saved_loads_get":
        return { ok: true, data: this.savedLoads };

      case "saved_load_save": {
        const load = (msg.data || msg.load || payload.load || payload) as Record<string, unknown>;
        const key = String(load.externalKey ?? load.id ?? Math.random());
        const existing = this.savedLoads.find((l) => l.externalKey === key);
        if (existing) return { ok: true, data: existing };
        const row = {
          ...load,
          id: Date.now(),
          externalKey: key,
          createdAt: new Date().toISOString(),
          currentAvgPrice: this.laneAverage(load),
          priceDelta: this.laneDelta(load),
        };

        this.savedLoads = [row, ...this.savedLoads];
        trackDemo(
          "save",
          load.origin && load.destination ? `${load.origin} → ${load.destination}` : undefined,
        );
        this.persist();
        return { ok: true, data: row };
      }

      case "saved_load_remove": {
        const id = msg.id ?? payload.id;
        this.savedLoads = this.savedLoads.filter((l) => String(l.id) !== String(id));
        this.persist();
        return { ok: true };
      }

      case "saved_load_note": {
        const id = msg.id ?? payload.id;
        const note = (msg.note ?? payload.note ?? "") as string;
        const row = this.savedLoads.find((l) => String(l.id) === String(id));
        if (row) row.note = note.trim() || undefined;
        this.persist();
        return { ok: true, data: row };
      }

      case "saved_loads_clear": {
        const removed = this.savedLoads.length;
        this.savedLoads = [];
        this.persist();
        return { ok: true, data: { removed } };
      }

      case "fuel_price_get":
        return {
          ok: true,
          data: { pricePerGallon: 6.285, asOf: new Date().toISOString().slice(0, 10), source: "eia" },
        };

      case "lane_price_history": {
        const load = this.matchLoad(payload);
        const points = laneHistory(load).map((d) => ({
          date: d.day,
          avg: d.avgPrice,
          last: d.lastPrice,
          min: d.minPrice,
          max: d.maxPrice,
          count: d.cnt,
        }));
        return { ok: true, data: { points } };
      }

      case "lane_intraday_price": {
        const load = this.matchLoad(payload);
        const today = new Date().toISOString().slice(0, 10);
        const points = laneIntraday(load).map((p) => ({
          time: `${today}T${p.at}:00`,
          price: p.price,
        }));
        return { ok: true, data: { points } };
      }

      case "lane_posting_frequency": {
        const load = this.matchLoad(payload);
        const history = laneHistory(load, 30);
        const points = history.map((d) => ({ date: d.day, count: Math.max(1, Math.round(d.cnt / 3)) }));
        const today = new Date().toISOString().slice(0, 10);
        points[points.length - 1] = { date: today, count: 4 };
        return {
          ok: true,
          data: { points, activeDaysThisWeek: 4, activeDaysThisMonth: 14 },
        };
      }

      case "lane_view_quota":
        return { ok: true, data: { used: 3, limit: 25 } };

      case "lane_view_record":
        return { ok: true, data: { used: 4, limit: 25 } };

      case "rts_check":
      case "triumph_check":
      case "apex_check": {
        const mc = String(msg.mc ?? payload.mc ?? "").replace(/\D/g, "");
        const byMc = mc ? DEMO_LOADS.find((l) => l.mcNumber.replace(/\D/g, "") === mc) : null;
        const load = byMc || this.matchLoad(payload);
        const grades = ["C", "B", "B+", "A-", "A"];
        return {
          ok: true,
          data: {
            grade: grades[Math.max(0, Math.min(4, load.creditStars - 1))],
            creditScore: 80 + Math.round(load.creditStars * 3),

            creditLimit: "$" + (25000 * load.creditStars).toLocaleString("en-US"),
            remaining: "$" + (18000 * load.creditStars).toLocaleString("en-US"),
            daysToPay: load.daysToPay,
            avgDaysToPay: load.daysToPay,
            status: "Approved",
            approved: true,
            name: load.company,
            company: load.company,
            mcNumber: load.mcNumber,
            domain: null,
          },
        };
      }

      case "apex_status":

        return { ok: true, data: { enabled: true, shown: true, tabOpen: true, connected: true } };

      case "triumph_status":

        return { ok: true, data: { enabled: false, shown: true, connected: false } };

      case "triumph_token":
        return { ok: true, data: { token: "demo" } };

      case "factoring_detect":
        return { ok: true, data: { provider: "rts", demo: true } };

      case "rts_open_login":
      case "triumph_open_login":
      case "apex_open_login":
      case "open_factoring_settings":
        this.emit({ kind: "blocked", what: "factoring sign-in" });
        return { ok: true, demo: true };

      case "auto_state":
        return {
          ok: true,
          data: { settings: this.autoSettings, notices: this.autoNotices, log: this.autoLog },
        };

      case "auto_settings":
        if (msg.settings !== undefined) this.autoSettings = msg.settings as Record<string, unknown>;
        return { ok: true, data: this.autoSettings };

      case "auto_already_sent":
        return { ok: true, sent: this.autoLedger.has(String(msg.sendKey || "")) };

      case "auto_claim": {
        const key = String(msg.sendKey || "");
        if (key && this.autoLedger.has(key)) return { ok: false, reason: "duplicate" };
        if (key) this.autoLedger.add(key);
        return { ok: true, hourLeft: 59, dayLeft: 499 };
      }

      case "auto_manual_send":
        if (msg.sendKey) this.autoLedger.add(String(msg.sendKey));
        return { ok: true };

      case "auto_budget":
        return { ok: true, data: { hour: 60, day: 500 } };

      case "auto_notice":
        this.autoNotices = [
          { kind: String(msg.kind || ""), text: String(msg.text || ""), at: Date.now() },
          ...this.autoNotices,
        ].slice(0, 50);
        return { ok: true };

      case "auto_notices_clear":
        this.autoNotices = [];
        return { ok: true };

      case "auto_sent":
        this.autoLog = [
          { ...((msg.entry as Record<string, unknown>) || {}), at: Date.now() },
          ...this.autoLog,
        ].slice(0, 100);
        return { ok: true };

      case "auto_log_clear":
        this.autoLog = [];
        return { ok: true };

      case "auto_runs":
        return { ok: true, runs: [...this.autoRuns.values()], tabId: 1 };

      case "auto_register": {
        const key = String(msg.key || "");
        this.autoRuns.set(key, {
          key,
          tabId: 1,
          until: Number(msg.until) || Date.now(),
          paused: false,
          sent: 0,
          label: String(msg.label || key),
        });
        return { ok: true };
      }

      case "auto_update": {
        const run = this.autoRuns.get(String(msg.key || ""));
        if (run) Object.assign(run, (msg.patch as Record<string, unknown>) || {});
        return { ok: true };
      }

      case "auto_unregister":
        this.autoRuns.delete(String(msg.key || ""));
        return { ok: true };

      case "auto_remote":
        this.autoRuns.delete(String(msg.key || ""));
        return { ok: true };

      case "saved_match_notify":
        return { ok: true };

      case "datx_email_click": {
        this.sentThisSession += 1;
        const context = (msg.context ?? payload.context ?? {}) as Record<string, unknown>;
        const list = ((this.data.templatesCache as { templates?: Template[] })?.templates ??
          DEMO_TEMPLATES) as Template[];
        const chosen =
          list.find((t) => String(t.id) === String(msg.templateId ?? payload.templateId)) ??
          list.find((t) => t.active) ??
          list[0];

        const subject = String(msg.customSubject ?? payload.subject ?? "") || fill(chosen?.subject, context);
        const body = String(msg.customBody ?? payload.body ?? "") || fill(chosen?.body, context);

        this.emit({
          kind: "email",
          to: String(msg.email ?? payload.email ?? context.email ?? ""),
          subject,
          body,
          from: DEMO_USER.email,
          broker: String(context.brokerName ?? "") || "the broker",
          template: chosen?.name ?? "Template",
          sentAt: new Date().toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        });
        return { ok: true, dedup: false, demo: true };
      }

      case "datx_phone_call":
        return { ok: true };

      case "datx_capture_loads":
      case "datx_flush_loads":
      case "datx_map_click":
      case "analytics_event":
        return { ok: true };

      default: {
        const passed = this.deliverToListeners(msg);
        if (passed) return passed;
        if (type) console.info("[demo] unmocked message:", type, msg);
        return { ok: true, demo: true };
      }
    }
  }

  api(path: string, options: { method?: string } = {}): { status: number; body: unknown } {
    const method = (options.method || "GET").toUpperCase();

    if (path.startsWith("/billing/cancel-subscription") && method === "POST") {
      if (this.cancelAtPeriodEnd) {
        return { status: 409, body: { code: 1012, message: "Already cancelled" } };
      }
      this.cancelAtPeriodEnd = true;
      return { status: 200, body: { ok: true, cancelAtPeriodEnd: true } };
    }

    if (path.startsWith("/billing/create-checkout-session") && method === "POST") {
      this.cancelAtPeriodEnd = false;
      this.emit({ kind: "blocked", what: "checkout" });
      return { status: 200, body: { ok: true, url: null, demo: true } };
    }

    if (path.startsWith("/billing/portal") && method === "POST") {
      this.emit({ kind: "blocked", what: "billing portal" });
      return { status: 200, body: { url: null, demo: true } };
    }

    console.info("[demo] unmocked API call:", method, path);
    return { status: 200, body: { ok: true, demo: true } };
  }

  private matchLoad(payload: Record<string, unknown>): DemoLoad {
    const origin = String(payload.origin ?? "").toLowerCase();
    const destination = String(payload.destination ?? "").toLowerCase();
    return (
      DEMO_LOADS.find(
        (l) => l.origin.toLowerCase() === origin && l.destination.toLowerCase() === destination,
      ) || DEMO_LOADS[0]
    );
  }

  private laneAverage(load: Record<string, unknown>): number | null {
    const match = this.matchLoad(load);
    return match ? match.marketRate : null;
  }

  private laneDelta(load: Record<string, unknown>): number | null {
    const avg = this.laneAverage(load);
    const offer = Number(load.offerPrice ?? load.rate ?? 0);
    return avg && offer ? avg - offer : null;
  }
}

export const demoRuntime = new DemoRuntime();

export function installChromeShim(target: Window & typeof globalThis): void {
  const runtime = demoRuntime;

  const chromeApi = {
    runtime: {
      id: "truckbox-demo",
      lastError: undefined as undefined | { message: string },
      getURL: (path: string) => `/demo/ext/${String(path).replace(/^\/+/, "")}`,
      getManifest: () => ({ version: "demo", name: "TruckBox" }),
      sendMessage: (msg: Msg, cb?: (r: Reply) => void) => {
        const answer = runtime.send(msg);

        if (typeof cb === "function") setTimeout(() => cb(answer), 0);
        return Promise.resolve(answer);
      },
      onMessage: {
        addListener: (fn: (msg: Msg, sender: unknown, reply: (r: Reply) => void) => void) =>
          runtime.addMessageListener(fn),
        removeListener: () => {},
      },
      onInstalled: { addListener: () => {} },
      connect: () => ({ postMessage: () => {}, onMessage: { addListener: () => {} }, disconnect: () => {} }),
    },
    storage: {
      local: {
        get: (keys: never, cb?: (items: Record<string, unknown>) => void) => {
          const items = runtime.get(keys);
          if (typeof cb === "function") setTimeout(() => cb(items), 0);
          return Promise.resolve(items);
        },
        set: (values: Record<string, unknown>, cb?: () => void) => {
          runtime.setMany(values);
          if (typeof cb === "function") setTimeout(cb, 0);
          return Promise.resolve();
        },
        remove: (keys: string | string[], cb?: () => void) => {
          runtime.remove(keys);
          if (typeof cb === "function") setTimeout(cb, 0);
          return Promise.resolve();
        },
        clear: (cb?: () => void) => {
          runtime.reset();
          if (typeof cb === "function") setTimeout(cb, 0);
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (fn: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void) =>
          runtime.addStorageListener(fn),
        removeListener: () => {},
      },
    },
    tabs: {
      create: (opts: { url?: string }) => {
        console.info("[demo] tabs.create suppressed:", opts?.url);
        return Promise.resolve({ id: 1 });
      },
      query: (_q: unknown, cb?: (tabs: unknown[]) => void) => {
        if (typeof cb === "function") setTimeout(() => cb([{ id: 1, url: location.href }]), 0);
        return Promise.resolve([{ id: 1, url: location.href }]);
      },
      update: () => Promise.resolve({ id: 1 }),
      sendMessage: (_id: number, msg: Msg, cb?: (r: Reply) => void) => {
        const answer = runtime.send(msg);
        if (typeof cb === "function") setTimeout(() => cb(answer), 0);
        return Promise.resolve(answer);
      },
    },
    identity: {
      getRedirectURL: () => location.origin + "/demo",
      launchWebAuthFlow: (_o: unknown, cb?: (url?: string) => void) => {
        if (typeof cb === "function") cb(undefined);
      },
    },
  };

  (target as unknown as { chrome: unknown }).chrome = chromeApi;

  target.confirm = () => true;

  const realFetch = target.fetch?.bind(target);
  target.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const apiPath = url.match(/\/api\/v1(\/.*)$/)?.[1];
    const mocked = apiPath && !apiPath.startsWith("/public/");
    if (!mocked) {
      return realFetch ? realFetch(input as RequestInfo, init) : Promise.reject(new Error("offline"));
    }
    const answer = runtime.api(apiPath as string, { method: init?.method });
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}
