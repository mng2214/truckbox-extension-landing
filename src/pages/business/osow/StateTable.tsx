/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { Fragment, useState } from "react";
import { ChevronDown, ExternalLink, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { humanize, miles, shortDate, SMOOTHING_OPTIONS, usd } from "./format";
import type { CalculateResponse, RoadClass, Smoothing, StateRow } from "./types";

// Prices a state under its freeway or two-lane rules; the route itself stays as drawn.
const ROAD_CHOICES: { value: RoadClass | null; label: string; title: string }[] = [
  { value: null, label: "Auto", title: "Price by the route's own mix of freeway and two-lane miles" },
  { value: "interstate", label: "Freeway", title: "Price this state as if every mile is on a freeway" },
  { value: "non_interstate", label: "2-lane", title: "Price this state as if every mile is on two-lane roads" },
];

const ROAD_USED_LABEL: Record<StateRow["roadUsed"], string> = {
  mixed: "Mixed",
  interstate: "Freeway",
  non_interstate: "2-lane",
};

function escortText(e: { front: number; rear: number } | null): string {
  if (!e || (e.front === 0 && e.rear === 0)) return "—";
  const parts: string[] = [];
  if (e.front) parts.push(`${e.front}F`);
  if (e.rear) parts.push(`${e.rear}R`);
  return parts.join(" ");
}

export function StateTable({
  result,
  roadOverrides,
  onRoad,
  smoothing,
  onSmoothing,
  fixedEscortCars,
  busy,
}: {
  result: CalculateResponse;
  roadOverrides: Record<string, RoadClass>;
  onRoad: (state: string, road: RoadClass | null) => void;
  smoothing: Smoothing;
  onSmoothing: (s: Smoothing) => void;
  /** Cars set for the whole route in the escort settings; escort carry doesn't apply then. */
  fixedEscortCars: number | null;
  busy: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rows = result.states ?? [];
  const t = result.totals;
  const smoothingHint = SMOOTHING_OPTIONS.find((o) => o.value === smoothing)?.hint;

  return (
    <section className="osw-card">
      <div className="osw-card-head">
        <span className="flex items-center gap-3">
          <span className="osw-card-title">By state</span>
          {busy && <span className="tb-spinner" aria-label="Recalculating" />}
        </span>
        {fixedEscortCars != null ? (
          <span className="flex items-center gap-2" style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
            <span className="osw-sublabel">Escort cars</span>
            <span className="tb-chip" title="Set in escort cost settings — state rules don't change the count">
              ×{fixedEscortCars} · whole route
            </span>
          </span>
        ) : (
          <label className="flex items-center gap-2" style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
            <span className="osw-sublabel">Escort carry</span>
            <select
              className="ed-input osw-input"
              style={{ minHeight: 32, padding: "5px 30px 5px 9px", fontSize: "0.8rem", width: "auto" }}
              value={smoothing}
              disabled={busy}
              title={smoothingHint}
              onChange={(e) => onSmoothing(e.target.value as Smoothing)}
            >
              {SMOOTHING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="osw-scroll" style={{ opacity: busy ? 0.6 : 1, transition: "opacity .2s var(--ease)" }}>
        <table className="osw-table" style={{ minWidth: "46rem" }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 16 }}>State</th>
              <th className="num">Miles</th>
              <th title="Which road rules price this state. Switching changes the price, not the route.">Priced as</th>
              <th className="num">Permit</th>
              <th title="Escort vehicles required, front (F) / rear (R), on freeways and on two-lane roads">Escorts</th>
              <th>Flags</th>
              <th aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = `${r.state}-${i}`;
              const isOpen = open.has(key);
              return (
                <Fragment key={key}>
                  <tr
                    className={"osw-row" + (isOpen ? " is-open" : "")}
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                      }
                    }}
                  >
                    <td style={{ paddingLeft: 16 }}>
                      <span className="flex items-center gap-x-2 gap-y-1 flex-wrap" style={{ minWidth: "10.5rem" }}>
                        <b style={{ fontWeight: 700, minWidth: "1.7rem" }}>{r.state}</b>
                        <span style={{ color: "var(--sub)" }}>{r.name}</span>
                        <StatusChip row={r} />
                      </span>
                    </td>
                    <td className="num">
                      {miles(r.miles)}
                      <span className="osw-sub">
                        {miles(r.interstateMiles)} fwy · {miles(r.otherMiles)} 2-ln
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <div className="tb-seg is-sm" role="radiogroup" aria-label={`Road class for ${r.name}`}>
                        {ROAD_CHOICES.map((c) => {
                          const active = (roadOverrides[r.state] ?? null) === c.value;
                          return (
                            <button
                              key={c.label}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              title={c.title}
                              disabled={busy || !r.covered}
                              className={active ? "is-active" : ""}
                              onClick={() => onRoad(r.state, c.value)}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                      {!roadOverrides[r.state] && (
                        <span className="osw-sub" style={{ marginTop: 3 }}>
                          {ROAD_USED_LABEL[r.roadUsed] ?? r.roadUsed}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {r.covered ? usd(r.permitTotal ?? 0, true) : "—"}
                      {r.covered && !r.permitComplete && (
                        <span className="osw-sub" style={{ color: "var(--osw-warn)" }}>+ set by state</span>
                      )}
                      {!r.covered && <span className="osw-sub">not included</span>}
                      {orderLink(r) && (
                        <a
                          className="osw-order"
                          href={orderLink(r) as string}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Order permit <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      )}
                    </td>
                    <td>
                      {r.covered ? (
                        <span className="osw-escorts">
                          <span className="k">Fwy</span>
                          <span>{escortText(r.escortsInterstate)}</span>
                          <span className="k">2-ln</span>
                          <span>{escortText(r.escortsOther)}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {r.policeCount > 0 && <span className="tb-chip is-danger">Police{r.policeCount > 1 ? ` ×${r.policeCount}` : ""}</span>}
                        {r.survey && <span className="tb-chip is-warn">Survey</span>}
                        {r.superload && <span className="tb-chip is-danger">Superload</span>}
                        {r.policeCount === 0 && !r.survey && !r.superload && <span style={{ color: "var(--muted)" }}>—</span>}
                      </span>
                    </td>
                    <td style={{ width: 36, paddingRight: 14 }}>
                      <ChevronDown
                        size={16}
                        style={{
                          color: isOpen ? "var(--accent)" : "var(--muted)",
                          transform: isOpen ? "rotate(180deg)" : "none",
                          transition: "transform .2s var(--ease)",
                        }}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="osw-detail">
                      <td colSpan={7}>
                        <StateDetail row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ paddingLeft: 16 }}>
                {rows.length} state{rows.length === 1 ? "" : "s"}
              </td>
              <td className="num">{miles(result.routeMiles)}</td>
              <td />
              <td className="num">{usd(t.permits, true)}</td>
              <td colSpan={3} style={{ fontWeight: 500, color: "var(--sub)" }}>
                {t.escortVehicleMiles > 0
                  ? `${miles(t.escortVehicleMiles)} escort miles · ${t.escortNights} car-night${t.escortNights === 1 ? "" : "s"} · ${usd(t.escorts)}`
                  : "No escorts required"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function StatusChip({ row }: { row: StateRow }) {
  if (!row.covered) return <span className="tb-chip is-danger">No data</span>;
  if (row.status === "verified") {
    return (
      <span className="tb-chip is-ok" title={`Checked against the state's own sources on ${shortDate(row.verifiedOn)}`}>
        <ShieldCheck /> Verified {shortDate(row.verifiedOn)}
      </span>
    );
  }
  return (
    <span
      className="tb-chip is-warn"
      title={`Draft rules — researched from official sources on ${shortDate(row.researchedOn)}, not yet verified by us. Confirm with the state.`}
    >
      Draft
    </span>
  );
}

function StateDetail({ row }: { row: StateRow }) {
  const sources = row.sources ?? [];
  const srcIndex = (id: string | null) => (id ? sources.findIndex((s) => s.id === id) : -1);
  const fees = row.fees ?? [];
  const restrictions = row.restrictions ?? [];
  const notes = row.notes ?? [];
  const policeNotes = row.policeNotes ?? [];
  const office = row.permitOffice;

  if (!row.covered) {
    return (
      <div className="osw-detail-grid">
        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--sub)" }}>
          No rules for {row.name} yet — its permit and escorts aren't included.
        </p>
      </div>
    );
  }

  return (
    <div className="osw-detail-grid">
      <div className="flex flex-col gap-5 min-w-0">
        <div>
          <span className="osw-sublabel">Permit fees</span>
          {fees.length === 0 ? (
            <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>No fee lines apply to this load.</p>
          ) : (
            <div className="mt-1.5">
              {fees.map((f, i) => {
                const n = srcIndex(f.src);
                return (
                  <div className="osw-fee" key={`${f.id}-${i}`}>
                    <span>
                      {humanize(f.id)}
                      <span className="tb-chip is-muted" style={{ marginLeft: 8, fontSize: "0.6rem", padding: "1px 5px" }}>
                        {f.kind}
                      </span>
                      {n >= 0 && (
                        <a className="osw-src" href={sources[n].url} target="_blank" rel="noreferrer" title={sources[n].title}>
                          [{n + 1}]
                        </a>
                      )}
                    </span>
                    <span className="num" style={{ fontWeight: 700 }}>
                      {f.amount == null ? <span style={{ color: "var(--osw-warn)" }}>Set by state</span> : usd(f.amount, true)}
                    </span>
                    {f.note && <span className="osw-fee-note">{f.note}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {restrictions.length > 0 && (
          <div>
            <span className="osw-sublabel">Restrictions</span>
            <ul className="osw-list">
              {restrictions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        )}

        {(row.policeCount > 0 || policeNotes.length > 0) && (
          <div>
            <span className="osw-sublabel">Police escort</span>
            <ul className="osw-list">
              {row.policeCount > 0 && <li>{row.policeCount} police escort{row.policeCount === 1 ? "" : "s"} required.</li>}
              {policeNotes.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        )}

        {(row.survey || row.superload) && (
          <div className="osw-strip is-warn">
            <ShieldAlert />
            <p>
              {row.superload && <b>Superload in {row.name}. </b>}
              {row.survey && <b>Route survey likely. </b>}
              <span className="osw-strip-sub">Expect longer lead times and engineering review; fees may be set case by case.</span>
            </p>
          </div>
        )}

        {notes.length > 0 && (
          <div>
            <span className="osw-sublabel">Notes</span>
            <ul className="osw-list">
              {notes.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 min-w-0">
        {office && (office.name || office.url || office.phone) && (
          <div>
            <span className="osw-sublabel">Permit office</span>
            <div className="mt-1.5 flex flex-col gap-1" style={{ fontSize: "0.84rem" }}>
              {office.name && <span style={{ fontWeight: 600 }}>{office.name}</span>}
              {office.orderUrl && (
                <a className="ed-btn ed-btn-accent self-start" href={office.orderUrl} target="_blank" rel="noreferrer" style={{ marginBottom: 4 }}>
                  Order permit online <ExternalLink size={12} />
                </a>
              )}
              {office.url && (
                <a className="osw-a inline-flex items-center gap-1" href={office.url} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>
                  {office.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink size={11} style={{ flexShrink: 0 }} />
                </a>
              )}
              {office.phone && (
                <a className="osw-a inline-flex items-center gap-1.5" href={`tel:${office.phone.replace(/[^\d+]/g, "")}`} target="_top">
                  <Phone size={12} /> {office.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {sources.length > 0 && (
          <div>
            <span className="osw-sublabel">Sources</span>
            <ol className="mt-1.5 flex flex-col gap-1.5" style={{ fontSize: "0.8rem", paddingLeft: 0, listStyle: "none", margin: 0 }}>
              {sources.map((s, i) => (
                <li key={s.id} className="flex gap-2">
                  <span style={{ color: "var(--muted)", minWidth: "1.4rem" }}>[{i + 1}]</span>
                  <a className="osw-a" href={s.url} target="_blank" rel="noreferrer" style={{ wordBreak: "break-word" }}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div style={{ fontSize: "0.76rem", color: "var(--muted)", lineHeight: 1.5 }}>
          {row.status === "verified"
            ? `Verified ${shortDate(row.verifiedOn)}. Rules change — confirm with the state before you move.`
            : `Draft data, researched ${shortDate(row.researchedOn)} from the sources above and not yet verified. Confirm every number with the state.`}
        </div>
      </div>
    </div>
  );
}

/** Where to send someone who wants this state's permit: the ordering system, else the office page. */
function orderLink(row: StateRow): string | null {
  return row.permitOffice?.orderUrl || row.permitOffice?.url || null;
}
