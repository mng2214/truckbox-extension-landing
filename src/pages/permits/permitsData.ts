/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import stateIndex from "../../data/osow-states/index.json";

export type FeeLine = { kind: string; when: string; amount: string | null; note: string | null };
export type EscortLine = { when: string; front: number; rear: number; note: string | null };
export type Line = { when: string; text: string | null };
export type TravelLine = {
  when: string;
  daylightOnly: boolean;
  weekends: string | null;
  holidays: string | null;
  holidayNames: string[];
  closures: string[];
  note: string | null;
};

export type StatePage = {
  code: string;
  name: string;
  slug: string;
  verified: boolean;
  verifiedOn: string | null;
  researchedOn: string | null;
  legal: {
    width: string | null;
    height: string | null;
    length: string | null;
    trailerLength: string | null;
    gross: string | null;
  };
  office: { name: string; url: string | null; phone: string | null; orderUrl: string | null } | null;
  fees: FeeLine[];
  escorts: EscortLine[];
  police: Line[];
  survey: Line[];
  superload: Line[];
  restrictions: Line[];
  travel: TravelLine[];
  sources: { title: string; url: string }[];
  notes: string[];
};

export type StateEntry = Pick<StatePage, "code" | "name" | "slug" | "verified" | "verifiedOn" | "researchedOn"> & {
  sourceCount: number;
};

export const STATE_INDEX = stateIndex as StateEntry[];

const STATE_FILES = import.meta.glob<StatePage>("../../data/osow-states/*.json", { import: "default" });

export const LANDING_PATH = "/osow-permits";
export const CALCULATOR_PATH = "/business/osow";

export const statePath = (slug: string) => `/osow-permits/${slug}`;
export const flagPath = (slug: string) => `/flags/${slug}.webp`;

export function stateEntry(slug: string | undefined): StateEntry | undefined {
  return STATE_INDEX.find((entry) => entry.slug === slug);
}

export function loadState(slug: string): Promise<StatePage> {
  const load = STATE_FILES[`../../data/osow-states/${slug}.json`];
  if (!load || !stateEntry(slug)) return Promise.reject(new Error(`No state page for ${slug}`));
  return load();
}

export function readableDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const VERIFIED_COUNT = STATE_INDEX.filter((entry) => entry.verified).length;

export const SOURCE_COUNT = STATE_INDEX.reduce((sum, entry) => sum + entry.sourceCount, 0);

export const LAST_CHECKED = readableDate(
  STATE_INDEX.map((entry) => entry.verifiedOn ?? "")
    .filter(Boolean)
    .sort()
    .at(-1) ?? null,
);
