/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Typical open-deck rigs and the geometry that turns cargo dims into overall (permit) dims.
// Everything is inches and pounds. The x axis runs from the tractor's front bumper (0) to the rear;
// heights are measured from the ground. The 2D schematic and the 3D model both draw from rigLayout()
// so the picture and the numbers sent to /calculate can never disagree.

export type RigKind = "flatbed" | "stepdeck" | "doubledrop" | "rgn";

export type Rig = {
  id: string;
  label: string;
  kind: RigKind;
  /** Loading height: the deck, the lower deck or the well. */
  deckHeightIn: number;
  /** Trailer length, front to rear. */
  deckLengthIn: number;
  /** Usable length at deckHeightIn when it is shorter than the trailer (lower deck / well). */
  wellLengthIn?: number;
  /** Stretch rigs: the loading length can extend up to this. */
  stretchToIn?: number;
  /** Bumper to the trailer's front edge. */
  tractorLengthIn: number;
  /** Tractor + trailer empty weight. */
  tareLb: number;
  axles: number;
  towVehicle?: "tractor" | "pickup";
  autoPick?: boolean;
};

export type RigSpecKey = "deckHeightIn" | "deckLengthIn" | "tractorLengthIn" | "tareLb" | "axles";

export const TRACTOR_LENGTH_IN = 240;
export const PICKUP_TO_DECK_IN = 312;

export const PICKUP = {
  frontAxleX: 38,
  rearAxleX: 214,
  wheelR: 16,
  ballX: 208,
  bedEndX: 262,
} as const;
export const UPPER_DECK_IN = 60;
export const REAR_DECK_IN = 40;
const RGN_NECK_IN = 120;

export const LEGAL = {
  widthIn: 102,
  heightIn: 162,
  trailerLengthIn: 636,
  grossLb: 80_000,
} as const;

/** Typical specs. Every number is editable in the form — rigs vary a lot between fleets. */
export const RIGS: Rig[] = [
  { id: "flat48", label: "Flatbed 48'", kind: "flatbed", deckHeightIn: 60, deckLengthIn: 576, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 32_000, axles: 5 },
  { id: "flat53", label: "Flatbed 53'", kind: "flatbed", deckHeightIn: 60, deckLengthIn: 636, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 33_000, axles: 5 },
  { id: "hotshot", label: "Hot shot 40'", kind: "flatbed", deckHeightIn: 37, deckLengthIn: 480, tractorLengthIn: PICKUP_TO_DECK_IN, tareLb: 16_000, axles: 4, towVehicle: "pickup", autoPick: false },
  { id: "step48", label: "Step deck 48'", kind: "stepdeck", deckHeightIn: 42, deckLengthIn: 576, wellLengthIn: 444, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 33_000, axles: 5 },
  { id: "step53", label: "Step deck 53'", kind: "stepdeck", deckHeightIn: 42, deckLengthIn: 636, wellLengthIn: 504, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 34_000, axles: 5 },
  { id: "dd48", label: "Double drop 48'", kind: "doubledrop", deckHeightIn: 24, deckLengthIn: 576, wellLengthIn: 348, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 38_000, axles: 5 },
  { id: "rgn2", label: "RGN 2-axle 48'", kind: "rgn", deckHeightIn: 24, deckLengthIn: 576, wellLengthIn: 348, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 40_000, axles: 5 },
  { id: "rgn3", label: "RGN 3-axle", kind: "rgn", deckHeightIn: 24, deckLengthIn: 612, wellLengthIn: 348, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 44_000, axles: 6 },
  { id: "stretchflat", label: "Stretch flatbed", kind: "flatbed", deckHeightIn: 60, deckLengthIn: 576, stretchToIn: 960, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 36_000, axles: 5 },
  { id: "stretchrgn", label: "Stretch RGN", kind: "rgn", deckHeightIn: 24, deckLengthIn: 636, wellLengthIn: 348, stretchToIn: 600, tractorLengthIn: TRACTOR_LENGTH_IN, tareLb: 48_000, axles: 7 },
];

export function rigById(id: string): Rig {
  return RIGS.find((r) => r.id === id) ?? RIGS[0];
}

/** A library rig with the user's edits applied (edits are kept per rig id). */
export function withEdits(rig: Rig, edits: Partial<Record<RigSpecKey, number>> | undefined): Rig {
  if (!edits) return rig;
  const next = { ...rig };
  for (const k of Object.keys(edits) as RigSpecKey[]) {
    const v = edits[k];
    if (v != null && Number.isFinite(v) && v >= 0) next[k] = v;
  }
  return next;
}

