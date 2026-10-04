/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import example from "../../data/osow-example.json";

type EscortCount = { front: number; rear: number };

type ExampleState = {
  state: string;
  name: string;
  miles: number;
  interstateMiles: number;
  otherMiles: number;
  permitTotal: number | null;
  escortsInterstate: EscortCount;
  escortsOther: EscortCount;
};

type ExampleResult = {
  routeMiles: number;
  states: ExampleState[];
  totals: { permits: number; escorts: number; escortVehicleMiles: number; escortNights: number; total: number };
  tripPlan: { transitDays: number; pickup: string; arrival: string; escortNights: number };
};

const result = example.result as unknown as ExampleResult;

export const EXAMPLE_LOAD = {
  cargo: "28' excavator",
  trailer: "RGN 3-axle",
  width: `14'6"`,
  height: `14'4"`,
  length: "71'",
  gross: "120,000 lb",
};

export const EXAMPLE_LANE = { origin: example.request.origin, destination: example.request.destination };

const dollars = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function cars(count: EscortCount): string | null {
  const parts = [];
  if (count.front) parts.push(count.front === 1 ? "front" : `${count.front} front`);
  if (count.rear) parts.push(count.rear === 1 ? "rear" : `${count.rear} rear`);
  return parts.length ? parts.join(" + ") : null;
}

function escortText(row: ExampleState): string {
  const freeway = row.interstateMiles >= 1 ? cars(row.escortsInterstate) : null;
  const twoLane = row.otherMiles >= 1 ? cars(row.escortsOther) : null;
  if (!freeway && !twoLane) return "No escort";
  const text =
    freeway && twoLane
      ? `${freeway} car on freeway, ${twoLane} on 2-lane`
      : freeway
        ? `${freeway} car on freeway`
        : `${twoLane} car on 2-lane`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const EXAMPLE_STATES = result.states.map((row) => ({
  code: row.state,
  name: row.name,
  miles: Math.round(row.miles).toLocaleString("en-US"),
  permit: row.permitTotal == null ? "Set by state" : dollars(row.permitTotal),
  escorts: escortText(row),
}));

const clock = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

export const EXAMPLE_TOTALS = {
  miles: Math.round(result.routeMiles).toLocaleString("en-US"),
  permits: dollars(result.totals.permits),
  escorts: dollars(result.totals.escorts),
  escortMiles: Math.round(result.totals.escortVehicleMiles).toLocaleString("en-US"),
  escortNights: result.totals.escortNights,
  total: dollars(result.totals.total),
  days: result.tripPlan.transitDays,
  pickup: clock(result.tripPlan.pickup),
  arrival: clock(result.tripPlan.arrival),
};

export const EXAMPLE_PRICED_ON = new Date(`${example.pricedOn}T12:00:00`).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
