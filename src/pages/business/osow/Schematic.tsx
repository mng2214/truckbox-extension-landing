/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// 2D side + rear views, to scale (each view on its own scale), drawn in pixels so labels stay legible
// at any width. Colours come from osow.css classes, so both cabinet themes work.

import { useEffect, useRef, useState } from "react";
import { LEGAL } from "./equipment";
import { formatFtIn } from "./parseDims";
import { cargoBox, dimLabels, excessParts, extentX, legalEnvelope, type Box, type VisualModel } from "./visual";

const WHEEL_R = 20;
const TRAILER_WHEEL_R = 17;

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = Math.floor(entries[0]?.contentRect.width ?? 0);
      setW((prev) => (Math.abs(prev - cw) > 1 ? cw : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function Schematic({ model }: { model: VisualModel }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const labels = dimLabels(model);
  return (
    <div ref={ref} className="flex flex-col gap-4" style={{ padding: "14px 14px 12px" }}>
      {width > 0 && <SideView model={model} width={width - 28} />}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <RearView model={model} width={Math.min(240, Math.max(160, (width - 28) * 0.36))} />
        <ul className="flex flex-col gap-1.5" style={{ fontSize: "0.76rem", color: "var(--muted)", listStyle: "none", margin: 0, padding: 0 }}>
          {labels.filter((l) => !l.missing).map((l) => (
            <li key={l.key} style={{ color: l.over ? "var(--osw-danger)" : "var(--ink)", fontWeight: 700 }}>
              {l.text}
              {l.over && <span style={{ fontWeight: 500 }}> · over legal</span>}
            </li>
          ))}
          <li className="mt-1">
            <svg width="22" height="8" aria-hidden style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}>
              <line x1="0" y1="4" x2="22" y2="4" style={{ stroke: "var(--osw-ok)", strokeWidth: 1.5, strokeDasharray: "5 4" }} />
            </svg>
            Legal 8' 6" × 13' 6", 53' trailer
          </li>
          <li>
            <span className="osw-swatch" style={{ background: "color-mix(in srgb, var(--osw-danger) 45%, transparent)" }} />
            Over the legal envelope
          </li>
        </ul>
      </div>
    </div>
  );
}

function SideView({ model, width }: { model: VisualModel; width: number }) {
  const cargo = cargoBox(model);
  const env = legalEnvelope(model);
  const excess = cargo ? excessParts(cargo, env).filter((b) => b.y0 >= env.y1 - 0.01 || b.x0 >= env.x1 - 0.01) : [];
  const { layout } = model;
  const T = layout.tractorLengthIn;
  const extent = Math.max(extentX(model), T + 200);
  const padL = 8;
  const padR = 62;
  const k = Math.max(0.05, (width - padL - padR) / (extent + 24));
  const topY = Math.max(cargo ? cargo.y1 : 0, LEGAL.heightIn, 150) + 14;
  const padT = 18;
  const padB = 34;
  const height = Math.round(padT + topY * k + padB);
  const X = (x: number) => padL + (x + 12) * k;
  const Y = (y: number) => padT + (topY - y) * k;
  const rect = (x0: number, y0: number, x1: number, y1: number, cls: string, key?: string | number) => (
    <rect key={key} className={cls} x={X(x0)} y={Y(y1)} width={Math.max(0, (x1 - x0) * k)} height={Math.max(0, (y1 - y0) * k)} />
  );
  const poly = (pts: [number, number][], cls: string) => (
    <polygon className={cls} points={pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")} />
  );
  const wheel = (x: number, r: number, key: string) => (
    <g key={key}>
      <circle className="wheel" cx={X(x)} cy={Y(r)} r={r * k} />
      <circle className="hub" cx={X(x)} cy={Y(r)} r={r * k * 0.42} />
    </g>
  );

  const sleeperEnd = Math.max(130, Math.min(176, T - 40));
  const labels = dimLabels(model);
  const L = model.overall.lengthIn ?? extent;
  const H = model.overall.heightIn ?? (cargo ? cargo.y1 : 0);
  const showLegalLen = extent > env.x1 + 6;

  return (
    <svg className="osw-sch" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Side view of the truck, trailer and load">
      <text className="view-t" x={X(-12)} y={11}>Side</text>
      <line className="ground" x1={X(-12)} y1={Y(0)} x2={X(extent + 12)} y2={Y(0)} />

      {/* tractor */}
      {rect(20, 30, T + 40, 44, "deck")}
      {rect(-4, 18, 6, 36, "deck")}
      {poly([[0, 36], [0, 66], [8, 72], [56, 76], [56, 36]], "body")}
      {poly([[56, 36], [56, 118], [62, 132], [70, 140], [124, 140], [124, 36]], "body")}
      {poly([[64, 102], [72, 128], [116, 128], [116, 102]], "glass")}
      {rect(124, 44, sleeperEnd, 132, "body")}
      {rect(T - 12, 44, T + 36, 50, "deck")}
      {wheel(34, WHEEL_R, "s")}
      {wheel(T - 10, WHEEL_R, "d1")}
      {wheel(T + 42, WHEEL_R, "d2")}

      {/* trailer */}
      {layout.segments.map((s, i) => rect(s.x0, s.topIn - 10, s.x1, s.topIn, "deck", `seg${i}`))}
      {layout.segments.slice(1).map((s, i) => {
        const prev = layout.segments[i];
        if (Math.abs(prev.topIn - s.topIn) < 1) return null;
        const lo = Math.min(prev.topIn, s.topIn) - 10;
        const hi = Math.max(prev.topIn, s.topIn);
        return rect(s.x0 - 4, lo, s.x0 + 4, hi, "deck", `wall${i}`);
      })}
      {layout.trailerAxlesX.map((x, i) => wheel(x, TRAILER_WHEEL_R, `t${i}`))}

      {/* cargo + excess */}
      {cargo && rect(cargo.x0, cargo.y0, cargo.x1, cargo.y1, "cargo")}
      {excess.map((b: Box, i) => rect(b.x0, b.y0, b.x1, b.y1, "excess", `x${i}`))}

      {/* legal lines */}
      <line className="legal" x1={X(0)} y1={Y(LEGAL.heightIn)} x2={X(Math.max(env.x1, extent))} y2={Y(LEGAL.heightIn)} />
      <text className="legal-t has-halo" x={X(0)} y={Y(LEGAL.heightIn) - 4}>13' 6" legal</text>
      {showLegalLen && (
        <>
          <line className="legal" x1={X(env.x1)} y1={Y(0)} x2={X(env.x1)} y2={Y(LEGAL.heightIn)} />
          {/* Top corner of the legal box, clear of the height dimension on the right. */}
          <text className="legal-t has-halo" x={X(env.x1) - 6} y={Y(LEGAL.heightIn) - 4} textAnchor="end">
            53' trailer
          </text>
        </>
      )}

      {/* overall length */}
      <g>
        <line className="dim" x1={X(0)} y1={Y(0) + 16} x2={X(L)} y2={Y(0) + 16} />
        <line className="dim" x1={X(0)} y1={Y(0) + 10} x2={X(0)} y2={Y(0) + 22} />
        <line className="dim" x1={X(L)} y1={Y(0) + 10} x2={X(L)} y2={Y(0) + 22} />
        <text className={"dim-t" + (labels[2].over ? " is-over" : "")} x={(X(0) + X(L)) / 2} y={Y(0) + 30} textAnchor="middle">
          {labels[2].text}
        </text>
      </g>
      {/* overall height */}
      {H > 0 && (
        <g>
          <line className="dim" x1={X(extent) + 14} y1={Y(0)} x2={X(extent) + 14} y2={Y(H)} />
          <line className="dim" x1={X(extent) + 8} y1={Y(H)} x2={X(extent) + 20} y2={Y(H)} />
          <text className={"dim-t" + (labels[1].over ? " is-over" : "")} x={X(extent) + 22} y={(Y(0) + Y(H)) / 2 + 4}>
            {formatFtIn(H)}
          </text>
        </g>
      )}
    </svg>
  );
}

function RearView({ model, width }: { model: VisualModel; width: number }) {
  const cargo = cargoBox(model);
  const env = legalEnvelope(model);
  const half = Math.max(LEGAL.widthIn / 2, cargo ? cargo.z1 : 0) + 8;
  const topY = Math.max(cargo ? cargo.y1 : 0, LEGAL.heightIn) + 12;
  const padX = 6;
  const k = (width - padX * 2) / (half * 2);
  const padT = 18;
  const padB = 22;
  const height = Math.round(padT + topY * k + padB);
  const X = (z: number) => padX + (z + half) * k;
  const Y = (y: number) => padT + (topY - y) * k;
  const rect = (z0: number, y0: number, z1: number, y1: number, cls: string, key?: string | number) => (
    <rect key={key} className={cls} x={X(z0)} y={Y(y1)} width={Math.max(0, (z1 - z0) * k)} height={Math.max(0, (y1 - y0) * k)} />
  );
  const deckTop = cargo ? cargo.y0 : model.rig.deckHeightIn;
  const excess = cargo ? excessParts(cargo, env).filter((b) => b.x1 > b.x0 && (b.y0 >= env.y1 - 0.01 || b.z0 >= env.z1 - 0.01 || b.z1 <= env.z0 + 0.01)) : [];
  const w = dimLabels(model)[0];

  return (
    <svg className="osw-sch" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rear view of the load" style={{ width, flex: "0 0 auto" }}>
      <text className="view-t" x={padX} y={11}>Rear</text>
      <line className="ground" x1={X(-half)} y1={Y(0)} x2={X(half)} y2={Y(0)} />
      {rect(-51, deckTop - 10, 51, deckTop, "deck")}
      {rect(-34, 22, 34, deckTop - 10, "deck")}
      {[-50, -37, 27, 40].map((z) => rect(z, 0, z + 10, 38, "wheel", z))}
      {cargo && rect(cargo.z0, cargo.y0, cargo.z1, cargo.y1, "cargo")}
      {excess.map((b, i) => rect(b.z0, b.y0, b.z1, b.y1, "excess", i))}
      <path
        className="legal"
        d={`M ${X(-51)} ${Y(0)} L ${X(-51)} ${Y(LEGAL.heightIn)} L ${X(51)} ${Y(LEGAL.heightIn)} L ${X(51)} ${Y(0)}`}
      />
      <text className={"dim-t" + (w.over ? " is-over" : "")} x={width / 2} y={height - 5} textAnchor="middle">
        {w.text}
      </text>
    </svg>
  );
}
