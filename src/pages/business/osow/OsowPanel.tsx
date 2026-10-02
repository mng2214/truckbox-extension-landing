/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// OS/OW permit & escort calculator — cabinet panel, lazy-loaded by Cabinet.tsx. MapLibre and three.js
// are lazy again inside it, so the panel itself stays light.

import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Download, Info, Loader2, RotateCcw, Save, ShieldAlert, X } from "lucide-react";
import "./osow.css";
import {
  calculate,
  acceptTerms,
  deleteQuote,
  getAccess,
  getQuote,
  getStates,
  isFeatureOff,
  listQuotes,
  OSOW_QUOTE_NOT_FOUND,
  OSOW_TERMS_NOT_ACCEPTED,
  osowErrorMessage,
  saveQuote,
} from "./OsowApi";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../../lib/api";
import { LoadForm } from "./LoadForm";
import { OsowTermsDialog } from "./OsowTermsDialog";
import { isValidEmail, isValidPhone, RANGES, rangeError, sanitizePhone, sanitizeText } from "./inputRules";
import { StateTable } from "./StateTable";
import { TripPlanCard } from "./TripPlanCard";
import { ActionToast } from "./ActionToast";
import { Economics } from "./Economics";
import { SavedQuotes } from "./SavedQuotes";
import { Schematic } from "./Schematic";
import {
  COST_FIELDS,
  costsFromText,
  nextWeekday,
  costsToText,
  DEFAULT_COSTS,
  deriveLoad,
  DIM_KEYS,
  emptyForm,
  formatDim,
  type CostText,
} from "./formModel";
import { fromSnapshot, loadEcon, persistEcon, toSnapshot, type EconForm } from "./econModel";
import { DISCLAIMER, loadJson, miles, saveJson, shortDate, US48, usd, useCabinetTheme, useReducedMotionPref } from "./format";
import { formatFtIn, formatLb } from "./parseDims";
import { rigById } from "./equipment";
import { dimLabels, type VisualModel } from "./visual";
import type {
  BrokerContact,
  CalculateRequest,
  CalculateResponse,
  FormSnapshot,
  OsowAccess,
  OsowWarning,
  QuoteSummary,
  RoadClass,
  Smoothing,
  StateCoverage,
} from "./types";


const MIN_PDF_SPINNER_MS = 600;
const RouteMap = lazy(() => import("./RouteMap"));
const LoadModel3D = lazy(() => import("./LoadModel3D"));

