/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// OS/OW estimate as a PDF (same approach as teamReportPdf.ts). Loaded on demand from the panel.
// jsPDF's built-in Helvetica only knows Latin-1: one character outside it switches the whole string to
// a two-byte encoding that renders as garbage, so every string goes through latin1() first.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { computeLedger, type EconForm } from "./econModel";
import { durationLabel, stopPlace, stopReasonsLabel, tripDayLabel, tripMomentLabel } from "./format";
import { DISCLAIMER, humanize, SMOOTHING_OPTIONS } from "./format";
import { formatFtIn, formatLb } from "./parseDims";
import type { BrokerContact, CalculateRequest, CalculateResponse, StateRow } from "./types";

const INK: [number, number, number] = [10, 10, 10];
const MUTED: [number, number, number] = [110, 112, 120];
const ACCENT: [number, number, number] = [58, 91, 255];
const HAIRLINE: [number, number, number] = [220, 220, 225];
const WARN: [number, number, number] = [149, 77, 11];
const WARN_BG: [number, number, number] = [253, 244, 232];
const MARGIN = 44;

const MAP: Record<string, string> = {
  "—": "-",
  "–": "-",
  "−": "-",
  "→": "->",
  "←": "<-",
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  "′": "'",
  "″": '"',
  "…": "...",
  "≥": ">=",
  "≤": "<=",
  "•": "·",
  " ": " ",
};

function latin1(s: string | null | undefined): string {
  if (!s) return "";
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (MAP[ch] != null) out += MAP[ch];
    else if (ch.charCodeAt(0) <= 255) out += ch;
    else {
      const base = ch.normalize("NFKD").replace(/[^\x20-\xff]/g, "");
      out += base || "?";
    }
  }
  return out;
}

function money(n: number | null | undefined, cents = true): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return (n < 0 ? "-$" : "$") + abs;
}

function mi(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "-" : Math.round(n).toLocaleString("en-US");
}

function escorts(e: { front: number; rear: number } | null): string {
  if (!e || (!e.front && !e.rear)) return "-";
  return [e.front ? `${e.front} front` : "", e.rear ? `${e.rear} rear` : ""].filter(Boolean).join(", ");
}

function flags(r: StateRow): string {
  const f: string[] = [];
  if (r.policeCount > 0) f.push(`Police x${r.policeCount}`);
  if (r.survey) f.push("Survey");
  if (r.superload) f.push("Superload");
  return f.join(", ") || "-";
}

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

function after(doc: Doc, gap = 22): number {
  return (doc.lastAutoTable?.finalY ?? 120) + gap;
}

function heading(doc: Doc, text: string, y: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y > h - 120) {
    doc.addPage();
    y = 60;
  }
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
  doc.text(latin1(text).toUpperCase(), MARGIN, y);
  return y + 8;
}

const tableBase = {
  margin: { left: MARGIN, right: MARGIN, bottom: 56 },
  theme: "grid" as const,
  styles: {
    font: "helvetica",
    fontSize: 8.5,
    cellPadding: 4.5,
    textColor: INK,
    lineColor: HAIRLINE,
    lineWidth: 0.5,
    overflow: "linebreak" as const,
  },
  headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" as const, fontSize: 8 },
};

export type OsowPdfInput = {
  request: CalculateRequest;
  result: CalculateResponse;
  econ: EconForm;
  cargoLine: string | null;
  name?: string;
  broker?: BrokerContact;
};

