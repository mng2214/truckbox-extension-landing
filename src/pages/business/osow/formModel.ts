/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Form state → the numbers the calculator, the schematic and the 3D model use. Pure, so the panel can
// derive everything with one useMemo and the visuals update on every keystroke.

import {
  LEGAL,
  RIGS,
  overallDims,
  rigById,
  rigLayout,
  suggestRig,
  withEdits,
  type Cargo,
  type Rig,
  type RigLayout,
} from "./equipment";
import { formatFtIn, formatLb, parseLengthIn, parseWeightLb } from "./parseDims";
import type { DimKey, EscortCosts, FormSnapshot, LoadSpec } from "./types";

export const DIM_KEYS: DimKey[] = [
  "widthIn",
  "heightIn",
  "lengthIn",
  "frontOverhangIn",
  "rearOverhangIn",
  "grossLb",
  "axles",
];

export const DIM_LABEL: Record<DimKey, string> = {
  widthIn: "Width",
  heightIn: "Height",
  lengthIn: "Length",
  frontOverhangIn: "Front overhang",
  rearOverhangIn: "Rear overhang",
  grossLb: "Gross weight",
  axles: "Axles",
};

export function emptyForm(): FormSnapshot {
  return {
    origin: "",
    destination: "",
    mode: "cargo",
    cargo: { length: "", width: "", height: "", weight: "", frontOffset: "" },
    rigId: RIGS[0].id,
    rigAuto: true,
    rigEdits: {},
    overrides: {},
    manual: {
      widthIn: "",
      heightIn: "",
      lengthIn: "",
      frontOverhangIn: "0",
      rearOverhangIn: "0",
      grossLb: "",
      axles: "5",
    },
    axlesOverLegal: false,
  };
}

export function rigForEquipment(equipment: string, lengthFt: number | null): string | null {
  const code = equipment.trim().toUpperCase();
  const longTrailer = lengthFt != null && lengthFt >= 53;
  if (/^(FH|HS)/.test(code)) return "hotshot";
  if (/RGN|^LB|^LO/.test(code)) return "rgn2";
  if (/DD/.test(code)) return "dd48";
  if (/SD/.test(code)) return longTrailer ? "step53" : "step48";
  if (/^(F|CN|CONG|MX|HS|LA)/.test(code)) return longTrailer ? "flat53" : "flat48";
  return null;
}

export function applyLoadLink(form: FormSnapshot, params: URLSearchParams): FormSnapshot | null {
  const origin = (params.get("origin") ?? "").trim().slice(0, 120);
  const destination = (params.get("destination") ?? "").trim().slice(0, 120);
  if (!origin && !destination) return null;
  const weight = (params.get("weight") ?? "").replace(/\D/g, "").slice(0, 7);
  const lengthFt = Number((params.get("length") ?? "").replace(/\D/g, "")) || null;
  const namedRig = RIGS.some((rig) => rig.id === params.get("rig")) ? params.get("rig") : null;
  const rigId = namedRig ?? rigForEquipment(params.get("equipment") ?? "", lengthFt);
  const dimension = (key: string) => (params.get(key) ?? "").trim().slice(0, 16);
  return {
    ...form,
    origin: origin || form.origin,
    destination: destination || form.destination,
    mode: "cargo",
    cargo: {
      ...form.cargo,
      length: dimension("cargoLength") || form.cargo.length,
      width: dimension("width") || form.cargo.width,
      height: dimension("height") || form.cargo.height,
      weight: weight || form.cargo.weight,
    },
    rigId: rigId ?? form.rigId,
    rigAuto: rigId ? false : form.rigAuto,
  };
}

export function parseDim(key: DimKey, raw: string | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  switch (key) {
    case "lengthIn":
      return parseLengthIn(s, "length");
    case "frontOverhangIn":
    case "rearOverhangIn":
      return parseLengthIn(s, "overhang");
    case "grossLb":
      return parseWeightLb(s);
    case "axles": {
      const n = Number(s);
      return Number.isInteger(n) ? n : null;
    }
    default:
      return parseLengthIn(s, "width");
  }
}