const RIGS_KEY = "tb-osow-rigs";
const COSTS_KEY = "tb-osow-costs";
const CITY_RE = /^[A-Za-z][A-Za-z .'-]*,\s*[A-Za-z]{2}$/;

type Busy = "fresh" | "toggle" | null;

const WARNING_META: Record<string, { title: string; tone: "danger" | "warn" | "muted"; fallback: string }> = {
  ROUTING_UNAVAILABLE: {
    title: "Routing unavailable",
    tone: "danger",
    fallback: "We couldn't route this lane right now, so miles by state — and the fees and escorts that depend on them — are missing.",
  },
  GEOCODE_FAILED: {
    title: "Couldn't find the origin or destination",
    tone: "danger",
    fallback: "Check the spelling and use City, ST — e.g. Houston, TX.",
  },
  ROUTE_NOT_FOUND: {
    title: "No truck route found",
    tone: "danger",
    fallback: "No truck route fits this lane. Try nearby cities or check the load dims.",
  },
  ROUTE_IGNORES_CLEARANCE: {
    title: "Route ignores this load's clearances",
    tone: "warn",
    fallback: "No route fits the real dimensions, so this one was planned for a legal-size truck. A route survey is recommended.",
  },
  UNCOVERED_STATE: {
    title: "State not covered",
    tone: "warn",
    fallback: "We don't have this state's rules yet; its permit and escorts are not included.",
  },
  UNPRICED_FEES: {
    title: "Some fees are set case by case",
    tone: "warn",
    fallback: "At least one state prices part of this permit case by case. Those lines are listed but not included in the total.",
  },
  POLICE_UNPRICED: {
    title: "Police escorts not priced",
    tone: "warn",
    fallback: "Police escorts are required on this route but have no price — set a police escort cost in the escort settings.",
  },
  DRAFT_DATA: {
    title: "Draft rules",
    tone: "muted",
    fallback: "Some states use draft rules researched from official sources but not yet verified by us.",
  },
};

function formFromRequest(req: CalculateRequest, base: FormSnapshot): FormSnapshot {
  const manual = { ...base.manual };
  for (const k of DIM_KEYS) manual[k] = formatDim(k, req.load[k]);
  return {
    ...base,
    origin: req.origin,
    destination: req.destination,
    mode: "overall",
    manual,
    overrides: {},
    axlesOverLegal: req.load.axlesOverLegal === true,
  };
}

function cargoLine(f: FormSnapshot | null): string | null {
  if (!f || f.mode !== "cargo") return null;
  const d = deriveLoad(f);
  if (!d.cargo) return null;
  const c = d.cargo;
  return `${formatFtIn(c.lengthIn)} L x ${formatFtIn(c.widthIn)} W x ${formatFtIn(c.heightIn)} H, ${formatLb(c.weightLb)} lb on ${d.rig.label} (deck ${formatFtIn(d.rig.deckHeightIn)}, tare ${formatLb(d.rig.tareLb)} lb)`;
}

export function OsowPanel({ citySuggest }: { citySuggest: boolean }) {
  const theme = useCabinetTheme();
  const navigate = useNavigate();
  const reduced = useReducedMotionPref();

  const [form, setForm] = useState<FormSnapshot>(() => ({
    ...emptyForm(),
    rigEdits: loadJson<FormSnapshot["rigEdits"]>(RIGS_KEY, {}),
  }));
  const derived = useMemo(() => deriveLoad(form), [form]);
  const [costText, setCostText] = useState<CostText>(() => loadJson(COSTS_KEY, costsToText(DEFAULT_COSTS)));
  const [smoothing, setSmoothing] = useState<Smoothing>("conservative");
  // Per load, not a saved preference: a fixed count left on by mistake would inflate every quote.
  const [escortCars, setEscortCars] = useState<number | null>(null);
  const [pickupDate, setPickupDate] = useState<string>(() => nextWeekday());
  const [pickupTime, setPickupTime] = useState<string>("08:00");
  const [roadOverrides, setRoadOverrides] = useState<Record<string, RoadClass>>({});
  const [econ, setEcon] = useState<EconForm>(loadEcon);

  const [request, setRequest] = useState<CalculateRequest | null>(null);
  const [requestForm, setRequestForm] = useState<FormSnapshot | null>(null);
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [access, setAccess] = useState<OsowAccess | null>(null);
  const [termsBusy, setTermsBusy] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const [coverage, setCoverage] = useState<StateCoverage[] | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  const [visualTab, setVisualTab] = useState<"3d" | "2d">("3d");
  // Save quote / PDF sit above the results and again under Economics; the form and the messages
  // open next to whichever pair was used.
  const [saveOpenAt, setSaveOpenAt] = useState<ActionPlace | null>(null);
  const [saveName, setSaveName] = useState("");
  const [broker, setBroker] = useState<BrokerContact>(EMPTY_BROKER);
  // The saved quote whose inputs are on screen: deleting it clears the form.
  const [currentQuoteId, setCurrentQuoteId] = useState<number | null>(null);
  // The user's own cost settings from before a quote replaced them, restored when the quote goes.
  const settingsBeforeQuote = useRef<{ costText: CostText; econ: EconForm } | null>(null);
  const brokerPhoneError = isValidPhone(broker.phone) ? null : "Enter a valid phone number";
  const brokerEmailError = isValidEmail(broker.email) ? null : "Enter a valid email";
  const [saveBusy, setSaveBusy] = useState(false);
  // `id` re-mounts the note, so the same message twice in a row animates again.
  const [actionMsg, setActionMsg] = useState<{ id: number; text: string; ok: boolean; place: ActionPlace } | null>(null);
  const clearActionMsg = useCallback(() => setActionMsg(null), []);
  const [pdfBusy, setPdfBusy] = useState(false);

  const seq = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveJson(RIGS_KEY, form.rigEdits), [form.rigEdits]);
  // An opened quote brings its own cost settings; they must not replace the user's saved ones.
  useEffect(() => {
    if (currentQuoteId == null) saveJson(COSTS_KEY, costText);
  }, [costText, currentQuoteId]);
  useEffect(() => {
    if (currentQuoteId == null) persistEcon(econ);
  }, [econ, currentQuoteId]);

  const refreshAccess = useCallback(() => {
    getAccess()
      .then(setAccess)
      .catch((e) => {
        if (isFeatureOff(e)) setOff(true);
      });
  }, []);

  useEffect(() => {
    refreshAccess();
    getStates()
      .then(setCoverage)
      .catch(() => {
        /* coverage line just stays hidden */
      });
  }, [refreshAccess]);

  // Saved quotes are behind the terms too, so load them once the user has agreed.
  const termsAccepted = access?.termsAccepted === true;
  useEffect(() => {
    if (!termsAccepted) return;
    listQuotes()
      .then(setQuotes)
      .catch((e) => {
        if (isFeatureOff(e)) setOff(true);
        else setQuotesError("Couldn't load your saved quotes.");
      });
  }, [termsAccepted]);

  const scrollToResults = useCallback(() => {
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 60);
  }, [reduced]);

  const run = async (req: CalculateRequest, kind: "fresh" | "toggle", sourceForm?: FormSnapshot) => {
    const id = ++seq.current;
    setBusy(kind);
    if (kind === "fresh") setFormError(null);
    setToggleError(null);
    try {
      const res = await calculate(req);
      if (id !== seq.current) return;
      setRequest(req);
      setResult(res);
      setNotice(null);
      setActionMsg(null);
      if (sourceForm) setRequestForm(sourceForm);
      if (kind === "fresh") scrollToResults();
      refreshAccess();
    } catch (e) {
      if (id !== seq.current) return;
      if (isFeatureOff(e)) setOff(true);
      if (e instanceof ApiError && e.code === OSOW_TERMS_NOT_ACCEPTED) {
        // The terms changed since the page loaded: ask again instead of showing an error.
        refreshAccess();
        return;
      }
      const msg = osowErrorMessage(e, "Calculation failed. Try again.", access?.dailyCap);
      if (kind === "fresh") setFormError(msg);
      else setToggleError(msg);
    } finally {
      if (id === seq.current) setBusy(null);
    }
  };

  const agreeToTerms = async () => {
    if (!access) return;
    setTermsBusy(true);
    setTermsError(null);
    try {
      setAccess(await acceptTerms(access.termsVersion));
    } catch (error) {
      setTermsError(osowErrorMessage(error, "Couldn't save your agreement. Try again."));
    } finally {
      setTermsBusy(false);
    }
  };

  /** The message sits by the Calculate button; the field it talks about may be a screen above. */
  const rejectForm = (message: string) => {
    setFormError(message);
    window.setTimeout(() => {
      const invalid = document.querySelector<HTMLElement>(".osw [aria-invalid='true'], .osw .is-error");
      invalid?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      if (invalid instanceof HTMLInputElement) invalid.focus({ preventScroll: true });
    }, 30);
  };

  const submit = () => {
    setAttempted(true);
    const origin = form.origin.trim().replace(/\s+/g, " ");
    const destination = form.destination.trim().replace(/\s+/g, " ");
    if (!CITY_RE.test(origin) || !CITY_RE.test(destination)) {
      rejectForm("Enter origin and destination as City, ST — e.g. Houston, TX.");
      return;
    }
    if (!derived.load) {
      rejectForm(
        form.mode === "cargo" && !derived.cargo && !Object.keys(form.overrides).length
          ? "Enter the cargo length, width, height and weight."
          : "Check the overall dims: width, height, length and gross weight are required, axles 2–20.",
      );
      return;
    }
    const costProblem = COST_FIELDS.find((costField) => rangeError(costText[costField.key] ?? "", RANGES[costField.key]));
    if (costProblem) {
      rejectForm(`Check escort cost settings: ${costProblem.label} must be ${RANGES[costProblem.key].label}.`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !/^\d{2}:\d{2}$/.test(pickupTime)) {
      rejectForm("Set the pickup date and time.");
      return;
    }
    const sameLane = request != null && request.origin === origin && request.destination === destination;
    const overrides = sameLane ? roadOverrides : {};
    if (!sameLane) {
      // A new lane is a new estimate: it no longer belongs to the opened quote or its broker.
      setRoadOverrides({});
      setCurrentQuoteId(null);
      settingsBeforeQuote.current = null;
      setBroker(EMPTY_BROKER);
    }
    run(
      {
        origin,
        destination,
        load: { ...derived.load, axlesOverLegal: form.axlesOverLegal === true },
        roadOverrides: overrides,
        smoothing,
        costs: { ...costsFromText(costText), escortCars },
        pickupDate,
        pickupTime,
      },
      "fresh",
      form,
    );
  };

  const onRoad = (state: string, road: RoadClass | null) => {
    const next = { ...roadOverrides };
    if (road) next[state] = road;
    else delete next[state];
    setRoadOverrides(next);
    if (request) run({ ...request, roadOverrides: next }, "toggle");
  };

  const onSmoothing = (s: Smoothing) => {
    setSmoothing(s);
    if (request) run({ ...request, smoothing: s }, "toggle");
  };

  const openQuote = async (id: number) => {
    setOpeningId(id);
    setQuotesError(null);
    try {
      const q = await getQuote(id);
      const { form: savedForm, ...req } = q.input;
      const base = { ...emptyForm(), rigEdits: form.rigEdits };
      const restored: FormSnapshot = savedForm
        ? { ...base, ...savedForm, rigEdits: { ...form.rigEdits, ...(savedForm.rigEdits ?? {}) } }
        : formFromRequest(req, base);
      seq.current++;
      setBusy(null);
      if (!settingsBeforeQuote.current) settingsBeforeQuote.current = { costText, econ };
      setCurrentQuoteId(id);
      setForm(restored);
      setRequestForm(restored);
      setCostText(costsToText({ ...DEFAULT_COSTS, ...(req.costs ?? {}) }));
      setSmoothing(req.smoothing ?? "conservative");
      setEscortCars(req.costs?.escortCars ?? null);
      if (req.pickupDate) setPickupDate(req.pickupDate);
      if (req.pickupTime) setPickupTime(req.pickupTime);
      setRoadOverrides(req.roadOverrides ?? {});
      setRequest({ ...req, roadOverrides: req.roadOverrides ?? {}, smoothing: req.smoothing ?? "conservative" });
      setResult(q.result);
      setBroker({ name: q.brokerName ?? "", phone: q.brokerPhone ?? "", email: q.brokerEmail ?? "" });
      setEcon((e) => fromSnapshot(q.economics, e));
      setFormError(null);
      setToggleError(null);
      setActionMsg(null);
      setNotice(`Opened “${q.name}”, priced ${shortDate(q.createdAt)}. Rules may have changed since — recalculate before quoting.`);
      scrollToResults();
    } catch (e) {
      if (e instanceof ApiError && e.code === OSOW_QUOTE_NOT_FOUND) {
        setQuotes((list) => (list ? list.filter((x) => x.id !== id) : list));
      }
      setQuotesError(osowErrorMessage(e, "Couldn't open that quote."));
    } finally {
      setOpeningId(null);
    }
  };

  /** Back to a blank calculator; cost preferences return to what they were before a quote was opened. */
  const startNewEstimate = () => {
    seq.current++;
    setBusy(null);
    setForm({ ...emptyForm(), rigEdits: form.rigEdits });
    setRequest(null);
    setRequestForm(null);
    setResult(null);
    setRoadOverrides({});
    setSmoothing("conservative");
    setEscortCars(null);
    setPickupDate(nextWeekday());
    setPickupTime("08:00");
    setBroker(EMPTY_BROKER);
    setSaveOpenAt(null);
    setSaveName("");
    setAttempted(false);
    setFormError(null);
    setToggleError(null);
    setNotice(null);
    setActionMsg(null);
    setCurrentQuoteId(null);
    const previousSettings = settingsBeforeQuote.current;
    settingsBeforeQuote.current = null;
    if (previousSettings) {
      setCostText(previousSettings.costText);
      setEcon({ ...previousSettings.econ, loadRate: "", diesel: "", tolls: "" });
    } else {
      setEcon((current) => ({ ...current, loadRate: "", diesel: "", tolls: "" }));
    }
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const removeQuote = async (id: number) => {
    const wasOnScreen = id === currentQuoteId;
    try {
      await deleteQuote(id);
      setQuotes((list) => (list ? list.filter((x) => x.id !== id) : list));
      if (wasOnScreen) startNewEstimate();
    } catch (e) {
      if (e instanceof ApiError && e.code === OSOW_QUOTE_NOT_FOUND) {
        setQuotes((list) => (list ? list.filter((x) => x.id !== id) : list));
        if (wasOnScreen) startNewEstimate();
        return;
      }
      setQuotesError(osowErrorMessage(e, "Couldn't delete that quote."));
    }
  };

  const doSave = async (place: ActionPlace) => {
    if (!request || !result) return;
    if (brokerPhoneError || brokerEmailError) return;
    const name = saveName.trim() || `${request.origin} → ${request.destination}`;
    setSaveBusy(true);
    setActionMsg(null);
    try {
      const summary = await saveQuote({
        name: name.slice(0, 120),
        mode: econ.mode,
        input: { ...request, form: requestForm ?? undefined },
        result,
        economics: toSnapshot(econ),
        brokerName: broker.name.trim() || null,
        brokerPhone: broker.phone.trim() || null,
        brokerEmail: broker.email.trim() || null,
      });
      setQuotes((list) => [summary, ...(list ?? []).filter((q) => q.id !== summary.id)]);
      setCurrentQuoteId(summary.id);
      setSaveOpenAt(null);
      setActionMsg({ id: nextMessageId(), text: "Saved to your quotes.", ok: true, place });
    } catch (e) {
      setActionMsg({ id: nextMessageId(), text: osowErrorMessage(e, "Couldn't save the quote. Try again."), ok: false, place });
    } finally {
      setSaveBusy(false);
    }
  };

  const downloadPdf = async (place: ActionPlace) => {
    if (!request || !result || pdfBusy) return;
    setPdfBusy(true);
    setActionMsg(null);
    try {
      await withMinimumDuration(async () => {
        // Building the PDF blocks the page, so let the spinner paint first.
        await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const { downloadOsowPdf } = await import("./osowPdf");
        downloadOsowPdf({ request, result, econ, cargoLine: cargoLine(requestForm), broker });
      }, MIN_PDF_SPINNER_MS);
      setActionMsg({ id: nextMessageId(), text: "PDF downloaded.", ok: true, place });
    } catch {
      setActionMsg({ id: nextMessageId(), text: "Couldn't generate the PDF. Try again.", ok: false, place });
    } finally {
      setPdfBusy(false);
    }
  };

  const quoteActions = (place: ActionPlace) => (
    <>
      <button
        type="button"
        className="ed-btn"
        onClick={() => {
          setSaveOpenAt((current) => (current === place ? null : place));
          setSaveName("");
        }}
        aria-expanded={saveOpenAt === place}
      >
        <Save size={14} /> <span>Save quote</span>
      </button>
      <button type="button" className="ed-btn" onClick={() => downloadPdf(place)} disabled={pdfBusy}>
        {pdfBusy ? <Loader2 size={14} className="osw-spin" aria-hidden="true" /> : <Download size={14} />}{" "}
        <span aria-live="polite">{pdfBusy ? "Preparing PDF…" : "PDF"}</span>
      </button>
    </>
  );

  const saveForm = (place: ActionPlace, lane: string) => (
    <form
      className="osw-card"
      onSubmit={(e) => {
        e.preventDefault();
        doSave(place);
      }}
    >
      <div className="osw-card-head">
        <span className="osw-card-title">Save quote</span>
      </div>
      <div className="osw-card-body">
        <div className="osw-grid is-1">
          <SaveField label="Quote name" value={saveName} maxLength={120} placeholder={lane} onChange={(value) => setSaveName(sanitizeText(value, 120))} autoFocus />
        </div>
        <span className="osw-sublabel" style={{ display: "block", margin: "14px 0 8px" }}>
          Broker — optional
        </span>
        <div className="osw-grid is-3">
          <SaveField label="Name" value={broker.name} maxLength={120} placeholder="ACME Logistics" onChange={(value) => setBroker((current) => ({ ...current, name: sanitizeText(value, 120) }))} />
          <SaveField label="Phone" value={broker.phone} maxLength={25} placeholder="(312) 555-0142" inputMode="tel" error={brokerPhoneError} onChange={(value) => setBroker((current) => ({ ...current, phone: sanitizePhone(value) }))} />
          <SaveField label="Email" value={broker.email} maxLength={254} placeholder="dispatch@broker.com" inputMode="email" error={brokerEmailError} onChange={(value) => setBroker((current) => ({ ...current, email: sanitizeText(value.trim(), 254) }))} />
        </div>
        <div className="flex flex-wrap justify-end gap-2" style={{ marginTop: 12 }}>
          <button type="button" className="ed-btn" onClick={() => setSaveOpenAt(null)}>
            Cancel
          </button>
          <button type="submit" className="ed-btn ed-btn-accent" disabled={saveBusy || Boolean(brokerPhoneError || brokerEmailError)}>
            {saveBusy && <Loader2 size={14} className="osw-spin" aria-hidden="true" />}
            <span aria-live="polite">{saveBusy ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </div>
    </form>
  );

  const actionMessage = (place: ActionPlace) =>
    actionMsg && actionMsg.place === place ? (
      <ActionToast key={actionMsg.id} text={actionMsg.text} ok={actionMsg.ok} onDone={clearActionMsg} />
    ) : null;

  const visual: VisualModel = useMemo(
    () => ({
      rig: derived.rig,
      layout: derived.layout,
      cargo: derived.visualCargo,
      overall: { widthIn: derived.values.widthIn, heightIn: derived.values.heightIn, lengthIn: derived.values.lengthIn },
    }),
    [derived],
  );

  // The estimate on screen was priced from `request`; any input changed since then makes it stale.
  const stale = useMemo(() => {
    if (!request || !derived.load) return false;
    const current = { ...derived.load, axlesOverLegal: form.axlesOverLegal === true };
    const priced = { ...request.load, axlesOverLegal: request.load.axlesOverLegal === true };
    const costsNow = { ...costsFromText(costText), escortCars: escortCars ?? null };
    const costsPriced = { ...DEFAULT_COSTS, ...(request.costs ?? {}), escortCars: request.costs?.escortCars ?? null };
    return (
      stableJson(current) !== stableJson(priced) ||
      stableJson(costsNow) !== stableJson(costsPriced) ||
      form.origin.trim().replace(/\s+/g, " ") !== request.origin ||
      form.destination.trim().replace(/\s+/g, " ") !== request.destination ||
      pickupDate !== (request.pickupDate ?? pickupDate) ||
      pickupTime !== (request.pickupTime ?? pickupTime)
    );
  }, [request, derived.load, form.axlesOverLegal, form.origin, form.destination, costText, escortCars, pickupDate, pickupTime]);

  const routeKey = result?.polylines?.join("|") ?? "";
  const polylines = useMemo(() => (routeKey ? routeKey.split("|") : []), [routeKey]);

  const verified = coverage?.filter((c) => c.status === "verified").length ?? 0;
  // The day the verified set was last checked against the states' own sources (ISO dates sort as text).
  const verifiedAsOf =
    coverage
      ?.filter((c) => c.status === "verified" && c.verifiedOn)
      .map((c) => c.verifiedOn as string)
      .sort()
      .at(-1) ?? null;

  return (
    <section className="osw flex flex-col">
      {access && !access.termsAccepted && (
        <OsowTermsDialog
          busy={termsBusy}
          error={termsError}
          onAccept={agreeToTerms}
          onLeave={() => navigate("/business")}
        />
      )}
      <header className="flex flex-col gap-2">
        <h1 className="ed-display mt-3 flex items-center gap-3 flex-wrap" style={{ color: "var(--ink)" }}>
          OS/OW calculator
          <span className="tb-chip is-accent-o" style={{ fontSize: "0.7rem", letterSpacing: "0.06em" }}>
            Beta
          </span>
        </h1>
        <p className="ed-label" style={{ margin: 0 }}>
          Permits, escorts &amp; restrictions — every state on the route
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {access && (
            <span className="tb-chip is-muted" title="Fair-use limit per day (Central time)">
              Calculations today&nbsp;<b style={{ color: "var(--accent)" }}>{access.dailyUsed} / {access.dailyCap}</b>
            </span>
          )}
          {coverage && (
            <button
              type="button"
              className="tb-chip is-muted"
              style={{ cursor: "pointer", background: "transparent" }}
              aria-expanded={coverageOpen}
              onClick={() => setCoverageOpen((o) => !o)}
            >
              Rules for {coverage.length} of 48 states · {verified} verified
              {verifiedAsOf && <> as of {shortDate(verifiedAsOf)}</>}
              <ChevronDown size={11} style={{ transform: coverageOpen ? "rotate(180deg)" : "none" }} />
            </button>
          )}
        </div>
        {coverage && coverageOpen && <CoverageGrid coverage={coverage} />}
      </header>

      <div className="osw-strip is-warn mt-4" role="note">
        <AlertTriangle />
        <p>
          <b>{DISCLAIMER.split(" Verify")[0]}</b>{" "}
          <span className="osw-strip-sub">Verify with each state's permit office before quoting.</span>
        </p>
      </div>

      {off ? (
        <div className="osw-strip is-muted mt-6">
          <Info />
          <p>The OS/OW calculator is switched off right now. Please check back later.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] items-start">
            <LoadForm
              form={form}
              setForm={setForm}
              derived={derived}
              costText={costText}
              setCostText={setCostText}
              escortCars={escortCars}
              setEscortCars={setEscortCars}
              pickupDate={pickupDate}
              setPickupDate={setPickupDate}
              pickupTime={pickupTime}
              setPickupTime={setPickupTime}
              attempted={attempted}
              citySuggest={citySuggest}
              busy={busy != null}
              error={formError}
              onSubmit={submit}
            />
            <VisualCard
              model={visual}
              theme={theme}
              tab={visualTab}
              setTab={setVisualTab}
              derived={derived}
              axlesOverLegal={form.axlesOverLegal === true}
            />
          </div>

          {result && request && (
            <div ref={resultsRef} className="mt-10 flex flex-col gap-5" style={{ scrollMarginTop: 16 }}>
              {/* No route means nothing was priced: show why, not a sheet of $0 cards. */}
              <div className="flex flex-wrap items-end justify-between gap-3 pb-3" style={{ borderBottom: "1px solid var(--ink)" }}>
                <div className="min-w-0">
                  <span className="osw-sublabel">Estimate</span>
                  <h2 className="ed-display" style={{ color: "var(--ink)", marginTop: 4 }}>
                    {request.origin} → {request.destination}
                  </h2>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 4 }}>
                    {result.states.length > 0 && (
                      <>
                        {miles(result.routeMiles)} mi · {result.states.length} state{result.states.length === 1 ? "" : "s"}
                        {result.routeSource && result.routeSource !== "none"
                          ? ` · route ${result.routeSource === "cache" ? "from cache" : `by ${result.routeSource.toUpperCase()}`}`
                          : ""}
                        {" · "}
                      </>
                    )}
                    {formatFtIn(request.load.widthIn)} W × {formatFtIn(request.load.heightIn)} H × {formatFtIn(request.load.lengthIn)} L,{" "}
                    {formatLb(request.load.grossLb)} lb
                    {request.load.axlesOverLegal ? " · axles over legal" : ""}
                  </div>
                  {brokerLine(broker) && (
                    <div style={{ fontSize: "0.8rem", color: "var(--sub)", marginTop: 2 }}>Broker: {brokerLine(broker)}</div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {actionMessage("top")}
                  <button type="button" className="ed-btn" onClick={startNewEstimate}>
                    <RotateCcw size={14} /> <span>New estimate</span>
                  </button>
                  {result.states.length > 0 && quoteActions("top")}
                </div>
              </div>

              {saveOpenAt === "top" && saveForm("top", `${request.origin} → ${request.destination}`)}
              {notice && (
                <div className="osw-strip">
                  <Info />
                  <p>{notice}</p>
                </div>
              )}
              {stale && (
                <div className="osw-strip is-warn" role="status">
                  <AlertTriangle />
                  <p>
                    <b>Inputs changed since this estimate.</b>{" "}
                    <span className="osw-strip-sub">Press Calculate to price the load as it is now.</span>
                  </p>
                </div>
              )}

              {result.states.length > 0 && <Metrics result={result} request={request} />}
              <Warnings warnings={result.warnings ?? []} />
              {toggleError && (
                <div className="osw-strip is-danger" role="alert">
                  <ShieldAlert />
                  <p>{toggleError}</p>
                </div>
              )}

              {result.states.length > 0 && (
              <>
              <div className={"grid gap-5 items-start" + (polylines.length ? " lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]" : "")}>
                {polylines.length > 0 && (
                  <section className="osw-card">
                    <div className="osw-card-head">
                      <span className="osw-card-title">Route</span>
                      <span className="osw-card-sub flex items-center gap-3">
                        <span><i className="osw-swatch" style={{ background: "var(--ink)" }} />Origin</span>
                        <span><i className="osw-swatch" style={{ background: "var(--accent)" }} />Destination</span>
                        {(result.tripPlan?.stops?.length ?? 0) > 0 && (
                          <span><i className="osw-swatch is-stop" />Stops</span>
                        )}
                      </span>
                    </div>
                    <Suspense fallback={<div className="osw-map"><div className="osw-visual-empty">Loading map…</div></div>}>
                      <RouteMap
                        polylines={polylines}
                        theme={theme}
                        origin={request.origin}
                        destination={request.destination}
                        stops={result.tripPlan?.stops}
                        routeMiles={result.routeMiles}
                      />
                    </Suspense>
                  </section>
                )}
                <Legs result={result} />
              </div>

              {result.tripPlan && <TripPlanCard plan={result.tripPlan} />}

              <StateTable
                result={result}
                roadOverrides={roadOverrides}
                onRoad={onRoad}
                smoothing={smoothing}
                onSmoothing={onSmoothing}
                fixedEscortCars={request.costs.escortCars ?? null}
                busy={busy === "toggle"}
              />

              <Economics result={result} econ={econ} setEcon={setEcon} />

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3" style={{ borderTop: "1px solid var(--ink)" }}>
                {actionMessage("bottom")}
                {quoteActions("bottom")}
              </div>
              {saveOpenAt === "bottom" && saveForm("bottom", `${request.origin} → ${request.destination}`)}
              </>
              )}

              <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--muted)", lineHeight: 1.5 }}>
                {DISCLAIMER} Escorts at ${request.costs.escortRatePerMile.toFixed(2)}/mi, ${request.costs.escortHotelPerNight}/night.
              </p>
            </div>
          )}

          <div className="mt-10">
            <SavedQuotes quotes={quotes} error={quotesError} openingId={openingId} onOpen={openQuote} onDelete={removeQuote} />
          </div>
        </>
      )}
    </section>
  );
}

