/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeftRight, Calculator, ChevronDown, RotateCcw } from "lucide-react";
import { api } from "../../../lib/api";
import { LEGAL, RIGS, type RigSpecKey } from "./equipment";
import {
  COST_FIELDS,
  DIM_KEYS,
  DIM_LABEL,
  ESCORT_CAR_CHOICES,
  formatDim,
  limitNote,
  type CargoKey,
  type CostGroup,
  type CostText,
  type Derived,
} from "./formModel";
import { formatFtIn, formatLb, parseLengthIn, parseWeightLb } from "./parseDims";
import { RANGES, rangeError, sanitizeCity, sanitizeDecimal, sanitizeDimension } from "./inputRules";
import type { DimKey, FormSnapshot } from "./types";

type SetForm = (fn: (prev: FormSnapshot) => FormSnapshot) => void;

const REQUIRED_CARGO: CargoKey[] = ["length", "width", "height", "weight"];
const REQUIRED_OVERALL: DimKey[] = ["widthIn", "heightIn", "lengthIn", "grossLb"];

const CARGO_FIELDS: { key: Exclude<CargoKey, "frontOffset">; label: string; placeholder: string }[] = [
  { key: "length", label: "Length", placeholder: `e.g. 75'` },
  { key: "width", label: "Width", placeholder: `e.g. 12'6"` },
  { key: "height", label: "Height", placeholder: `e.g. 10'` },
  { key: "weight", label: "Weight", placeholder: "e.g. 45,000" },
];

const RIG_FIELDS: { key: RigSpecKey; label: string; kind: "height" | "length" | "weight" | "count" }[] = [
  { key: "deckHeightIn", label: "Deck height", kind: "height" },
  { key: "deckLengthIn", label: "Trailer length", kind: "length" },
  { key: "tractorLengthIn", label: "Tractor length", kind: "length" },
  { key: "tareLb", label: "Tare (tractor + trailer)", kind: "weight" },
  { key: "axles", label: "Axles", kind: "count" },
];