export type Cargo = {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLb: number;
  /** How far behind the front of the loading area the cargo sits. */
  frontOffsetIn?: number;
};

export type DeckSegment = { x0: number; x1: number; topIn: number; kind: "deck" | "neck" | "well" };

export type RigLayout = {
  tractorLengthIn: number;
  trailerStartIn: number;
  trailerEndIn: number;
  /** Deck surfaces front to rear (top heights). */
  segments: DeckSegment[];
  /** Where the cargo sits. */
  cargoX0: number;
  cargoX1: number;
  cargoBaseIn: number;
  /** Trailer axle centers (x). */
  trailerAxlesX: number[];
  /** False when the cargo is too long for a bounded well and rides on the upper decks instead. */
  inWell: boolean;
  stretchedIn: number;
};

function loadingLength(rig: Rig): number {
  if (rig.kind === "flatbed") return rig.deckLengthIn;
  return Math.min(rig.wellLengthIn ?? rig.deckLengthIn, rig.deckLengthIn);
}

/** Trailer axle centers are this far apart (4 ft, typical for heavy-haul axle groups). */
const AXLE_SPACING_IN = 48;
/**
 * From the outermost axle centers to the ends of the deck section that sits over them: enough to
 * keep every tire under the deck, short enough that a 4-axle stretch RGN still draws at its 53'.
 */
const AXLE_DECK_MARGIN_IN = 24;
/** Shortest gooseneck an RGN can be drawn with before the trailer has to grow instead. */
const MIN_RGN_NECK_IN = 96;

function trailerAxleCount(rig: Rig): number {
  return Math.max(1, Math.min(5, rig.axles - (rig.towVehicle === "pickup" ? 2 : 3)));
}

/** Axle centers spread evenly around `center`. */
function axleGroup(count: number, center: number): number[] {
  const first = center - ((count - 1) * AXLE_SPACING_IN) / 2;
  return Array.from({ length: count }, (_, axleIndex) => first + axleIndex * AXLE_SPACING_IN);
}

/** Lays the rig and the cargo out along the x axis. */
export function rigLayout(rig: Rig, cargo: Pick<Cargo, "lengthIn" | "frontOffsetIn">): RigLayout {
  const tractorLength = Math.max(0, rig.tractorLengthIn);
  const offset = Math.max(0, cargo.frontOffsetIn ?? 0);
  const cargoLength = Math.max(0, cargo.lengthIn);
  const baseLoadLength = loadingLength(rig);
  const neededLength = offset + cargoLength;
  const loadLength =
    rig.stretchToIn != null
      ? Math.min(Math.max(baseLoadLength, neededLength), Math.max(rig.stretchToIn, baseLoadLength))
      : baseLoadLength;
  const stretch = loadLength - baseLoadLength;
  const start = tractorLength;
  const deckHeight = rig.deckHeightIn;
  const axleCount = trailerAxleCount(rig);
  const axleDeckLength = (axleCount - 1) * AXLE_SPACING_IN + 2 * AXLE_DECK_MARGIN_IN;

  const segments: DeckSegment[] = [];
  let trailerLength = rig.deckLengthIn + stretch;
  let loadX0 = start;
  let inWell = true;
  let cargoBase = deckHeight;
  let axles: number[];

  if (rig.kind === "flatbed") {
    segments.push({ x0: start, x1: start + trailerLength, topIn: deckHeight, kind: "deck" });
    axles = axleGroup(axleCount, start + trailerLength - 48 - ((axleCount - 1) * AXLE_SPACING_IN) / 2);
  } else if (rig.kind === "stepdeck") {
    const upper = Math.max(0, trailerLength - loadLength);
    segments.push({ x0: start, x1: start + upper, topIn: Math.max(UPPER_DECK_IN, deckHeight), kind: "deck" });
    segments.push({ x0: start + upper, x1: start + trailerLength, topIn: deckHeight, kind: "well" });
    loadX0 = start + upper;
    axles = axleGroup(axleCount, start + trailerLength - 48 - ((axleCount - 1) * AXLE_SPACING_IN) / 2);
  } else {
    // Double drop and RGN: a raised front (deck or gooseneck), the low well, and a rear deck long
    // enough to sit over every trailer axle. When the parts don't fit the rig's nominal length the
    // front gives way first, then the trailer grows — the axles never end up under the well.
    const outsideWell = Math.max(0, trailerLength - loadLength);
    let front: number;
    let rear: number;
    if (rig.kind === "rgn") {
      front = Math.max(MIN_RGN_NECK_IN, Math.min(RGN_NECK_IN, outsideWell - axleDeckLength));
      rear = Math.max(axleDeckLength, outsideWell - front);
    } else {
      rear = Math.max(axleDeckLength, Math.round(outsideWell * 0.45));
      front = Math.max(0, outsideWell - rear);
    }
    trailerLength = front + loadLength + rear;
    const frontTop = Math.max(UPPER_DECK_IN, deckHeight);
    const rearTop = Math.max(REAR_DECK_IN, deckHeight);
    const wellStart = start + front;
    const rearStart = wellStart + loadLength;
    segments.push({ x0: start, x1: wellStart, topIn: frontTop, kind: rig.kind === "rgn" ? "neck" : "deck" });
    segments.push({ x0: wellStart, x1: rearStart, topIn: deckHeight, kind: "well" });
    segments.push({ x0: rearStart, x1: rearStart + rear, topIn: rearTop, kind: "deck" });
    axles = axleGroup(axleCount, rearStart + rear / 2);
    loadX0 = wellStart;
    if (neededLength > loadLength + 0.5) {
      inWell = false;
      if (rig.kind === "rgn") {
        // Nothing rides on a detachable gooseneck: the cargo starts at the well and bridges onto
        // the rear deck, blocked up to its height.
        cargoBase = rearTop;
      } else {
        loadX0 = start;
        cargoBase = frontTop;
      }
    }
  }

  const cargoX0 = loadX0 + offset;
  return {
    tractorLengthIn: tractorLength,
    trailerStartIn: start,
    trailerEndIn: start + trailerLength,
    segments,
    cargoX0,
    cargoX1: cargoX0 + cargoLength,
    cargoBaseIn: cargoBase,
    trailerAxlesX: axles,
    inWell,
    stretchedIn: stretch,
  };
}