function VisualCard({
  model,
  theme,
  tab,
  setTab,
  derived,
  axlesOverLegal,
}: {
  model: VisualModel;
  theme: "light" | "dark";
  tab: "3d" | "2d";
  setTab: (t: "3d" | "2d") => void;
  derived: ReturnType<typeof deriveLoad>;
  axlesOverLegal: boolean;
}) {
  const labels = dimLabels(model);
  const v = derived.values;
  const oversize = labels.some((l) => l.over);
  const overweight = (v.grossLb != null && v.grossLb > 80_000) || axlesOverLegal;
  const ready = v.widthIn != null && v.heightIn != null && v.lengthIn != null;
  return (
    <section className="osw-card xl:sticky xl:top-6">
      <div className="osw-card-head">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="osw-card-title">Load model</span>
          {ready && (oversize || overweight) && (
            <span className="tb-chip is-danger">{[oversize && "Oversize", overweight && "Overweight"].filter(Boolean).join(" · ")}</span>
          )}
          {ready && !oversize && !overweight && v.grossLb != null && <span className="tb-chip is-ok">Legal size</span>}
        </span>
        <div className="tb-seg" role="tablist" aria-label="Load model view">
          <button type="button" role="tab" aria-selected={tab === "3d"} className={tab === "3d" ? "is-active" : ""} onClick={() => setTab("3d")}>
            3D
          </button>
          <button type="button" role="tab" aria-selected={tab === "2d"} className={tab === "2d" ? "is-active" : ""} onClick={() => setTab("2d")}>
            Side &amp; rear
          </button>
        </div>
      </div>
      {tab === "3d" ? (
        <Suspense fallback={<div className="osw-visual"><div className="osw-visual-empty">Loading 3D…</div></div>}>
          <LoadModel3D model={model} theme={theme} onFallback={() => setTab("2d")} />
        </Suspense>
      ) : (
        <Schematic model={model} />
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: "0.74rem", color: "var(--muted)" }}>
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{rigById(model.rig.id).label}</span>
        {labels.filter((l) => !l.missing).map((l) => (
          <span key={l.key} style={{ color: l.over ? "var(--osw-danger)" : "var(--sub)", fontWeight: 600 }}>
            {l.text}
          </span>
        ))}
        {v.grossLb != null && (
          <span style={{ color: overweight ? "var(--osw-danger)" : "var(--sub)", fontWeight: 600 }}>{formatLb(v.grossLb)} lb</span>
        )}
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="0" y1="4" x2="18" y2="4" style={{ stroke: "var(--osw-ok)", strokeWidth: 1.5, strokeDasharray: "4 3" }} />
          </svg>
          Legal envelope
        </span>
        <span className="flex items-center gap-1.5">
          <i className="osw-swatch" style={{ background: "color-mix(in srgb, var(--osw-danger) 55%, transparent)", margin: 0 }} />
          Over
        </span>
      </div>
    </section>
  );
}