export function formatDim(key: DimKey, v: number | null | undefined): string {
  if (v == null) return "";
  if (key === "grossLb") return formatLb(v);
  if (key === "axles") return String(v);
  if ((key === "frontOverhangIn" || key === "rearOverhangIn") && v === 0) return "0";
  return formatFtIn(v);
}

export type CargoKey = keyof FormSnapshot["cargo"];

export type Derived = {
  rig: Rig;
  suggested: Rig | null;
  cargo: Cargo | null;
  cargoValues: Record<CargoKey, number | null>;
  cargoErrors: Partial<Record<CargoKey, string>>;
  computed: Record<DimKey, number> | null;
  values: Record<DimKey, number | null>;
  display: Record<DimKey, string>;
  errors: Partial<Record<DimKey, string>>;
  load: LoadSpec | null;
  layout: RigLayout;
  /** The box the visuals draw on the deck (cargo mode: the cargo; overall mode: the envelope). */
  visualCargo: { lengthIn: number; widthIn: number; heightIn: number; x0: number; baseIn: number } | null;
};

function cargoValues(form: FormSnapshot): Record<CargoKey, number | null> {
  const c = form.cargo;
  return {
    length: c.length.trim() ? parseLengthIn(c.length, "length") : null,
    width: c.width.trim() ? parseLengthIn(c.width, "width") : null,
    height: c.height.trim() ? parseLengthIn(c.height, "height") : null,
    weight: c.weight.trim() ? parseWeightLb(c.weight) : null,
    frontOffset: c.frontOffset.trim() ? parseLengthIn(c.frontOffset, "overhang") : 0,
  };
}

export function editedRigs(form: FormSnapshot): Rig[] {
  return RIGS.map((r) => withEdits(r, form.rigEdits[r.id]));
}

/** Upper bounds, the same as the server's (OsowCalculator.toLoadSpec). */
const OVERALL_MAX: Record<DimKey, number> = {
  widthIn: 1200,
  heightIn: 600,
  lengthIn: 3600,
  frontOverhangIn: 1200,
  rearOverhangIn: 1200,
  grossLb: 1_500_000,
  axles: 20,
};
const OVERALL_MAX_TEXT: Record<DimKey, string> = {
  widthIn: "At most 100 ft",
  heightIn: "At most 50 ft",
  lengthIn: "At most 300 ft",
  frontOverhangIn: "At most 100 ft",
  rearOverhangIn: "At most 100 ft",
  grossLb: "At most 1,500,000 lb",
  axles: "2 to 20",
};
const CARGO_MAX: Record<CargoKey, number> = {
  length: 3600,
  width: 1200,
  height: 600,
  weight: 1_500_000,
  frontOffset: 1200,
};
const CARGO_MAX_TEXT: Record<CargoKey, string> = {
  length: "At most 300 ft",
  width: "At most 100 ft",
  height: "At most 50 ft",
  weight: "At most 1,500,000 lb",
  frontOffset: "At most 100 ft",
};

