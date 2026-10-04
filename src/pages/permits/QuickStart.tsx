/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { RIGS } from "../business/osow/equipment";
import { deriveLoad, emptyForm, limitNote } from "../business/osow/formModel";
import { formatFtIn, formatLb } from "../business/osow/parseDims";
import type { DimKey } from "../business/osow/types";
import { CALCULATOR_PATH } from "./permitsData";

const RIG_CHOICES = [...RIGS.filter((rig) => rig.towVehicle === "pickup"), ...RIGS.filter((rig) => rig.towVehicle !== "pickup")];

const CHECKED: { key: DimKey; label: string }[] = [
  { key: "widthIn", label: "Width" },
  { key: "heightIn", label: "Height" },
  { key: "lengthIn", label: "Length" },
  { key: "grossLb", label: "Gross" },
];

export function QuickStart() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [rigId, setRigId] = useState("");
  const [cargo, setCargo] = useState({ length: "", width: "", height: "", weight: "" });

  const derived = useMemo(
    () =>
      deriveLoad({
        ...emptyForm(),
        origin,
        destination,
        cargo: { ...cargo, frontOffset: "" },
        rigId: rigId || RIGS[0].id,
        rigAuto: !rigId,
      }),
    [origin, destination, cargo, rigId],
  );
  const computed = derived.computed;
  const checks = computed
    ? CHECKED.map(({ key, label }) => ({
        key,
        label,
        value: key === "grossLb" ? `${formatLb(computed[key])} lb` : formatFtIn(computed[key]),
        note: limitNote(key, computed[key], derived.rig),
      }))
    : null;
  const over = (key: DimKey) => checks?.find((check) => check.key === key)?.note?.over === true;
  const verdict = !checks
    ? null
    : over("widthIn") || over("grossLb")
      ? "Needs an OS/OW permit in every state on the route."
      : over("heightIn")
        ? "Over 13'6\": needs a permit in every state that holds loads to 13'6\"."
        : over("lengthIn")
          ? "Over length: needs a permit."
          : "Within legal size and weight. No OS/OW permit for these dimensions.";
  const needsPermit = checks?.some((check) => check.note?.over) ?? false;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams({ origin: origin.trim(), destination: destination.trim() });
    if (rigId) params.set("rig", rigId);
    if (cargo.length.trim()) params.set("cargoLength", cargo.length.trim());
    if (cargo.width.trim()) params.set("width", cargo.width.trim());
    if (cargo.height.trim()) params.set("height", cargo.height.trim());
    if (cargo.weight.trim()) params.set("weight", cargo.weight.replace(/\D/g, ""));
    navigate(`${CALCULATOR_PATH}?${params.toString()}`);
  };

  const cargoField = (key: keyof typeof cargo, label: string, placeholder: string) => (
    <label className="tbq-field">
      <span>{label}</span>
      <input
        value={cargo[key]}
        onChange={(event) => setCargo((current) => ({ ...current, [key]: event.target.value }))}
        placeholder={placeholder}
        inputMode={key === "weight" ? "numeric" : "text"}
        autoComplete="off"
        aria-invalid={derived.cargoErrors[key] ? true : undefined}
      />
    </label>
  );

  return (
    <form className="tbq" onSubmit={submit} aria-label="Start pricing a load">
      <div className="tbq-row is-lane">
        <label className="tbq-field">
          <span>From</span>
          <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Houston, TX" required autoComplete="off" />
        </label>
        <label className="tbq-field">
          <span>To</span>
          <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Chicago, IL" required autoComplete="off" />
        </label>
        <label className="tbq-field is-rig">
          <span>Trailer</span>
          <select value={rigId} onChange={(event) => setRigId(event.target.value)}>
            <option value="">Pick for me</option>
            {RIG_CHOICES.map((rig) => (
              <option key={rig.id} value={rig.id}>
                {rig.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tbq-row is-cargo">
        {cargoField("length", "Cargo length", "28'")}
        {cargoField("width", "Width", "10'6\"")}
        {cargoField("height", "Height", "9'")}
        {cargoField("weight", "Weight, lb", "18,000")}
      </div>

      <div className={"tbq-check" + (checks ? (needsPermit ? " is-over" : " is-legal") : "")} aria-live="polite">
        {checks ? (
          <>
            <p className="tbq-verdict">
              {needsPermit ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden />}
              {verdict}
            </p>
            <ul>
              {checks.map((check) => (
                <li key={check.key} className={check.note?.over ? "is-over" : undefined}>
                  <b>{check.label}</b> {check.value}
                </li>
              ))}
              <li>
                <b>On</b> {derived.rig.label}
              </li>
            </ul>
          </>
        ) : (
          <p className="tbq-verdict">Enter the cargo to check it against the legal limits.</p>
        )}
      </div>

      <button type="submit" className="ed-btn ed-btn-accent tbq-submit">
        <span>{needsPermit ? "Price the permits and escorts" : "Price your load free"}</span>
        <ArrowRight aria-hidden className="h-4 w-4" />
      </button>
    </form>
  );
}