export function buildOsowDoc(input: OsowPdfInput, now: Date): jsPDF {
  const { request, result, econ } = input;
  const doc = new jsPDF({ unit: "pt", format: "letter" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Header
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...INK);
  doc.text("TRUCK", MARGIN, 54);
  doc.setTextColor(...ACCENT);
  doc.text("BOX", MARGIN + doc.getTextWidth("TRUCK"), 54);
  doc.setFontSize(20).setTextColor(...INK);
  doc.text("OS/OW Permit & Escort Estimate", MARGIN, 86);
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...MUTED);
  const lane = `${request.origin} to ${request.destination}  ·  ${mi(result.routeMiles)} mi  ·  ${result.states.length} state${result.states.length === 1 ? "" : "s"}  ·  ${dateStr}`;
  doc.text(latin1(lane), MARGIN, 104);
  const brokerLine = [input.broker?.name, input.broker?.phone, input.broker?.email]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("  ·  ");
  const subLine = [input.name, brokerLine ? `Prepared for ${brokerLine}` : null].filter(Boolean).join("  ·  ");
  if (subLine) {
    doc.setFontSize(9.5);
    doc.text(latin1(subLine), MARGIN, 118);
  }

  // Disclaimer box
  const boxY = subLine ? 128 : 116;
  doc.setFillColor(...WARN_BG).setDrawColor(...WARN).setLineWidth(0.8);
  doc.rect(MARGIN, boxY, pageW - MARGIN * 2, 24, "F");
  doc.line(MARGIN, boxY, MARGIN, boxY + 24);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...WARN);
  doc.text(latin1(DISCLAIMER), MARGIN + 10, boxY + 15.5);

  // Load
  let y = heading(doc, "Load", boxY + 50);
  const L = request.load;
  const loadRows: string[][] = [
    ["Overall width", formatFtIn(L.widthIn), "Overall height", formatFtIn(L.heightIn)],
    [
      "Overall length",
      formatFtIn(L.lengthIn),
      "Gross weight",
      `${formatLb(L.grossLb)} lb${L.axlesOverLegal ? " (axles over legal)" : ""}`,
    ],
    ["Front overhang", L.frontOverhangIn ? formatFtIn(L.frontOverhangIn) : "0", "Rear overhang", L.rearOverhangIn ? formatFtIn(L.rearOverhangIn) : "0"],
    [
      "Axles",
      String(L.axles),
      "Escort carry",
      request.costs.escortCars != null
        ? `${request.costs.escortCars} car${request.costs.escortCars === 1 ? "" : "s"}, whole route`
        : (SMOOTHING_OPTIONS.find((o) => o.value === request.smoothing)?.label ?? request.smoothing),
    ],
  ];
  if (input.cargoLine) loadRows.push(["Cargo & trailer", input.cargoLine, "", ""]);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    body: loadRows.map((r) => r.map(latin1)),
    columnStyles: {
      0: { textColor: MUTED, cellWidth: 92 },
      1: { fontStyle: "bold" },
      2: { textColor: MUTED, cellWidth: 92 },
      3: { fontStyle: "bold" },
    },
    didParseCell: (d) => {
      if (input.cargoLine && d.section === "body" && d.row.index === loadRows.length - 1 && d.column.index === 1) {
        d.cell.colSpan = 3;
      }
    },
  });

  // States
  y = heading(doc, "By state", after(doc));
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [["State", "Miles (freeway / 2-lane)", "Priced as", "Permit", "Escorts - freeway", "Escorts - 2-lane", "Flags", "Data"]],
    body: result.states.map((r) =>
      [
        `${r.state} ${r.name}`,
        `${mi(r.miles)} (${mi(r.interstateMiles)} / ${mi(r.otherMiles)})`,
        request.roadOverrides[r.state]
          ? request.roadOverrides[r.state] === "interstate"
            ? "Freeway (set)"
            : "2-lane (set)"
          : r.roadUsed === "mixed"
            ? "Mixed"
            : r.roadUsed === "interstate"
              ? "Freeway"
              : "2-lane",
        r.covered ? money(r.permitTotal ?? 0) + (r.permitComplete ? "" : " +") : "Not included",
        r.covered ? escorts(r.escortsInterstate) : "-",
        r.covered ? escorts(r.escortsOther) : "-",
        flags(r),
        !r.covered ? "No data" : r.status === "verified" ? "Verified" : "Draft",
      ].map(latin1),
    ),
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
  });
  // Next section starts below the table, or below a note printed under it.
  let next = after(doc, 30);
  const note = (text: string, bold = false) => {
    const ny = after(doc, 13);
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8.5).setTextColor(...(bold ? WARN : MUTED));
    doc.text(latin1(text), MARGIN, ny);
    next = ny + 28;
  };
  if (result.states.some((r) => r.covered && !r.permitComplete)) {
    note("+ = the state also sets some fees case by case; those are not included.");
  }

  // Totals
  const t = result.totals;
  y = heading(doc, "Totals", next);
  const totals: string[][] = [
    ["Permits", money(t.permits)],
    [
      "Escorts",
      `${money(t.escorts)}   (${mi(t.escortVehicleMiles)} vehicle-mi at ${money(request.costs.escortRatePerMile)}/mi, ${t.escortNights} hotel night${t.escortNights === 1 ? "" : "s"} at ${money(request.costs.escortHotelPerNight, false)})`,
    ],
  ];
  if (t.police || result.flags.police) {
    totals.push(["Police escorts", request.costs.policeCostEach ? money(t.police) : "Required in some states - not priced"]);
  }
  totals.push(["Total OS/OW cost", money(t.total)]);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    body: totals.map((r) => r.map(latin1)),
    columnStyles: { 0: { textColor: MUTED, cellWidth: 130 }, 1: { fontStyle: "bold" } },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === totals.length - 1) {
        d.cell.styles.fillColor = [244, 244, 246];
        d.cell.styles.fontSize = 10;
        d.cell.styles.textColor = INK;
      }
    },
  });
  next = after(doc, 30);
  if (!t.complete) {
    note(
      t.unpricedLines
        ? `Incomplete: ${t.unpricedLines} fee line${t.unpricedLines === 1 ? " is" : "s are"} set by the state case by case and not included.`
        : "Incomplete: some states on the route are not covered or the route could not be fully priced.",
      true,
    );
  }

  // Trip plan
  const plan = result.tripPlan;
  if (plan) {
    y = heading(doc, "Trip plan", next);
    const holdLabels: Record<string, string> = {
      NIGHT: "night",
      CURFEW: "hours limit",
      WEEKEND: "weekend",
      HOLIDAY: "holiday",
      HOS_REST: "10 h rest",
      HOS_RESTART: "34 h restart",
    };
    const planRows: string[][] = [
      [
        "Pickup / arrival",
        `${tripMomentLabel(plan.pickup)}  ->  ${tripMomentLabel(plan.arrival)}`,
        `${plan.transitDays} day${plan.transitDays === 1 ? "" : "s"}`,
        "",
        "",
      ],
      ...plan.days.map((day) => [
        tripDayLabel(day.date),
        day.miles > 0 ? `${mi(day.miles)} mi` : "Held",
        day.miles > 0 ? `${day.driveHours.toFixed(1)} h` : "",
        day.states.join(" > "),
        day.holds.map((reason) => holdLabels[reason] ?? reason).join(", "),
      ]),
    ];
    autoTable(doc, {
      ...tableBase,
      startY: y,
      body: planRows.map((row) => row.map(latin1)),
      columnStyles: { 0: { textColor: MUTED, cellWidth: 90 }, 2: { halign: "right" } },
      didParseCell: (cell) => {
        if (cell.section === "body" && cell.row.index === 0) {
          cell.cell.styles.fillColor = [244, 244, 246];
          cell.cell.styles.textColor = INK;
          cell.cell.styles.fontStyle = "bold";
        }
      },
    });
    const stops = plan.stops ?? [];
    if (stops.length > 0) {
      autoTable(doc, {
        ...tableBase,
        startY: after(doc, 10),
        head: [["#", "Stop", "Where", "Local time", "Length"]],
        body: stops.map((stop, stopIndex) =>
          [
            String(stopIndex + 1),
            stopReasonsLabel(stop),
            `Mile ${mi(stop.routeMile)}, ${stopPlace(stop)}`,
            `${tripMomentLabel(stop.start)}  ->  ${tripMomentLabel(stop.end)}`,
            durationLabel(stop.hours),
          ].map(latin1),
        ),
        columnStyles: { 0: { cellWidth: 22, textColor: MUTED }, 4: { halign: "right" } },
      });
    }
    next = after(doc, 30);
    note(
      "Hours of service, daylight, weekend, holiday and published weekly curfews applied; city rush-hour curfews not modeled.",
    );
  }

  // Economics
  const ledger = computeLedger(result, econ);
  y = heading(doc, econ.mode === "carrier" ? "Carrier economics" : "Customer quote", next);
  let econRows: string[][];
  if (econ.mode === "carrier") {
    econRows = ledger.lines.map((l) => [l.label + (l.note ? ` (${l.note})` : ""), money(l.amount)]);
    if (ledger.headline.perMile != null) econRows.push(["Profit per mile", money(ledger.headline.perMile)]);
  } else if (econ.itemize) {
    const price = ledger.headline.value;
    econRows = [
      ["Linehaul", money(price != null ? price - ledger.passThrough : null)],
      ["Permits (pass-through)", money(t.permits)],
      ["Escorts (pass-through)", money(t.escorts)],
      ...(t.police ? [["Police escorts (pass-through)", money(t.police)]] : []),
      ["Total", money(price)],
    ];
  } else {
    econRows = [["All-in price", money(ledger.headline.value)]];
  }
  autoTable(doc, {
    ...tableBase,
    startY: y,
    body: econRows.map((r) => r.map(latin1)),
    columnStyles: { 0: { textColor: MUTED }, 1: { halign: "right", fontStyle: "bold", cellWidth: 110 } },
    didParseCell: (d) => {
      const label = String(econRows[d.row.index]?.[0] ?? "");
      if (d.section === "body" && /^(Profit( before .*)?|Total|All-in price|Customer price)$/.test(label)) {
        d.cell.styles.fillColor = [244, 244, 246];
        d.cell.styles.textColor = INK;
        d.cell.styles.fontSize = 10;
      }
    },
  });

  // Warnings
  const warnings = (result.warnings ?? []).filter((w) => w.message);
  if (warnings.length) {
    y = heading(doc, "Warnings", after(doc, 30));
    autoTable(doc, {
      ...tableBase,
      startY: y,
      body: warnings.map((w) => [latin1(w.state ?? ""), latin1(w.message)]),
      columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } },
    });
  }

  // Restrictions, notes, offices
  const covered = result.states.filter((r) => r.covered);
  if (covered.length) {
    y = heading(doc, "Restrictions & permit offices", after(doc, 30));
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [["State", "Restrictions & notes", "Permit office"]],
      body: covered.map((r) => {
        const fees = (r.fees ?? []).filter((f) => f.amount == null).map((f) => `${humanize(f.id)}: set by the state`);
        const lines = [...(r.restrictions ?? []), ...(r.policeNotes ?? []), ...(r.notes ?? []), ...fees];
        const office = r.permitOffice;
        return [
          r.state,
          lines.length ? lines.map((x) => `· ${x}`).join("\n") : "-",
          office ? [office.name, office.phone, office.url].filter(Boolean).join("\n") : "-",
        ].map(latin1);
      }),
      columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" }, 2: { cellWidth: 150 } },
      styles: { ...tableBase.styles, fontSize: 7.5 },
    });

    const srcRows = covered.flatMap((r) => (r.sources ?? []).map((s, i) => [r.state, `[${i + 1}] ${s.title}`, s.url]));
    if (srcRows.length) {
      y = heading(doc, "Sources", after(doc, 30));
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [["State", "Source", "Link"]],
        body: srcRows.map((r) => r.map(latin1)),
        columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" }, 2: { textColor: ACCENT, cellWidth: 220 } },
        styles: { ...tableBase.styles, fontSize: 7 },
      });
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.6);
    doc.line(MARGIN, h - 42, pageW - MARGIN, h - 42);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...WARN);
    doc.text(latin1(DISCLAIMER), MARGIN, h - 30);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text("Generated by TruckBox  ·  truckbox.app", MARGIN, h - 18);
    doc.text(`${i} / ${pages}`, pageW - MARGIN, h - 18, { align: "right" });
  }
  return doc;
}

export function downloadOsowPdf(input: OsowPdfInput): void {
  const now = new Date();
  const doc = buildOsowDoc(input, now);
  const slug = `${input.request.origin}-${input.request.destination}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  doc.save(`truckbox-osow-${slug || "estimate"}-${now.toISOString().slice(0, 10)}.pdf`);
}