export function deriveLoad(form: FormSnapshot): Derived {
  const rigs = editedRigs(form);
  const cv = cargoValues(form);
  const cargoErrors: Partial<Record<CargoKey, string>> = {};
  (Object.keys(cv) as CargoKey[]).forEach((k) => {
    const raw = form.cargo[k].trim();
    if (raw && cv[k] == null) cargoErrors[k] = "Can't read this";
    else if (k !== "frontOffset" && cv[k] != null && (cv[k] as number) <= 0) cargoErrors[k] = "Must be above zero";
    else if (cv[k] != null && (cv[k] as number) > CARGO_MAX[k]) cargoErrors[k] = CARGO_MAX_TEXT[k];
  });

  const cargoReady = cv.length != null && cv.width != null && cv.height != null && cv.weight != null;
  const cargo: Cargo | null = cargoReady
    ? {
        lengthIn: cv.length as number,
        widthIn: cv.width as number,
        heightIn: cv.height as number,
        weightLb: cv.weight as number,
        frontOffsetIn: cv.frontOffset ?? 0,
      }
    : null;

  const suggested = cargo ? suggestRig(cargo, rigs) : null;
  const rig =
    form.rigAuto && suggested ? suggested : (rigs.find((r) => r.id === form.rigId) ?? withEdits(rigById(form.rigId), form.rigEdits[form.rigId]));

  let computed: Record<DimKey, number> | null = null;
  let layout: RigLayout;
  if (form.mode === "cargo" && cargo) {
    const o = overallDims(cargo, rig);
    layout = o.layout;
    computed = {
      widthIn: o.widthIn,
      heightIn: o.heightIn,
      lengthIn: o.lengthIn,
      frontOverhangIn: o.frontOverhangIn,
      rearOverhangIn: o.rearOverhangIn,
      grossLb: o.grossLb,
      axles: o.axles,
    };
  } else {
    layout = rigLayout(rig, { lengthIn: cv.length ?? 0, frontOffsetIn: cv.frontOffset ?? 0 });
  }

  const values = {} as Record<DimKey, number | null>;
  const display = {} as Record<DimKey, string>;
  const errors: Partial<Record<DimKey, string>> = {};
  for (const k of DIM_KEYS) {
    let raw: string | undefined;
    if (form.mode === "cargo") {
      raw = form.overrides[k];
      if (raw == null) {
        values[k] = computed ? computed[k] : null;
        display[k] = computed ? formatDim(k, computed[k]) : "";
        continue;
      }
    } else {
      raw = form.manual[k];
    }
    display[k] = raw ?? "";
    const v = parseDim(k, raw);
    values[k] = v;
    if ((raw ?? "").trim() && v == null) errors[k] = "Can't read this";
  }

  for (const k of ["widthIn", "heightIn", "lengthIn", "grossLb"] as DimKey[]) {
    if (values[k] != null && (values[k] as number) <= 0) errors[k] = "Must be above zero";
  }
  for (const k of DIM_KEYS) {
    if (!errors[k] && values[k] != null && (values[k] as number) > OVERALL_MAX[k]) errors[k] = OVERALL_MAX_TEXT[k];
  }
  if (values.axles != null && (values.axles < 2 || values.axles > 20)) errors.axles = "2 to 20";

  const required: DimKey[] = ["widthIn", "heightIn", "lengthIn", "grossLb", "axles"];
  const ready = required.every((k) => values[k] != null) && Object.keys(errors).length === 0;
  const load: LoadSpec | null = ready
    ? {
        widthIn: Math.round(values.widthIn as number),
        heightIn: Math.round(values.heightIn as number),
        lengthIn: Math.round(values.lengthIn as number),
        frontOverhangIn: Math.round(values.frontOverhangIn ?? 0),
        rearOverhangIn: Math.round(values.rearOverhangIn ?? 0),
        grossLb: Math.round(values.grossLb as number),
        axles: values.axles as number,
      }
    : null;

  let visualCargo: Derived["visualCargo"] = null;
  if (form.mode === "cargo" && cargo) {
    visualCargo = {
      lengthIn: cargo.lengthIn,
      widthIn: cargo.widthIn,
      heightIn: cargo.heightIn,
      x0: layout.cargoX0,
      baseIn: layout.cargoBaseIn,
    };
  } else if (form.mode === "overall" && values.heightIn != null && values.widthIn != null && values.lengthIn != null) {
    const x0 = layout.cargoX0;
    const end = Math.max(values.lengthIn, x0 + 24);
    visualCargo = {
      lengthIn: end - x0,
      widthIn: values.widthIn,
      heightIn: Math.max(6, values.heightIn - layout.cargoBaseIn),
      x0,
      baseIn: layout.cargoBaseIn,
    };
  }

  return {
    rig,
    suggested,
    cargo,
    cargoValues: cv,
    cargoErrors,
    computed,
    values,
    display,
    errors,
    load,
    layout,
    visualCargo,
  };
}

export type LimitNote = { over: boolean; text: string };

/** The legal-limit hint under each overall field. Limits vary by state; these are the common ones. */
const PICKUP_COMBINATION_IN = 780;