export type OverallDims = {
  widthIn: number;
  heightIn: number;
  lengthIn: number;
  frontOverhangIn: number;
  rearOverhangIn: number;
  grossLb: number;
  axles: number;
};

/**
 * Cargo + rig → the dims a permit is priced on: width = max(cargo, 102"), height = cargo + the deck
 * it rides on, length = max(rig, where the cargo ends), gross = cargo + tare, axles from the rig.
 * Rear overhang is how far the cargo hangs past the trailer's rear.
 */
export function overallDims(cargo: Cargo, rig: Rig): OverallDims & { layout: RigLayout } {
  const layout = rigLayout(rig, cargo);
  const lengthIn = Math.max(layout.trailerEndIn, layout.cargoX1);
  return {
    widthIn: Math.max(Math.round(cargo.widthIn), LEGAL.widthIn),
    heightIn: Math.round(cargo.heightIn + layout.cargoBaseIn),
    lengthIn: Math.round(lengthIn),
    frontOverhangIn: 0,
    rearOverhangIn: Math.round(Math.max(0, layout.cargoX1 - layout.trailerEndIn)),
    grossLb: Math.round(cargo.weightLb + rig.tareLb),
    axles: rig.axles,
    layout,
  };
}

/**
 * The highest deck that keeps the load at or under 13'6"; when nothing does, the lowest deck.
 * Ties go to a rig the cargo fits in (well, then length), then to the lighter rig.
 */
export function suggestRig(cargo: Cargo, rigs: Rig[] = RIGS): Rig {
  const candidates = rigs.filter((rig) => rig.autoPick !== false);
  if (!candidates.length) return RIGS[0];
  const scored = candidates.map((rig) => {
    const o = overallDims(cargo, rig);
    return { rig, o, fitsWell: o.layout.inWell, fitsLength: o.rearOverhangIn === 0 };
  });
  const legal = scored.filter((s) => s.o.heightIn <= LEGAL.heightIn);
  const pool = legal.length ? legal : scored;
  const deckOf = (s: (typeof scored)[number]) => s.o.heightIn - cargo.heightIn;
  pool.sort((a, b) => {
    const byDeck = legal.length ? deckOf(b) - deckOf(a) : deckOf(a) - deckOf(b);
    if (byDeck !== 0) return byDeck;
    if (a.fitsWell !== b.fitsWell) return a.fitsWell ? -1 : 1;
    if (a.fitsLength !== b.fitsLength) return a.fitsLength ? -1 : 1;
    if (a.o.rearOverhangIn !== b.o.rearOverhangIn) return a.o.rearOverhangIn - b.o.rearOverhangIn;
    return a.rig.tareLb - b.rig.tareLb;
  });
  return pool[0].rig;
}
