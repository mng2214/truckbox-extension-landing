/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { getDiesel, type DieselQuote } from "./OsowApi";
import { BROKER_MODE_ENABLED, computeLedger, type EconForm } from "./econModel";
import { tripMomentLabel } from "./format";
import { RANGES, rangeError, sanitizeDecimal, type Range } from "./inputRules";
import { usd } from "./format";
import type { CalculateResponse, DriverPayMode } from "./types";

export function Economics({
  result,
  econ,
  setEcon,
}: {
  result: CalculateResponse;
  econ: EconForm;
  setEcon: (fn: (e: EconForm) => EconForm) => void;
}) {
  const [diesel, setDiesel] = useState<DieselQuote | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (econ.mode !== "carrier" || asked.current) return;
    asked.current = true;
    getDiesel()
      .then((q) => {
        setDiesel(q);
        if (q.pricePerGallon != null) {
          const p = Number(q.pricePerGallon);
          setEcon((e) => (e.diesel ? e : { ...e, diesel: p.toFixed(3) }));
        }
      })
      .catch(() => {
        /* no price — the field stays editable */
      });
  }, [econ.mode, setEcon]);

  const [dieselBusy, setDieselBusy] = useState(false);
  /** Same as the extension: put this week's EIA US average into the diesel field. */
  const fillAverageDiesel = async () => {
    setDieselBusy(true);
    try {
      const quote = await getDiesel();
      setDiesel(quote);
      if (quote.pricePerGallon != null) {
        const averagePrice = Number(quote.pricePerGallon).toFixed(3);
        setEcon((current) => ({ ...current, diesel: averagePrice }));
      }
    } catch {
      /* no price right now — whatever is typed stays */
    } finally {
      setDieselBusy(false);
    }
  };
  const averageDiesel = diesel?.pricePerGallon != null ? Number(diesel.pricePerGallon).toFixed(3) : null;
  const dieselIsAverage = averageDiesel != null && Number(econ.diesel) === Number(averageDiesel);

  const ledger = computeLedger(result, econ);
  const set = (k: keyof EconForm) => (v: string) => setEcon((e) => ({ ...e, [k]: v }));


  const incomplete = !result.totals.complete;

  return (
    <section className="osw-card">
      <div className="osw-card-head">
        <span className="osw-card-title">Economics</span>
        {BROKER_MODE_ENABLED && (
          <div className="tb-seg" role="tablist" aria-label="Economics mode">
            <button
              type="button"
              role="tab"
              aria-selected={econ.mode === "carrier"}
              className={econ.mode === "carrier" ? "is-active" : ""}
              onClick={() => setEcon((e) => ({ ...e, mode: "carrier" }))}
            >
              Carrier
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={econ.mode === "broker"}
              className={econ.mode === "broker" ? "is-active" : ""}
              onClick={() => setEcon((e) => ({ ...e, mode: "broker" }))}
            >
              Broker
            </button>
          </div>
        )}
      </div>
      <div className="osw-card-body grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {econ.mode === "carrier" ? (
            <>
              <Num label="Load rate" pre="$" value={econ.loadRate} range={RANGES.loadRate} onChange={set("loadRate")} />
              <div className="osw-grid">
                <Num label="Truck mpg" value={econ.mpg} range={RANGES.mpg} onChange={set("mpg")} />
                <Num
                  label="Diesel"
                  aside={
                    <button
                      type="button"
                      className="osw-link"
                      onClick={fillAverageDiesel}
                      disabled={dieselBusy}
                      title="Fill in this week's EIA US average diesel price"
                    >
                      {dieselBusy ? "…" : "Get US avg"}
                    </button>
                  }
                  pre="$"
                  post="/gal"
                  value={econ.diesel} range={RANGES.diesel}
                  onChange={set("diesel")}
                  hint={dieselIsAverage ? "EIA US average" : undefined}
                />
              </div>
              <Num
                label="Driver pay"
                aside={
                  <DriverPayModeSwitch
                    mode={econ.driverPayMode}
                    onChange={(driverPayMode) => setEcon((current) => ({ ...current, driverPayMode }))}
                  />
                }
                pre={econ.driverPayMode === "per_mile" ? "$" : undefined}
                post={econ.driverPayMode === "per_mile" ? "/mi" : "%"}
                value={econ.driverPayMode === "per_mile" ? econ.driverPayPerMile : econ.driverPayPercent}
                range={econ.driverPayMode === "per_mile" ? RANGES.driverPayPerMile : RANGES.driverPayPercent}
                onChange={set(econ.driverPayMode === "per_mile" ? "driverPayPerMile" : "driverPayPercent")}
              />
              <Num
                label="Tolls"
                aside={
                  result.routeTollsUsd != null && econ.tolls.trim() === "" ? (
                    <span className="tb-chip is-accent-o" title="Toll estimate for this route and rig — type a number to use your own">
                      Auto
                    </span>
                  ) : undefined
                }
                pre="$"
                value={econ.tolls} range={RANGES.tolls}
                placeholder={result.routeTollsUsd != null ? result.routeTollsUsd.toFixed(2) : undefined}
                onChange={set("tolls")}
              />
            </>
          ) : (
            <>
              <div className="osw-grid">
                <Num label="Truck rate" pre="$" post="/mi" value={econ.truckRate} range={RANGES.truckRate} onChange={set("truckRate")} hint="What you pay the carrier" />
                <Num label="Margin" post="%" value={econ.margin} range={RANGES.margin} onChange={set("margin")} hint="Share of the customer price" />
              </div>
              {result.tripPlan && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--sub)" }}>
                  Transit time to quote: <b style={{ color: "var(--ink)" }}>{result.tripPlan.transitDays} day{result.tripPlan.transitDays === 1 ? "" : "s"}</b>, delivery {tripMomentLabel(result.tripPlan.arrival)}.
                </p>
              )}
              <label className="inline-flex items-center gap-2.5" style={{ fontSize: "0.8rem", color: "var(--sub)", cursor: "pointer" }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={econ.itemize}
                  aria-label="Show permits and escorts as pass-through lines in the PDF"
                  className={"tb-switch" + (econ.itemize ? " is-on" : "")}
                  onClick={() => setEcon((e) => ({ ...e, itemize: !e.itemize }))}
                />
                Show permits &amp; escorts as pass-through lines in the PDF
              </label>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <div className="osw-metric-k">{ledger.headline.label}</div>
            <div
              className="osw-metric-v is-big"
              style={{ color: ledger.headline.value != null && ledger.headline.value < 0 ? "var(--osw-danger)" : "var(--ink)" }}
            >
              {usd(ledger.headline.value)}
            </div>
            <div className="osw-metric-s">
              {ledger.headline.perMile != null ? `$${ledger.headline.perMile.toFixed(2)} per mile` : "Fill in the inputs"}
              {econ.mode === "carrier" && readRate(econ.loadRate, result.routeMiles)}
            </div>
          </div>
          <div className="osw-ledger">
            {ledger.lines.map((l) => (
              <div
                key={l.label}
                className={
                  l.kind === "sub" ? "is-sub" : l.kind === "total" ? "is-total" : l.kind === "neg" ? "is-total is-neg" : l.kind === "pos" ? "is-pos" : ""
                }
              >
                <span>
                  {l.label}
                  {l.note && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {l.note}</span>}
                </span>
                <span>{usd(l.amount)}</span>
              </div>
            ))}
          </div>
          {incomplete && (
            <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--osw-warn)" }}>
              The OS/OW total is incomplete (see the warnings above), so the real cost is higher.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const DRIVER_PAY_MODES: { value: DriverPayMode; label: string; title: string }[] = [
  { value: "per_mile", label: "$/mi", title: "Driver paid per mile" },
  { value: "percent_of_load", label: "% of load", title: "Driver paid a share of the load rate, after permits and escorts" },
];

function DriverPayModeSwitch({ mode, onChange }: { mode: DriverPayMode; onChange: (mode: DriverPayMode) => void }) {
  return (
    <div className="tb-seg is-sm" role="radiogroup" aria-label="How the driver is paid">
      {DRIVER_PAY_MODES.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={mode === choice.value}
          title={choice.title}
          className={mode === choice.value ? "is-active" : ""}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function readRate(rate: string, mi: number): string {
  const n = Number(rate.replace(/[$,\s]/g, ""));
  if (!rate.trim() || !Number.isFinite(n) || !mi) return "";
  return ` · rate $${(n / mi).toFixed(2)}/mi`;
}

function Num({
  label,
  value,
  placeholder,
  onChange,
  pre,
  post,
  hint,
  range,
  aside,
}: {
  label: string;
  /** A control shown at the right of the label row. */
  aside?: ReactNode;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  pre?: string;
  post?: string;
  hint?: string;
  range?: Range;
}) {
  const id = useId();
  const error = range ? rangeError(value, range) : null;
  return (
    <div className="osw-field">
      {aside ? (
        <div className="osw-flabel" style={{ alignItems: "center" }}>
          <label htmlFor={id}>{label}</label>
          {aside}
        </div>
      ) : (
        <label className="osw-flabel" htmlFor={id}>
          <span>{label}</span>
        </label>
      )}
      <div className="osw-unit">
        {pre && <span className="is-pre">{pre}</span>}
        <input
          id={id}
          className={"ed-input osw-input" + (pre ? " has-pre" : "") + (post ? " has-post" : "") + (error ? " is-error" : "")}
          value={value}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(sanitizeDecimal(e.target.value, 10))}
        />
        {post && <span className="is-post">{post}</span>}
      </div>
      <span className={"osw-hint" + (error ? " is-error" : "")}>{error ?? hint ?? ""}</span>
    </div>
  );
}