export function limitNote(key: DimKey, v: number | null, rig: Pick<Rig, "tractorLengthIn" | "towVehicle">): LimitNote | null {
  switch (key) {
    case "widthIn":
      return v != null && v > LEGAL.widthIn
        ? { over: true, text: `+${formatFtIn(v - LEGAL.widthIn)} over 8' 6"` }
        : { over: false, text: `Legal 8' 6"` };
    case "heightIn":
      return v != null && v > LEGAL.heightIn
        ? { over: true, text: `+${formatFtIn(v - LEGAL.heightIn)} over 13' 6"` }
        : { over: false, text: `Legal 13' 6" in most states` };
    case "lengthIn": {
      if (rig.towVehicle === "pickup") {
        return v != null && v > PICKUP_COMBINATION_IN
          ? { over: false, text: "Many states cap pickup + trailer at 65'" }
          : { over: false, text: "Bumper to rear" };
      }
      const trailer = v != null ? v - rig.tractorLengthIn : null;
      return trailer != null && trailer > LEGAL.trailerLengthIn
        ? { over: true, text: `${formatFtIn(trailer)} past tractor > 53'` }
        : { over: false, text: "Bumper to rear" };
    }
    case "rearOverhangIn":
      return v != null && v > 48 ? { over: true, text: "Flag & lights needed" } : { over: false, text: "Past trailer end" };
    case "grossLb":
      return v != null && v > LEGAL.grossLb
        ? { over: true, text: `+${formatLb(v - LEGAL.grossLb)} over 80,000` }
        : { over: false, text: "Legal 80,000 lb" };
    default:
      return null;
  }
}

/** The cost settings typed as numbers; the escort car count is a choice, kept apart. */
export type CostKey = Exclude<keyof EscortCosts, "escortCars">;

export type CostText = Record<CostKey, string>;

/** null = each state's rules; 0 = none priced (someone else provides them); 1-4 = cars on the whole route. */
export const ESCORT_CAR_CHOICES: (number | null)[] = [null, 0, 1, 2, 3, 4];

/** The settings card's sections: what escort cars cost, what police cost, how fast the truck goes. */
export type CostGroup = "escorts" | "police" | "trip";

export const COST_FIELDS: { key: CostKey; label: string; group: CostGroup; pre?: string; post?: string; hint?: string }[] = [
  { key: "escortRatePerMile", label: "Rate per car", group: "escorts", pre: "$", post: "/mi" },
  { key: "escortHotelPerNight", label: "Hotel per car", group: "escorts", pre: "$", post: "/night" },
  { key: "policeCostEach", label: "Police escort", group: "police", pre: "$", post: "each", hint: "Each police escort a state requires" },
  {
    key: "averageMph",
    label: "Truck average speed",
    group: "trip",
    post: "mph",
    hint: "Sets trip days and escort nights",
  },
];

export const DEFAULT_COSTS: Record<CostKey, number> = {
  escortRatePerMile: 2,
  escortHotelPerNight: 120,
  policeCostEach: 0,
  averageMph: 45,
};

/** Text fields → numbers, falling back to the defaults for blanks and junk. */
export function costsFromText(text: CostText): Record<CostKey, number> {
  const costs = { ...DEFAULT_COSTS };
  for (const key of Object.keys(DEFAULT_COSTS) as CostKey[]) {
    const raw = String(text[key] ?? "");
    const value = Number(raw.replace(/[$,\s]/g, ""));
    if (raw.trim() !== "" && Number.isFinite(value) && value >= 0) costs[key] = value;
  }
  if (costs.averageMph < 15 || costs.averageMph > 70) costs.averageMph = DEFAULT_COSTS.averageMph;
  return costs;
}

export function costsToText(costs: Record<CostKey, number>): CostText {
  return {
    escortRatePerMile: costs.escortRatePerMile.toFixed(2),
    escortHotelPerNight: String(costs.escortHotelPerNight),
    policeCostEach: String(costs.policeCostEach),
    averageMph: String(costs.averageMph),
  };
}

/** The next weekday after today, as an ISO date in the browser's local time. */
export function nextWeekday(from: Date = new Date()): string {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}