export function LoadForm({
  form,
  setForm,
  derived,
  costText,
  setCostText,
  escortCars,
  setEscortCars,
  citySuggest,
  pickupDate,
  setPickupDate,
  pickupTime,
  setPickupTime,
  attempted,
  busy,
  error,
  onSubmit,
}: {
  form: FormSnapshot;
  setForm: SetForm;
  derived: Derived;
  costText: CostText;
  setCostText: (fn: (prev: CostText) => CostText) => void;
  /** Escort cars on the whole route; null = each state's rules. */
  escortCars: number | null;
  setEscortCars: (cars: number | null) => void;
  citySuggest: boolean;
  pickupDate: string;
  setPickupDate: (date: string) => void;
  pickupTime: string;
  setPickupTime: (time: string) => void;
  /** The user pressed Calculate at least once: show every missing required field. */
  attempted: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const [rigOpen, setRigOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const setCargo = (k: CargoKey, v: string) => setForm((f) => ({ ...f, cargo: { ...f.cargo, [k]: v } }));

  const switchMode = (mode: FormSnapshot["mode"]) =>
    setForm((f) => {
      if (f.mode === mode) return f;
      if (mode === "overall" && DIM_KEYS.every((k) => !f.manual[k] || k === "axles" || k.endsWith("OverhangIn"))) {
        // First time in manual mode: start from what the cargo + trailer produced.
        const manual = { ...f.manual };
        for (const k of DIM_KEYS) if (derived.display[k]) manual[k] = derived.display[k];
        return { ...f, mode, manual };
      }
      return { ...f, mode };
    });

  const renderCostFields = (group: CostGroup) =>
    COST_FIELDS.filter((costField) => costField.group === group).map((costField) => {
      const problem = rangeError(costText[costField.key] ?? "", RANGES[costField.key]);
      return (
        <Field
          key={costField.key}
          label={costField.label}
          value={costText[costField.key]}
          pre={costField.pre}
          post={costField.post}
          inputMode="decimal"
          onChange={(value) => setCostText((previous) => ({ ...previous, [costField.key]: sanitizeDecimal(value, 8) }))}
          hint={problem ? { text: problem, kind: "error" } : costField.hint ? { text: costField.hint } : null}
        />
      );
    });

  const swap = () => setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }));
  const rigEdited = Object.keys(form.rigEdits[derived.rig.id] ?? {}).length > 0;
  const hasOverrides = Object.keys(form.overrides).length > 0;
  const showOverallInputs = form.mode === "overall" || adjustOpen || hasOverrides;
  // Once the user starts a group of fields (or presses Calculate), the empty required ones turn red.
  const cargoStarted = attempted || REQUIRED_CARGO.some((key) => form.cargo[key].trim() !== "");
  const overallStarted =
    attempted || REQUIRED_OVERALL.some((key) => (derived.display[key] ?? "").trim() !== "");
  // Only worth a line when no trailer gets the load under 13'6"; the suggested rig is marked in the list.
  const overheightOnEveryRig = derived.suggested != null && !overallOk(derived);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      {/* Lane */}
      <section className="osw-card">
        <div className="osw-card-head">
          <span className="osw-card-title">Lane</span>
        </div>
        <div className="osw-card-body">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
            <CityInput
              label="Origin"
              value={form.origin}
              placeholder="Houston, TX"
              required={attempted}
              suggest={citySuggest}
              onChange={(v) => setForm((f) => ({ ...f, origin: v }))}
            />
            <div className="hidden sm:flex self-end" style={{ marginBottom: 18 }}>
              <button
                type="button"
                className="osw-icon-btn"
                style={{ width: 40, height: 40 }}
                aria-label="Swap origin and destination"
                title="Swap"
                onClick={swap}
              >
                <ArrowLeftRight size={15} />
              </button>
            </div>
            <CityInput
              label="Destination"
              value={form.destination}
              placeholder="Chicago, IL"
              required={attempted}
              suggest={citySuggest}
              onChange={(v) => setForm((f) => ({ ...f, destination: v }))}
            />
          </div>
          <div className="osw-grid is-4" style={{ marginTop: 12 }}>
            <DateTimeField
              label="Pickup date"
              type="date"
              value={pickupDate}
              onChange={setPickupDate}
            />
            <DateTimeField
              label="Pickup time"
              type="time"
              value={pickupTime}
              onChange={setPickupTime}
            />
          </div>
        </div>
      </section>

      {/* Load — the load model beside the form ends level with this card's bottom. */}
      <section className="osw-card" data-model-align-end>
        <div className="osw-card-head">
          <span className="osw-card-title">Load</span>
          <div className="tb-seg" role="tablist" aria-label="Input mode">
            <button
              type="button"
              role="tab"
              aria-selected={form.mode === "cargo"}
              className={form.mode === "cargo" ? "is-active" : ""}
              onClick={() => switchMode("cargo")}
            >
              Cargo + equipment
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={form.mode === "overall"}
              className={form.mode === "overall" ? "is-active" : ""}
              onClick={() => switchMode("overall")}
            >
              Overall dims
            </button>
          </div>
        </div>

        <div className="osw-card-body flex flex-col gap-5">
          {form.mode === "cargo" && (
            <>
              <div className="flex flex-col gap-2.5">
                <span className="osw-sublabel">Cargo</span>
                <div className="osw-grid is-4">
                  {CARGO_FIELDS.map((f) => {
                    const v = derived.cargoValues[f.key];
                    const err = derived.cargoErrors[f.key];
                    return (
                      <Field
                        key={f.key}
                        label={f.label}
                        value={form.cargo[f.key]}
                        placeholder={f.placeholder}
                        onChange={(val) =>
                          setCargo(f.key, f.key === "weight" ? sanitizeDecimal(val) : sanitizeDimension(val))
                        }
                        hint={
                          err
                            ? { text: err, kind: "error" }
                            : v == null && cargoStarted && REQUIRED_CARGO.includes(f.key) && form.cargo[f.key].trim() === ""
                              ? { text: "Required", kind: "error" }
                              : null
                        }
                        inputMode={f.key === "weight" ? "numeric" : "text"}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="osw-sublabel">Trailer</span>
                  <label className="inline-flex items-center gap-2" style={{ fontSize: "0.76rem", color: "var(--muted)", cursor: "pointer" }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.rigAuto}
                      aria-label="Pick the trailer automatically"
                      className={"tb-switch" + (form.rigAuto ? " is-on" : "")}
                      style={{ transform: "scale(0.8)", transformOrigin: "right center" }}
                      onClick={() => setForm((f) => ({ ...f, rigAuto: !f.rigAuto, rigId: derived.rig.id }))}
                    />
                    Auto-pick
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <select
                    className="ed-input osw-input"
                    aria-label="Trailer type"
                    value={derived.rig.id}
                    onChange={(e) => setForm((f) => ({ ...f, rigId: e.target.value, rigAuto: false }))}
                  >
                    {RIGS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                        {derived.suggested?.id === r.id ? " — suggested" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="osw-link"
                    aria-expanded={rigOpen}
                    onClick={() => setRigOpen((o) => !o)}
                  >
                    {rigOpen ? "Done" : "Edit rig"}
                    {rigEdited && !rigOpen && <span className="tb-chip is-accent-o">Edited</span>}
                  </button>
                </div>
                {(derived.layout.stretchedIn > 0 || !derived.layout.inWell || overheightOnEveryRig) && (
                  <div style={{ fontSize: "0.76rem", color: "var(--osw-warn)", fontWeight: 600, lineHeight: 1.5 }}>
                    {overheightOnEveryRig && <span className="block">No trailer keeps this load under 13' 6" — lowest deck picked.</span>}
                    {derived.layout.stretchedIn > 0 && derived.layout.inWell && (
                      <span className="block">Trailer stretched +{formatFtIn(derived.layout.stretchedIn)} so the cargo fits the well.</span>
                    )}
                    {!derived.layout.inWell && (
                      <span className="block">
                        Cargo is longer than the well
                        {derived.layout.stretchedIn > 0 ? ` even stretched +${formatFtIn(derived.layout.stretchedIn)}` : ""}, so it rides on
                        the upper decks and the height is taken from there. Pick a longer well (Edit rig) if your yard has one.
                      </span>
                    )}
                  </div>
                )}
                {rigOpen && (
                  <div className="flex flex-col gap-3 pt-1">
                    <div className="osw-grid is-3">
                      {RIG_FIELDS.map((f) => (
                        <RigField
                          key={f.key}
                          label={f.label}
                          kind={f.kind}
                          value={derived.rig[f.key]}
                          isEdited={form.rigEdits[derived.rig.id]?.[f.key] != null}
                          onCommit={(n) =>
                            setForm((s) => ({
                              ...s,
                              rigAuto: false,
                              rigId: derived.rig.id,
                              rigEdits: {
                                ...s.rigEdits,
                                [derived.rig.id]: { ...s.rigEdits[derived.rig.id], [f.key]: n },
                              },
                            }))
                          }
                        />
                      ))}
                      <Field
                        label="Cargo offset"
                        value={form.cargo.frontOffset}
                        placeholder="0"
                        onChange={(val) => setCargo("frontOffset", sanitizeDimension(val))}
                        title="How far behind the deck's front the cargo sits"
                        hint={
                          derived.cargoErrors.frontOffset ? { text: derived.cargoErrors.frontOffset, kind: "error" } : null
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4" style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
                      {rigEdited && (
                        <button
                          type="button"
                          className="osw-link is-muted"
                          onClick={() =>
                            setForm((s) => {
                              const rigEdits = { ...s.rigEdits };
                              delete rigEdits[derived.rig.id];
                              return { ...s, rigEdits };
                            })
                          }
                        >
                          <RotateCcw size={12} /> Reset to typical
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* overall dims */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="osw-sublabel">
                {form.mode === "cargo" ? "Permit dims — cargo on the trailer" : "Overall dims"}
              </span>
              {form.mode === "cargo" && hasOverrides && (
                <button
                  type="button"
                  className="osw-link is-muted"
                  onClick={() => {
                    setForm((f) => ({ ...f, overrides: {} }));
                    setAdjustOpen(false);
                  }}
                >
                  <RotateCcw size={12} /> Use computed values
                </button>
              )}
              {form.mode === "cargo" && !hasOverrides && derived.computed && (
                <button type="button" className="osw-link" aria-expanded={adjustOpen} onClick={() => setAdjustOpen((open) => !open)}>
                  {adjustOpen ? "Done" : "Adjust"}
                </button>
              )}
            </div>
            {form.mode === "cargo" && derived.computed && !showOverallInputs && (
              <div className="flex flex-wrap gap-2" aria-live="polite">
                {DIM_KEYS.map((key) => {
                  const value = derived.values[key];
                  if (value == null) return null;
                  const note = limitNote(key, value, derived.rig.tractorLengthIn);
                  return (
                    <span key={key} className={"tb-chip " + (note?.over ? "is-danger" : "is-muted")} title={note?.text ?? DIM_LABEL[key]}>
                      {shortLabel(key)}&nbsp;<b>{derived.display[key] || formatDim(key, value)}</b>
                    </span>
                  );
                })}
              </div>
            )}
            {showOverallInputs && (
              <div className="osw-grid is-7">
                {DIM_KEYS.map((k) => {
                  const note = limitNote(k, derived.values[k], derived.rig.tractorLengthIn);
                  const err = derived.errors[k];
                  const overridden = form.mode === "cargo" && form.overrides[k] != null;
                  const missing =
                    form.mode === "overall" &&
                    overallStarted &&
                    REQUIRED_OVERALL.includes(k) &&
                    (derived.display[k] ?? "").trim() === "";
                  return (
                    <Field
                      key={k}
                      label={shortLabel(k)}
                      title={DIM_LABEL[k]}
                      value={derived.display[k]}
                      placeholder={k === "axles" ? "5" : k.endsWith("OverhangIn") ? "0" : ""}
                      override={overridden}
                      inputMode={k === "axles" || k === "grossLb" ? "numeric" : "text"}
                      onChange={(rawValue) => {
                        const val =
                          k === "axles" ? rawValue.replace(/\D/g, "").slice(0, 2)
                          : k === "grossLb" ? sanitizeDecimal(rawValue)
                          : sanitizeDimension(rawValue);
                        setForm((f) =>
                          f.mode === "cargo"
                            ? { ...f, overrides: { ...f.overrides, [k]: val } }
                            : { ...f, manual: { ...f.manual, [k]: val } },
                        );
                      }}
                      hint={
                        err
                          ? { text: err, kind: "error" }
                          : missing
                            ? { text: "Required", kind: "error" }
                            : note?.over
                              ? { text: note.text, kind: "over" }
                              : null
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>

          <label
            className="inline-flex items-center gap-2.5"
            style={{ fontSize: "0.8rem", color: "var(--ink)", fontWeight: 600, cursor: "pointer", width: "fit-content" }}
            title="An axle group over its limit (e.g. a tandem over 34,000 lb) needs an overweight permit even under 80,000 lb gross"
          >
            <button
              type="button"
              role="switch"
              aria-checked={form.axlesOverLegal === true}
              aria-label="Axle weights over legal"
              className={"tb-switch" + (form.axlesOverLegal ? " is-on" : "")}
              style={{ flex: "none" }}
              onClick={() => setForm((f) => ({ ...f, axlesOverLegal: !f.axlesOverLegal }))}
            />
            Axle weights over legal
          </label>
        </div>
      </section>

      {/* Trip */}
      <section className="osw-card">
        <div className="osw-card-head">
          <span className="osw-card-title">Trip</span>
        </div>
        <div className="osw-card-body">
          <div className="osw-grid">{renderCostFields("trip")}</div>
        </div>
      </section>

      {/* Escort cost settings */}
      <section className="osw-card">
        <button
          type="button"
          className="osw-card-head w-full text-left"
          style={{ borderBottom: costsOpen ? undefined : "none", cursor: "pointer", background: "transparent" }}
          aria-expanded={costsOpen}
          onClick={() => setCostsOpen((o) => !o)}
        >
          <span className="osw-card-title">Escort cost settings</span>
          <span className="flex items-center gap-2 osw-card-sub">
            {!costsOpen && summarizeCosts(costText, escortCars)}
            <ChevronDown size={15} style={{ transform: costsOpen ? "rotate(180deg)" : "none" }} />
          </span>
        </button>
        {costsOpen && (
          <div className="osw-card-body flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <span className="osw-sublabel">Escort cars</span>
              <div className="osw-field">
                <span className="osw-flabel">How many</span>
                <div className="tb-seg" role="radiogroup" aria-label="Escort cars" style={{ width: "fit-content", maxWidth: "100%", flexWrap: "wrap" }}>
                {ESCORT_CAR_CHOICES.map((cars) => (
                  <button
                    key={cars ?? "auto"}
                    type="button"
                    role="radio"
                    aria-checked={escortCars === cars}
                    className={escortCars === cars ? "is-active" : ""}
                    title={
                      cars == null
                        ? "As many as each state requires, only where required"
                        : cars === 0
                          ? "No escort cars priced — the shipper or a third party provides them. Each state's requirement still shows."
                          : `${cars} car${cars === 1 ? "" : "s"} on every mile of the route`
                    }
                    onClick={() => setEscortCars(cars)}
                  >
                    {cars == null ? "Auto" : cars === 0 ? "None" : `×${cars}`}
                  </button>
                ))}
                </div>
              </div>
              <div className="osw-grid">{renderCostFields("escorts")}</div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="osw-sublabel">Police</span>
              <div className="osw-grid">{renderCostFields("police")}</div>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="ed-btn ed-btn-accent" disabled={busy} aria-busy={busy}>
          {busy ? (
            <span className="tb-spinner" style={{ borderColor: "rgba(255,255,255,0.45)", borderTopColor: "#fff" }} aria-hidden />
          ) : (
            <Calculator size={15} strokeWidth={2.2} />
          )}
          <span>{busy ? "Calculating" : "Calculate permits & escorts"}</span>
        </button>
        {error && (
          <span role="alert" style={{ color: "var(--osw-danger)", fontSize: "0.84rem", maxWidth: 520 }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function overallOk(d: Derived): boolean {
  return d.computed != null && d.computed.heightIn <= LEGAL.heightIn;
}

function shortLabel(k: DimKey): string {
  if (k === "frontOverhangIn") return "Front OH";
  if (k === "rearOverhangIn") return "Rear OH";
  if (k === "grossLb") return "Gross lb";
  return DIM_LABEL[k];
}

function summarizeCosts(costText: CostText, escortCars: number | null): string {
  const rate = costText.escortRatePerMile || "2.00";
  const hotel = costText.escortHotelPerNight || "120";
  const cars = escortCars == null ? "" : escortCars === 0 ? " · no escorts priced" : ` · ×${escortCars} cars`;
  return `$${rate}/mi · $${hotel}/night${cars}`;
}

/** Native date/time picker styled like the other form fields. */
function DateTimeField({
  label,
  type,
  value,
  onChange,
  hint,
}: {
  label: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="osw-field">
      <label className="osw-flabel" htmlFor={id}>
        <span>{label}</span>
      </label>
      <input
        id={id}
        type={type}
        className="ed-input osw-input"
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="osw-hint">{hint}</span>
    </div>
  );
}

type Hint = { text: string; kind?: "error" | "over" } | null;

function Field({
  label,
  title,
  value,
  placeholder,
  onChange,
  hint,
  override,
  pre,
  post,
  inputMode,
}: {
  label: string;
  title?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  hint?: Hint;
  override?: boolean;
  pre?: string;
  post?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const cls =
    "ed-input osw-input" +
    (hint?.kind === "error" ? " is-error" : "") +
    (override ? " is-override" : "") +
    (pre ? " has-pre" : "") +
    (post ? " has-post" : "");
  const input = (
    <input
      id={id}
      className={cls}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      inputMode={inputMode}
      aria-invalid={hint?.kind === "error" || undefined}
      aria-describedby={hint ? hintId : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return (
    <div className="osw-field">
      <label className="osw-flabel" htmlFor={id} title={title}>
        <span>{label}</span>
        {override && <span style={{ color: "var(--accent)", textTransform: "none", letterSpacing: 0 }}>edited</span>}
      </label>
      {pre || post ? (
        <div className="osw-unit">
          {pre && <span className="is-pre">{pre}</span>}
          {input}
          {post && <span className="is-post">{post}</span>}
        </div>
      ) : (
        input
      )}
      <span
        id={hintId}
        title={hint?.text}
        className={"osw-hint" + (hint?.kind === "error" ? " is-error" : hint?.kind === "over" ? " is-over" : "")}
      >
        {hint?.text ?? ""}
      </span>
    </div>
  );
}

/** A rig spec: shown formatted (ft-in / lb), edited as text, committed on blur or Enter. */
function RigField({
  label,
  value,
  kind,
  isEdited,
  onCommit,
}: {
  label: string;
  value: number;
  kind: "height" | "length" | "weight" | "count";
  isEdited: boolean;
  onCommit: (n: number) => void;
}) {
  const shown = kind === "count" ? String(value) : kind === "weight" ? formatLb(value) : formatFtIn(value);
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const commit = () => {
    if (draft == null) return;
    const s = draft.trim();
    let n: number | null;
    if (kind === "count") n = /^\d+$/.test(s) && Number(s) >= 2 && Number(s) <= 13 ? Number(s) : null;
    else if (kind === "weight") n = parseWeightLb(s);
    else n = parseLengthIn(s, kind === "length" ? "length" : "height");
    if (n != null && n >= 0) onCommit(n);
    setDraft(null);
  };
  return (
    <div className="osw-field">
      <label className="osw-flabel" htmlFor={id}>
        <span>{label}</span>
        {isEdited && <span style={{ color: "var(--accent)", textTransform: "none", letterSpacing: 0 }}>edited</span>}
      </label>
      <input
        id={id}
        className={"ed-input osw-input" + (isEdited ? " is-override" : "")}
        value={draft ?? shown}
        inputMode={kind === "count" || kind === "weight" ? "numeric" : "text"}
        onFocus={() => setDraft(shown)}
        onChange={(e) =>
          setDraft(kind === "count" ? e.target.value.replace(/\D/g, "").slice(0, 2) : kind === "weight" ? sanitizeDecimal(e.target.value) : sanitizeDimension(e.target.value))
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <span className="osw-hint" />
    </div>
  );
}

/** "City, ST" with optional suggestions from the geo index (only when the account has it). */
function CityInput({
  label,
  value,
  placeholder,
  suggest,
  required,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  suggest: boolean;
  /** Show "Required" when empty (after the user pressed Calculate). */
  required?: boolean;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [touched, setTouched] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const disabled = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lookup = (v: string) => {
    if (!suggest || disabled.current) return;
    window.clearTimeout(timer.current);
    const q = v.trim();
    if (q.length < 3 || /,\s*[A-Za-z]{2}$/.test(q)) {
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await api.get<string[]>(`/api/v1/discovery/cities?q=${encodeURIComponent(q)}`);
        setItems(res.slice(0, 8));
        setActive(-1);
        setOpen(res.length > 0);
      } catch {
        disabled.current = true;
        setOpen(false);
      }
    }, 200);
  };

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
    setItems([]);
  };

  const missing = Boolean(required) && value.trim() === "";
  const bad = missing || (touched && value.trim() !== "" && !/,\s*[A-Za-z]{2}\s*$/.test(value.trim()));

  return (
    <div className="osw-field" style={{ position: "relative" }}>
      <label className="osw-flabel" htmlFor={id}>
        <span>{label}</span>
      </label>
      <input
        id={id}
        className={"ed-input osw-input" + (bad ? " is-error" : "")}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        maxLength={80}
        onChange={(e) => {
          const cleaned = sanitizeCity(e.target.value);
          onChange(cleaned);
          lookup(cleaned);
        }}
        onBlur={() => {
          setTouched(true);
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <span className={"osw-hint" + (bad ? " is-error" : "")}>{missing ? "Required" : bad ? "Use City, ST — e.g. Houston, TX" : ""}</span>
      {open && items.length > 0 && (
        <ul className="tb-ac-menu" id={listId} role="listbox" style={{ top: "calc(100% - 15px)" }}>
          {items.map((s, i) => (
            <li key={s} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                className="tb-ac-item"
                style={i === active ? { background: "var(--tb-hover)", color: "var(--accent)" } : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