function Metrics({ result, request }: { result: CalculateResponse; request: CalculateRequest }) {
  const t = result.totals;
  const policeStates = result.states.filter((s) => s.policeCount > 0).length;
  return (
    <div className="osw-metrics">
      <div>
        <div className="osw-metric-k">Total OS/OW cost</div>
        <div className="osw-metric-v is-big">{usd(t.total)}</div>
        <div className="osw-metric-s" style={!t.complete ? { color: "var(--osw-warn)", fontWeight: 600 } : undefined}>
          {t.complete
            ? policeStates > 0
              ? "Permits + escorts + police"
              : "Permits + escorts"
            : policeStates > 0 && !request.costs.policeCostEach
              ? "Incomplete — police not priced"
              : t.unpricedLines
                ? `Incomplete — ${t.unpricedLines} line${t.unpricedLines === 1 ? "" : "s"} set by state`
                : "Incomplete — see warnings"}
        </div>
      </div>
      <div>
        <div className="osw-metric-k">Permits</div>
        <div className="osw-metric-v">{usd(t.permits)}</div>
        <div className="osw-metric-s">{result.states.filter((s) => s.covered).length} states priced</div>
      </div>
      <div>
        <div className="osw-metric-k">Escorts</div>
        <div className="osw-metric-v">{usd(t.escorts)}</div>
        <div className="osw-metric-s">
          {t.escortVehicleMiles > 0 ? `${miles(t.escortVehicleMiles)} escort miles · ${t.escortNights} car-night${t.escortNights === 1 ? "" : "s"}` : "None required"}
        </div>
      </div>
      <div>
        <div className="osw-metric-k">Police</div>
        <div className="osw-metric-v">{policeStates === 0 ? "—" : request.costs.policeCostEach ? usd(t.police) : "Required"}</div>
        <div className="osw-metric-s">
          {policeStates === 0 ? "Not required" : `${policeStates} state${policeStates === 1 ? "" : "s"}${request.costs.policeCostEach ? "" : " · not priced"}`}
        </div>
      </div>
      <div>
        <div className="osw-metric-k">Flags</div>
        <div className="flex flex-wrap gap-1 mt-2">
          {result.flags.superload && <span className="tb-chip is-danger">Superload</span>}
          {result.flags.survey && <span className="tb-chip is-warn">Route survey</span>}
          {result.flags.police && <span className="tb-chip is-danger">Police</span>}
          {!result.flags.superload && !result.flags.survey && !result.flags.police && (
            <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>None</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Warnings({ warnings }: { warnings: OsowWarning[] }) {
  if (!warnings.length) return null;
  const order = { danger: 0, warn: 1, muted: 2 } as const;
  const items = warnings
    .map((w, i) => ({ w, i, meta: WARNING_META[w.code] ?? { title: "Note", tone: "warn" as const, fallback: "" } }))
    .sort((a, b) => order[a.meta.tone] - order[b.meta.tone] || a.i - b.i);
  return (
    <div className="flex flex-col gap-2">
      {items.map(({ w, i, meta }) => (
        <div key={i} className={`osw-strip is-${meta.tone}`} role={meta.tone === "danger" ? "alert" : undefined}>
          {meta.tone === "muted" ? <Info /> : <AlertTriangle />}
          <p>
            <b>
              {meta.title}
              {w.state ? ` — ${w.state}` : ""}.
            </b>{" "}
            <span className="osw-strip-sub">{w.message || meta.fallback}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function Legs({ result }: { result: CalculateResponse }) {
  const rows = result.states ?? [];
  const max = Math.max(1, ...rows.map((r) => r.miles || 0));
  return (
    <section className="osw-card">
      <div className="osw-card-head">
        <span className="osw-card-title">States on the route</span>
        <span className="osw-card-sub flex items-center gap-3">
          <span><i className="osw-swatch" style={{ background: "var(--accent)" }} />Freeway</span>
          <span><i className="osw-swatch" style={{ background: "color-mix(in srgb, var(--ink) 35%, transparent)" }} />2-lane</span>
        </span>
      </div>
      <div className="osw-card-body" style={{ paddingTop: 8, paddingBottom: 10 }}>
        {rows.length === 0 && <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>No route legs — see the warnings above.</p>}
        {rows.map((r, i) => (
          <div className="osw-leg" key={`${r.state}-${i}`}>
            <b>{r.state}</b>
            <div className="osw-leg-bar" title={`${r.name}: ${miles(r.interstateMiles)} interstate + ${miles(r.otherMiles)} other miles`}>
              <i className="is-i" style={{ width: `${(r.interstateMiles / max) * 100}%` }} />
              <i className="is-o" style={{ width: `${(r.otherMiles / max) * 100}%` }} />
            </div>
            <span style={{ color: "var(--sub)", minWidth: "3.2rem", textAlign: "right" }}>{miles(r.miles)} mi</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoverageGrid({ coverage }: { coverage: StateCoverage[] }) {
  const byCode = new Map(coverage.map((c) => [c.state, c]));
  return (
    <div className="flex flex-col gap-2 mt-1" style={{ maxWidth: 720 }}>
      <div className="flex flex-wrap gap-1">
        {US48.map((code) => {
          const c = byCode.get(code);
          const cls = !c ? "is-muted" : c.status === "verified" ? "is-ok" : "is-warn";
          const title = !c
            ? `${code}: no rules yet`
            : c.status === "verified"
              ? `${c.name}: verified ${shortDate(c.verifiedOn)}`
              : `${c.name}: draft, researched ${shortDate(c.researchedOn)}`;
          return (
            <span key={code} className={`tb-chip ${cls}`} title={title} style={{ minWidth: 34, justifyContent: "center", opacity: c ? 1 : 0.55 }}>
              {code}
            </span>
          );
        })}
      </div>
      <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
        Draft = researched from official state sources, not yet verified by us. Verified = checked against the state's
        own site on the date shown.
      </span>
    </div>
  );
}

const EMPTY_BROKER: BrokerContact = { name: "", phone: "", email: "" };

/** Runs the work, then waits out the rest of `minimumMs` so a spinner reads as feedback, not a flicker. */
async function withMinimumDuration(work: () => Promise<void>, minimumMs: number): Promise<void> {
  const startedAt = performance.now();
  await work();
  const elapsed = performance.now() - startedAt;
  if (elapsed < minimumMs) {
    await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
  }
}

/** JSON with sorted keys, so a quote read back from the database compares equal to what was sent. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );
}

/** Each Save quote / PDF note gets its own id so a repeat of the same text plays again. */
let lastMessageId = 0;
function nextMessageId(): number {
  lastMessageId += 1;
  return lastMessageId;
}

/** Where the Save quote / PDF pair was used: above the results or under Economics. */
type ActionPlace = "top" | "bottom";

/** "ACME Logistics · (312) 555-0142 · dispatch@acme.com", or empty when nothing was entered. */
function brokerLine(broker: BrokerContact): string {
  return [broker.name, broker.phone, broker.email].map((part) => part.trim()).filter(Boolean).join(" · ");
}

function SaveField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  inputMode,
  error,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  inputMode?: "text" | "tel" | "email";
  error?: string | null;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="osw-field">
      <label className="osw-flabel" htmlFor={id}>
        <span>{label}</span>
      </label>
      <input
        id={id}
        className={"ed-input osw-input" + (error ? " is-error" : "")}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={"osw-hint" + (error ? " is-error" : "")}>{error ?? ""}</span>
    </div>
  );
}
