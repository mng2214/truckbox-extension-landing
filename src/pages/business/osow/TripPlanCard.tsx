/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { CalendarClock } from "lucide-react";
import {
  durationLabel,
  HOLD_LABEL,
  miles,
  STOP_TONE,
  stopDescription,
  stopPlace,
  stopReasonsLabel,
  tripDayLabel,
  tripMomentLabel,
} from "./format";
import type { HoldReason, TripPlan } from "./types";

const HOLD_TONE: Record<HoldReason, string> = {
  NIGHT: "is-muted",
  CURFEW: "is-warn",
  WEEKEND: "is-warn",
  HOLIDAY: "is-warn",
  HOS_REST: "is-muted",
  HOS_RESTART: "is-danger",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function TripPlanCard({ plan }: { plan: TripPlan }) {
  const longestDay = Math.max(1, ...plan.days.map((day) => day.miles));
  const stops = plan.stops ?? [];
  return (
    <section className="osw-card">
      <div className="osw-card-head">
        <span className="osw-card-title flex items-center gap-2">
          <CalendarClock size={15} /> Trip plan
        </span>
        <span className="osw-card-sub">
          Pickup {tripMomentLabel(plan.pickup)} · Arrives {tripMomentLabel(plan.arrival)}
        </span>
      </div>
      <div className="osw-card-body">
        <div className="osw-trip-summary">
          <div>
            <span className="osw-sublabel">Transit</span>
            <b>{plural(plan.transitDays, "day")}</b>
          </div>
          <div>
            <span className="osw-sublabel">Driving</span>
            <b>{plan.driveHours.toFixed(1)} h</b>
          </div>
          <div>
            <span className="osw-sublabel">Full stop days</span>
            <b>{plan.holdDays === 0 ? "None" : plural(plan.holdDays, "day")}</b>
          </div>
          <div>
            <span className="osw-sublabel">Nights on the road</span>
            <b>{plan.escortNights === 0 ? "None" : plural(plan.escortNights, "night")}</b>
          </div>
        </div>

        <div className="osw-trip-days">
          {plan.days.map((day) => {
            const held = day.miles <= 0;
            return (
              <div className={"osw-trip-day" + (held ? " is-held" : "")} key={day.date}>
                <span className="osw-trip-date">{tripDayLabel(day.date)}</span>
                <div className="osw-leg-bar" aria-hidden="true">
                  <i className="is-i" style={{ width: `${(day.miles / longestDay) * 100}%` }} />
                </div>
                <span className="osw-trip-miles">
                  {held ? "Held" : `${miles(day.miles)} mi · ${day.driveHours.toFixed(1)} h`}
                </span>
                <span className="osw-trip-states">{day.states.join(" → ")}</span>
                <span className="osw-trip-holds">
                  {day.holds.map((reason) => (
                    <span key={reason} className={`tb-chip ${HOLD_TONE[reason]}`}>
                      {HOLD_LABEL[reason]}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        {stops.length > 0 && (
          <div className="osw-trip-stops">
            <span className="osw-sublabel">Stops · numbered as on the map</span>
            <ol>
              {stops.map((stop, stopIndex) => (
                <li key={`${stop.routeMile}-${stop.start}`} title={stopDescription(stop)}>
                  <span className={`osw-stop is-${STOP_TONE[stop.reason]}`}>{stopIndex + 1}</span>
                  <span className="osw-trip-stop-what">
                    {stopReasonsLabel(stop)}
                    <em>
                      {" "}
                      · mile {miles(stop.routeMile)} · {stopPlace(stop)}
                    </em>
                  </span>
                  <span className="osw-trip-stop-when">
                    {tripMomentLabel(stop.start)} → {tripMomentLabel(stop.end)}
                  </span>
                  <span className="osw-trip-stop-hours">{durationLabel(stop.hours)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <details className="osw-trip-note">
          <summary>How the plan is built</summary>
          <ul>
            <li>Driver hours: 11 h driving, 14 h window, 30 min break after 8 h, 10 h off, 70 h in 8 days.</li>
            <li>Each state's daylight, weekend, holiday and curfew rules.</li>
            <li>Not included: city rush hours and conditions printed on the permit.</li>
            <li>Stop times are local. The driver starts rested.</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
