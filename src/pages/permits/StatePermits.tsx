/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Header, Footer } from "../../App";
import { usePageMeta } from "../../lib/meta";
import {
  CALCULATOR_PATH,
  LANDING_PATH,
  STATE_INDEX,
  flagPath,
  loadState,
  readableDate,
  stateEntry,
  statePath,
  type EscortLine,
  type Line,
  type StatePage,
} from "./permitsData";
import "./permits.css";

function escortText(line: EscortLine): string {
  const parts = [];
  if (line.front) parts.push(line.front === 1 ? "1 front" : `${line.front} front`);
  if (line.rear) parts.push(line.rear === 1 ? "1 rear" : `${line.rear} rear`);
  return parts.join(" + ") + (line.front + line.rear === 1 ? " pilot car" : " pilot cars");
}

function RuleList({ lines }: { lines: Line[] }) {
  return (
    <div className="tbp-rules">
      {lines.map((line, index) => (
        <div key={index} className="tbp-rule">
          <span className="tbp-when">{line.when}</span>
          <span className="tbp-what">{line.text ?? "Required"}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <div className="tb-prose max-w-xl">
        <h2>{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StateBody({ page }: { page: StatePage }) {
  const checked = readableDate(page.verifiedOn) ?? readableDate(page.researchedOn);
  const flags = [
    ...page.police.map((line) => ({ ...line, when: `Police: ${line.when.toLowerCase()}` })),
    ...page.survey.map((line) => ({ ...line, when: `Route survey: ${line.when.toLowerCase()}`, text: line.text ?? "Route survey before the permit is issued" })),
    ...page.superload.map((line) => ({ ...line, when: `Superload: ${line.when.toLowerCase()}`, text: line.text ?? "Superload review by the state" })),
  ];

  return (
    <>
      <dl className="tbp-facts mt-10" style={{ maxWidth: 860 }}>
        {page.legal.width && (
          <div>
            <dt>Legal width</dt>
            <dd>{page.legal.width}</dd>
          </div>
        )}
        {page.legal.height && (
          <div>
            <dt>Legal height</dt>
            <dd>{page.legal.height}</dd>
          </div>
        )}
        <div>
          <dt>Legal length</dt>
          <dd>{page.legal.length ?? (page.legal.trailerLength ? `${page.legal.trailerLength} trailer` : "—")}</dd>
        </div>
        {page.legal.gross && (
          <div>
            <dt>Legal gross</dt>
            <dd>{page.legal.gross}</dd>
          </div>
        )}
      </dl>

      {page.fees.length > 0 && (
        <Section title={`${page.name} permit fees`}>
          <div className="tbp-rules">
            {page.fees.map((fee, index) => (
              <div key={index} className="tbp-rule">
                <span className="tbp-when">
                  {fee.when}
                  {fee.amount && (
                    <>
                      <br />
                      <span style={{ color: "var(--accent)" }}>{fee.amount}</span>
                    </>
                  )}
                </span>
                <span className="tbp-what">{fee.note ?? ""}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {page.escorts.length > 0 && (
        <Section title="Escort vehicles">
          <RuleList lines={page.escorts.map((line) => ({ when: line.when, text: escortText(line) + (line.note ? `. ${line.note}` : "") }))} />
        </Section>
      )}

      {flags.length > 0 && (
        <Section title="Police escorts, route surveys and superloads">
          <RuleList lines={flags} />
        </Section>
      )}

      {page.travel.length > 0 && (
        <Section title={`When you can travel in ${page.name}`}>
          <RuleList
            lines={page.travel.map((line) => ({
              when: line.when,
              text: [
                line.daylightOnly ? "Daylight only" : "Around the clock",
                line.weekends,
                line.holidays
                  ? line.holidays + (line.holidayNames.length ? ` (${line.holidayNames.join(", ")})` : "")
                  : null,
                ...line.closures,
                line.note,
              ]
                .filter(Boolean)
                .join(". "),
            }))}
          />
        </Section>
      )}

      {page.restrictions.length > 0 && (
        <Section title="Other restrictions">
          <RuleList lines={page.restrictions} />
        </Section>
      )}

      {page.notes.length > 0 && (
        <Section title="Good to know">
          <ul className="tbp-sources">
            {page.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </Section>
      )}

      {page.office && (
        <Section title="Permit office">
          <p style={{ color: "var(--ink)", fontWeight: 700 }}>{page.office.name}</p>
          <p className="mt-2" style={{ color: "var(--muted)" }}>
            {page.office.phone && <>Phone {page.office.phone}. </>}
            {page.office.url && (
              <a href={page.office.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                Permit office website
              </a>
            )}
            {page.office.orderUrl && (
              <>
                {" · "}
                <a href={page.office.orderUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                  Order a permit online
                </a>
              </>
            )}
          </p>
        </Section>
      )}

      <Section title="Sources">
        <p style={{ color: "var(--muted)" }}>
          <span className={"tbp-chip " + (page.verified ? "is-ok" : "is-draft")}>{page.verified ? "Verified" : "Draft"}</span>{" "}
          {page.verified ? `Checked against these sources on ${checked}.` : `Researched from these sources on ${checked}; not yet verified.`}
        </p>
        <ul className="tbp-sources mt-4">
          {page.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

export default function StatePermits() {
  const { slug } = useParams();
  const entry = stateEntry(slug);
  const [loaded, setLoaded] = useState<{ slug: string; page: StatePage } | null>(null);
  const page = entry && loaded?.slug === entry.slug ? loaded.page : null;
  useEffect(() => {
    if (!entry) return;
    let active = true;
    loadState(entry.slug)
      .then((statePage) => {
        if (active) setLoaded({ slug: entry.slug, page: statePage });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [entry]);

  usePageMeta({
    title: entry
      ? `${entry.name} Oversize Permit Cost, Escorts & Travel Times (2026) | TruckBox`
      : "Oversize permits by state | TruckBox",
    description: entry
      ? `${entry.name} oversize and overweight permits: legal limits, permit fees, escort and police requirements, and when loads can travel, from ${entry.name}'s own sources. Price a route through ${entry.name} free.`
      : "Oversize permit rules for every state.",
    path: entry ? statePath(entry.slug) : LANDING_PATH,
  });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  if (!entry) return <Navigate to={LANDING_PATH} replace />;

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Oversize permit calculator", item: `https://truckbox.app${LANDING_PATH}` },
      { "@type": "ListItem", position: 2, name: `${entry.name} oversize permits`, item: `https://truckbox.app${statePath(entry.slug)}` },
    ],
  };

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main style={{ paddingTop: 64 }}>
        <section className="ed-section">
          <div className="ed-container">
            <nav className="ed-label" aria-label="Breadcrumb">
              <Link to={LANDING_PATH} className="hover:text-[color:var(--ink)]">
                OS/OW permit calculator
              </Link>{" "}
              / {entry.name}
            </nav>
            <div className="max-w-3xl">
              <img className="tbp-flag-hero mt-8" src={flagPath(entry.slug)} alt={`Flag of ${entry.name}`} height={56} />
              <h1 className="ed-h2 mt-4">{entry.name} oversize and overweight permits: fees, escorts and travel times</h1>
              <p className="mt-6 text-lg" style={{ color: "var(--muted)" }}>
                What {entry.name} requires for an oversize or overweight load, from its own manuals, statutes and fee
                schedules. To price a whole route, with every state on it, use the free calculator.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="ed-btn ed-btn-accent" to={CALCULATOR_PATH}>
                  <span>Price a {entry.name} route</span>
                </Link>
              </div>
            </div>

            {page ? <StateBody page={page} /> : <div className="tbp-loading" data-prerender-pending aria-busy="true" />}

            <p className="mt-14 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
              Estimates from public state sources, not a permit. Rules change: verify with the {entry.name} permit office
              before you quote or move.
            </p>

            <div className="mt-16">
              <div className="tb-prose max-w-xl">
                <h2>Other states</h2>
              </div>
              <nav className="tbp-states mt-6" aria-label="Other states">
                {STATE_INDEX.filter((other) => other.code !== entry.code).map((other) => (
                  <Link key={other.code} to={statePath(other.slug)}>
                    <img className="tbp-states-flag" src={flagPath(other.slug)} alt="" loading="lazy" height={20} />
                    <b>{other.name}</b>
                    <span>{other.verified ? "Verified" : "Draft"}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
    </div>
  );
}
