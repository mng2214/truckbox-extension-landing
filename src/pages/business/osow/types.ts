/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Shapes of /api/v1/osow (see the OS/OW plan's "API contract"). Units: inches, pounds, USD, miles.

export type RoadClass = "interstate" | "non_interstate";
export type RoadUsed = RoadClass | "mixed";
export type Smoothing = "raw" | "conservative" | "full_carry";
export type QuoteMode = "carrier" | "broker";

export type LoadSpec = {
  widthIn: number;
  heightIn: number;
  lengthIn: number;
  frontOverhangIn: number;
  rearOverhangIn: number;
  grossLb: number;
  axles: number;
};

/** What /calculate receives: the dims plus whether an axle group is over its legal weight. */
export type LoadInput = LoadSpec & { axlesOverLegal?: boolean };

export type EscortCosts = {
  escortRatePerMile: number;
  escortHotelPerNight: number;
  policeCostEach: number;
  /** Loaded oversize rig's average moving speed; the trip plan runs on it. */
  averageMph: number;
  /** Escort cars on the whole route when the shipper or broker sets it; null = each state's rules. */
  escortCars?: number | null;
};

export type CalculateRequest = {
  origin: string;
  destination: string;
  load: LoadInput;
  roadOverrides: Record<string, RoadClass>;
  smoothing: Smoothing;
  costs: EscortCosts;
  /** ISO date (origin's local date). */
  pickupDate: string;
  /** "HH:mm", origin's local time. */
  pickupTime: string;
};

export type FeeLine = {
  id: string;
  kind: string;
  /** null = set by the state case by case (a "manual" line). */
  amount: number | null;
  note: string | null;
  src: string | null;
};

export type EscortCount = { front: number; rear: number };

export type Source = { id: string; title: string; url: string };

export type PermitOffice = {
  name: string | null;
  url: string | null;
  phone: string | null;
  /** The state's online ordering system, when we have a verified link. */
  orderUrl?: string | null;
};

export type StateRow = {
  state: string;
  name: string;
  covered: boolean;
  status: string | null;
  researchedOn: string | null;
  verifiedOn: string | null;
  miles: number;
  interstateMiles: number;
  otherMiles: number;
  roadUsed: RoadUsed;
  fees: FeeLine[] | null;
  permitTotal: number | null;
  permitComplete: boolean;
  escortsInterstate: EscortCount | null;
  escortsOther: EscortCount | null;
  escortVehicleMiles: number;
  policeCount: number;
  policeNotes: string[] | null;
  survey: boolean;
  superload: boolean;
  restrictions: string[] | null;
  notes: string[] | null;
  sources: Source[] | null;
  permitOffice: PermitOffice | null;
};

export type Totals = {
  permits: number;
  escorts: number;
  escortVehicleMiles: number;
  escortNights: number;
  police: number;
  total: number;
  complete: boolean;
  unpricedLines: number;
};

export type Flags = { superload: boolean; survey: boolean; police: boolean };

export type WarningCode =
  | "ROUTING_UNAVAILABLE"
  | "GEOCODE_FAILED"
  | "ROUTE_NOT_FOUND"
  | "ROUTE_IGNORES_CLEARANCE"
  | "UNCOVERED_STATE"
  | "DRAFT_DATA"
  | "UNPRICED_FEES";

export type OsowWarning = { code: WarningCode | string; message: string | null; state: string | null };

export type HoldReason = "NIGHT" | "CURFEW" | "WEEKEND" | "HOLIDAY" | "HOS_REST" | "HOS_RESTART";

export type TripDay = {
  date: string;
  miles: number;
  driveHours: number;
  states: string[];
  /** Every reason the load stood still that day. */
  holds: HoldReason[];
  /** Set only when the load didn't move at all that day. */
  holdReason: HoldReason | null;
  escorted: boolean;
};

export type TripPlan = {
  days: TripDay[];
  transitDays: number;
  holdDays: number;
  /** Local date-times, "2026-10-09T08:00". */
  pickup: string;
  arrival: string;
  driveHours: number;
  escortNights: number;
  /** Where the load stands still, in route order. Missing in quotes saved before stops existed. */
  stops?: TripStop[];
};

export type TripStop = {
  /** Miles from the origin along the route. */
  routeMile: number;
  /** The state whose rules (or the driver's hours) hold the load there. */
  state: string;
  /** The load waits at the border before entering that state. */
  atStateLine: boolean;
  /** Local date-times in that state, "2026-10-09T20:00". */
  start: string;
  end: string;
  hours: number;
  /** The longest of the reasons. */
  reason: HoldReason;
  reasons: HoldReason[];
};

export type CalculateResponse = {
  routeMiles: number;
  routeSource: string | null;
  polylines: string[] | null;
  states: StateRow[];
  totals: Totals;
  flags: Flags;
  warnings: OsowWarning[] | null;
  /** Null when there is no route to plan (and in quotes saved before trip plans existed). */
  tripPlan?: TripPlan | null;
  /** Tolls HERE charges this rig on the route (transponder rates); null when unknown. */
  routeTollsUsd?: number | null;
};

export type StateCoverage = {
  state: string;
  name: string;
  status: string | null;
  researchedOn: string | null;
  verifiedOn: string | null;
};

export type OsowAccess = {
  plan: string;
  dailyUsed: number;
  dailyCap: number;
  /** The calculator terms version the user must accept, and whether they have. */
  termsVersion: string;
  termsAccepted: boolean;
};

export type QuoteSummary = {
  id: number;
  name: string;
  mode: QuoteMode | string;
  origin: string;
  destination: string;
  total: number | null;
  brokerName?: string | null;
  brokerPhone?: string | null;
  brokerEmail?: string | null;
  createdAt: string;
};

/** What the panel stores as a quote's "input": the exact request plus the form it came from. */
export type QuoteInput = CalculateRequest & { form?: FormSnapshot };

export type QuoteDetail = {
  id: number;
  name: string;
  mode: QuoteMode | string;
  input: QuoteInput;
  result: CalculateResponse;
  economics: EconomicsSnapshot | null;
  brokerName?: string | null;
  brokerPhone?: string | null;
  brokerEmail?: string | null;
  createdAt: string;
};

/** Who the quote was prepared for. */
export type BrokerContact = { name: string; phone: string; email: string };

// --- Client-side state that also travels inside saved quotes ----------------------------------

export type InputMode = "cargo" | "overall";
export type DimKey = keyof LoadSpec;

export type FormSnapshot = {
  origin: string;
  destination: string;
  mode: InputMode;
  cargo: { length: string; width: string; height: string; weight: string; frontOffset: string };
  rigId: string;
  rigAuto: boolean;
  rigEdits: Record<string, Partial<Record<"deckHeightIn" | "deckLengthIn" | "tractorLengthIn" | "tareLb" | "axles", number>>>;
  /** Cargo mode: fields the user typed over the computed overall dims. */
  overrides: Partial<Record<DimKey, string>>;
  /** Overall mode: the user's own overall dims. */
  manual: Record<DimKey, string>;
  /** An axle group is over its legal weight: overweight even with a legal gross. Missing in old quotes. */
  axlesOverLegal?: boolean;
};

/** How the driver is paid: cents per mile, or a share of the load. */
export type DriverPayMode = "per_mile" | "percent_of_load";

export type EconomicsSnapshot = {
  mode: QuoteMode;
  loadRate: number | null;
  mpg: number | null;
  dieselPerGal: number | null;
  tolls: number | null;
  truckRatePerMile: number | null;
  driverPayMode?: DriverPayMode;
  driverPayPerMile?: number | null;
  driverPayPercent?: number | null;
  marginPct: number | null;
  itemize: boolean;
};
