/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import type { CSSProperties } from "react";
import { LEGAL, PICKUP, rigLayout, type Rig } from "../business/osow/equipment";

const GROUND = 176;
const VIEW_HEIGHT = GROUND + 2;
const TAIL_ROOM = 12;
const DECK_THICKNESS = 9;
const TRACTOR_WHEEL = 20;
const TRAILER_WHEEL = 17;

const up = (inches: number) => GROUND - inches;

export function TrailerProfile({ rig }: { rig: Rig }) {
  const pickup = rig.towVehicle === "pickup";
  const stretched = rigLayout(rig, { lengthIn: rig.stretchToIn ?? 0 });
  const base = rigLayout(rig, { lengthIn: 0 });
  const loading = stretched.segments.find((segment) => segment.kind === "well") ?? stretched.segments[0];
  const baseLoadLength =
    (base.segments.find((segment) => segment.kind === "well") ?? base.segments[0]).x1 -
    (base.segments.find((segment) => segment.kind === "well") ?? base.segments[0]).x0;
  const stretchFrom = rig.stretchToIn ? loading.x0 + baseLoadLength : null;
  const drawnWidth = Math.ceil(
    Math.max(...stretched.segments.map((segment) => segment.x1), ...stretched.trailerAxlesX.map((axleX) => axleX + TRAILER_WHEEL)) + TAIL_ROOM,
  );

  return (
    <svg
      className="tbp-rig"
      viewBox={`0 0 ${drawnWidth} ${VIEW_HEIGHT}`}
      style={{ "--tbp-rig-width": drawnWidth } as CSSProperties}
      role="img"
      aria-label={`${rig.label} side view`}
      preserveAspectRatio="xMinYMax meet"
    >
      <rect
        className="tbp-rig-room"
        x={loading.x0}
        y={up(LEGAL.heightIn)}
        width={loading.x1 - loading.x0}
        height={LEGAL.heightIn - loading.topIn}
      />

      {pickup ? (
        <>
          <path
            className="tbp-rig-tractor"
            d={`M 0 ${up(28)} L 0 ${up(56)} L 64 ${up(60)} L 86 ${up(82)} L 150 ${up(82)} L 156 ${up(76)} L 156 ${up(54)} L ${PICKUP.bedEndX} ${up(54)} L ${PICKUP.bedEndX} ${up(28)} Z`}
          />
          <path
            className="tbp-rig-neck"
            d={`M ${PICKUP.ballX} ${up(54)} L ${PICKUP.ballX} ${up(64)} L ${stretched.trailerStartIn} ${up(64)} L ${stretched.trailerStartIn} ${up(stretched.segments[0].topIn)}`}
          />
          <circle className="tbp-rig-wheel" cx={PICKUP.frontAxleX} cy={up(PICKUP.wheelR)} r={PICKUP.wheelR} />
          <circle className="tbp-rig-wheel" cx={PICKUP.rearAxleX} cy={up(PICKUP.wheelR)} r={PICKUP.wheelR} />
        </>
      ) : (
        <>
          <g className="tbp-rig-tractor">
            <path d={`M 6 ${up(44)} L 6 ${up(92)} L 84 ${up(100)} L 92 ${up(150)} L 168 ${up(150)} L 172 ${up(138)} L 214 ${up(138)} L 214 ${up(44)} Z`} />
            <rect x={0} y={up(46)} width={stretched.tractorLengthIn} height={10} />
          </g>
          <circle className="tbp-rig-wheel" cx={46} cy={up(TRACTOR_WHEEL)} r={TRACTOR_WHEEL} />
          <circle className="tbp-rig-wheel" cx={176} cy={up(TRACTOR_WHEEL)} r={TRACTOR_WHEEL} />
          <circle className="tbp-rig-wheel" cx={222} cy={up(TRACTOR_WHEEL)} r={TRACTOR_WHEEL} />
        </>
      )}

      {stretched.segments.map((segment, index) => {
        const previous = stretched.segments[index - 1];
        const solidEnd = stretchFrom != null && segment === loading ? stretchFrom : segment.x1;
        return (
          <g key={`${segment.kind}-${index}`}>
            {previous && previous.topIn !== segment.topIn && (
              <line
                className="tbp-rig-step"
                x1={segment.x0}
                x2={segment.x0}
                y1={up(Math.max(previous.topIn, segment.topIn))}
                y2={up(Math.min(previous.topIn, segment.topIn)) + DECK_THICKNESS}
              />
            )}
            <rect className="tbp-rig-deck" x={segment.x0} y={up(segment.topIn)} width={solidEnd - segment.x0} height={DECK_THICKNESS} />
            {solidEnd < segment.x1 && (
              <rect
                className="tbp-rig-stretch"
                x={solidEnd}
                y={up(segment.topIn)}
                width={segment.x1 - solidEnd}
                height={DECK_THICKNESS}
              />
            )}
          </g>
        );
      })}
      {!pickup && (
        <line
          className="tbp-rig-step"
          x1={stretched.trailerStartIn}
          x2={stretched.trailerStartIn - 30}
          y1={up(stretched.segments[0].topIn) + DECK_THICKNESS}
          y2={up(46)}
        />
      )}
      {stretched.trailerAxlesX.map((axleX) => (
        <circle key={axleX} className="tbp-rig-wheel" cx={axleX} cy={up(TRAILER_WHEEL)} r={TRAILER_WHEEL} />
      ))}
    </svg>
  );
}
