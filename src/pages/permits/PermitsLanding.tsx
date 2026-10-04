/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  Clock,
  FileDown,
  FileText,
  Receipt,
  Route,
  Ruler,
  Siren,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { Header, Footer } from "../../App";
import { usePageMeta } from "../../lib/meta";
import { installLink } from "../business/installLink";
import { CALCULATOR_PATH, LANDING_PATH, LAST_CHECKED, SOURCE_COUNT, STATE_INDEX, VERIFIED_COUNT, statePath } from "./permitsData";
import { QuickStart } from "./QuickStart";
import { EXAMPLE_LANE, EXAMPLE_LOAD, EXAMPLE_PRICED_ON, EXAMPLE_STATES, EXAMPLE_TOTALS } from "./example";
import { LEGAL, RIGS, type Rig } from "../business/osow/equipment";
import { StateTileMap } from "./StateTileMap";
import { TrailerProfile } from "./TrailerProfile";
import "./permits.css";

function feet(inches: number): string {
  const rest = inches % 12;
  return rest === 0 ? `${inches / 12}'` : `${Math.floor(inches / 12)}'${rest}"`;
}

function trailerFacts(rig: Rig) {
  const loading = rig.kind === "flatbed" ? rig.deckLengthIn : Math.min(rig.wellLengthIn ?? rig.deckLengthIn, rig.deckLengthIn);
  return [
    { label: "Deck", value: feet(rig.deckHeightIn) },
    { label: "Length", value: rig.stretchToIn ? `${feet(loading)}–${feet(rig.stretchToIn)}` : feet(loading) },
    { label: "Legal cargo", value: feet(LEGAL.heightIn - rig.deckHeightIn) },
  ];
}

const LANDING_RIGS = [...RIGS.filter((rig) => rig.towVehicle === "pickup"), ...RIGS.filter((rig) => rig.towVehicle !== "pickup")];

const PRICED: { icon: LucideIcon; label: string }[] = [
  { icon: FileText, label: "Permit fees" },
  { icon: Car, label: "Escort cars" },
  { icon: Siren, label: "Police escorts" },
  { icon: Route, label: "Route surveys" },
  { icon: Weight, label: "Superloads" },
  { icon: Clock, label: "Travel curfews" },
  { icon: CalendarDays, label: "Trip days" },
  { icon: Receipt, label: "Tolls and profit" },
  { icon: FileDown, label: "PDF quotes" },
];

const GALLERY = [
  { name: "load", caption: "Cargo, trailer and a 3D check", alt: "The calculator's load form with a 28 foot excavator on an RGN and its 3D model, width and height marked over legal", width: 1680, height: 1076 },
  { name: "states", caption: "Every state, with its order link", alt: "Per-state table: Texas, Arkansas, Missouri and Illinois with miles, road class, permit fee, escorts and order links", width: 1680, height: 638 },
  { name: "trip", caption: "A day-by-day trip plan", alt: "Trip plan: three days from Houston to Chicago, nightly stops and escort nights", width: 1680, height: 575 },
  { name: "economics", caption: "Profit after the permits", alt: "Economics: load rate, fuel, tolls and driver pay with the profit on the load", width: 1680, height: 666 },
];

const FAQ = [
  {
    question: "Is the calculator free?",
    answer:
      "Yes. Sign in with Google and price 5 different loads a month for free; re-pricing the same load with other roads or escort settings does not count. With a TruckBox subscription (7 days free, then $7 a month) it is unlimited.",
  },
  {
    question: "Is this a permit?",
    answer:
      "No. It is an estimate built from each state's published rules so you can quote and plan. Order the permit from the state (or your permit service) and confirm the conditions printed on it before you move.",
  },
  {
    question: "How current are the state rules?",
    answer: `Each state shows the date its rules were last checked against the state's own manuals, statutes and fee schedules. ${VERIFIED_COUNT} of 48 states are verified${LAST_CHECKED ? ` (last check ${LAST_CHECKED})` : ""}; the rest are marked as draft.`,
  },
  {
    question: "Which trailers does it know?",
    answer:
      "Hot shot (a pickup with a 40' gooseneck), flatbed and step deck (48' and 53'), double drop, RGN 2- and 3-axle, stretch flatbed and stretch RGN. It picks the lowest deck that keeps the load legal in height, or you choose the trailer yourself.",
  },
  {
    question: "Does it work from DAT and Truckstop?",
    answer:
      "Yes. With the TruckBox extension, open-deck loads on DAT One and Truckstop get a Permits button that opens the calculator with the lane, trailer and weight filled in.",
  },
  {
    question: "Does it handle superloads?",
    answer:
      "It flags when a load crosses a state's superload, route-survey or police-escort threshold and prices what the state publishes. Superload engineering reviews and bridge analyses are set by the state case by case.",
  },
  {
    question: "Does it cover Canada?",
    answer: "No. It covers the 48 contiguous states.",
  },
];

function Shot({ name, alt, width, height, eager }: { name: string; alt: string; width: number; height: number; eager?: boolean }) {
  return (
    <div className="tbp-shot">
      <img
        className="is-light"
        src={`/permits/${name}-light.webp`}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        {...(eager ? { fetchPriority: "high" as const } : {})}
      />
      <img className="is-dark" src={`/permits/${name}-dark.webp`} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
    </div>
  );
}

function RouteReceipt() {
  return (
    <figure className="tbp-receipt" aria-label={`Example: ${EXAMPLE_LANE.origin} to ${EXAMPLE_LANE.destination}, priced by the calculator`}>
      <header className="tbp-receipt-head">
        <p className="tbp-receipt-lane">
          {EXAMPLE_LANE.origin} <ArrowRight aria-hidden className="tbp-receipt-arrow" /> {EXAMPLE_LANE.destination}
        </p>
        <p className="tbp-receipt-load">
          {EXAMPLE_LOAD.cargo} on an {EXAMPLE_LOAD.trailer} · {EXAMPLE_LOAD.width} wide · {EXAMPLE_LOAD.height} high ·{" "}
          {EXAMPLE_LOAD.gross}
        </p>
      </header>

      <ol className="tbp-receipt-states">
        {EXAMPLE_STATES.map((row, index) => (
          <li key={row.code} style={{ "--stop": index } as CSSProperties}>
            <span className="tbp-receipt-code">{row.code}</span>
            <span className="tbp-receipt-name">
              {row.name}
              <small>{row.miles} mi</small>
            </span>
            <span className="tbp-receipt-escort">{row.escorts}</span>
            <span className="tbp-receipt-permit">{row.permit}</span>
          </li>
        ))}
      </ol>

      <dl className="tbp-receipt-totals">
        <div>
          <dt>Permits</dt>
          <dd>{EXAMPLE_TOTALS.permits}</dd>
        </div>
        <div>
          <dt>
            Escorts <small>{EXAMPLE_TOTALS.escortMiles} car-miles, {EXAMPLE_TOTALS.escortNights} night</small>
          </dt>
          <dd>{EXAMPLE_TOTALS.escorts}</dd>
        </div>
        <div className="is-total">
          <dt>
            OS/OW cost <small>{EXAMPLE_TOTALS.miles} mi in {EXAMPLE_TOTALS.days} days</small>
          </dt>
          <dd>{EXAMPLE_TOTALS.total}</dd>
        </div>
      </dl>
      <figcaption>A real run of the calculator, {EXAMPLE_PRICED_ON}.</figcaption>
    </figure>
  );
}

function BoardIllustration() {
  return (
    <figure className="tbp-board" aria-label="Illustration: the TruckBox Permits button on a DAT One or Truckstop load">
      <div className="tbp-board-boards">
        <span>DAT One</span>
        <span>Truckstop</span>
      </div>
      <div className="tbp-board-load">
        <p className="tbp-board-lane">
          {EXAMPLE_LANE.origin} <ArrowRight aria-hidden className="tbp-receipt-arrow" /> {EXAMPLE_LANE.destination}
        </p>
        <p className="tbp-board-specs">
          <span>RGN</span>
          <span>76,000 lb</span>
          <span>{EXAMPLE_TOTALS.miles} mi</span>
        </p>
        <span className="tbp-board-permits">
          <Ruler aria-hidden />
          Permits
        </span>
      </div>
      <div className="tbp-board-arrow" aria-hidden>
        <ArrowRight />
      </div>
      <div className="tbp-board-result">
        <Shot name="result" alt="The calculator opened with the load filled in and priced" width={1680} height={926} />
      </div>
      <figcaption>Illustration of the extension's button.</figcaption>
    </figure>
  );
}

function StickyStart({ watch }: { watch: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = watch.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);
  return (
    <div className={"tbp-sticky" + (visible ? " is-on" : "")} aria-hidden={!visible}>
      <Link className="ed-btn ed-btn-accent" to={CALCULATOR_PATH} tabIndex={visible ? 0 : -1}>
        <span>Price your load free</span>
      </Link>
    </div>
  );
}

export default function PermitsLanding() {
  const heroRef = useRef<HTMLElement>(null);
  usePageMeta({
    title: "Free Oversize Permit & Escort Calculator for Every State on Your Route | TruckBox",
    description:
      "Free oversize permit calculator for all 48 states: permit fees, escorts, police, travel curfews and trip days for hot shot, flatbed, step deck, double drop, RGN and stretch trailers. Works from DAT and Truckstop.",
    path: LANDING_PATH,
  });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "TruckBox oversize permit calculator",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `https://truckbox.app${LANDING_PATH}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <div className="min-h-screen tbp-page">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />
      <main>
        <section className="tbp-hero" ref={heroRef}>
          <div className="ed-container tbp-hero-grid">
            <div className="tbp-hero-copy">
              <h1 className="ed-display tbp-h1">Free oversize permit calculator for all 48 states</h1>
              <p className="tbp-lede">Hot shot to stretch RGN. Permits, escorts, police and curfews, priced state by state.</p>
              <QuickStart />
              <ul className="tbp-ticks" aria-label="Free plan">
                <li>
                  <Check aria-hidden /> Google sign-in
                </li>
                <li>
                  <Check aria-hidden /> No card
                </li>
                <li>
                  <Check aria-hidden /> 5 loads a month free
                </li>
              </ul>
            </div>
            <div className="tbp-hero-proof">
              <RouteReceipt />
              <a className="tbp-see-run" href="#calculator">
                See this run in the calculator <ArrowRight aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section className="tbp-trust" aria-label="Where the rules come from">
          <div className="ed-container">
            <dl>
              <div>
                <dt>States checked against their DOT</dt>
                <dd>{VERIFIED_COUNT} of 48</dd>
              </div>
              <div>
                <dt>Official sources behind the rules</dt>
                <dd>{SOURCE_COUNT}</dd>
              </div>
              <div>
                <dt>Last checked</dt>
                <dd>{LAST_CHECKED ?? "—"}</dd>
              </div>
              <div>
                <dt>Works inside</dt>
                <dd>DAT One · Truckstop</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="tbp-trailers-section">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2">Every open-deck trailer</h2>
            <ul className="tbp-trailers">
              {LANDING_RIGS.map((rig) => (
                <li key={rig.id}>
                  <TrailerProfile rig={rig} />
                  <h3>{rig.label}</h3>
                  <dl>
                    {trailerFacts(rig).map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            <p className="tbp-legend">
              <span className="tbp-legend-room" aria-hidden /> Legal cargo: how tall it can be under 13'6"
            </p>
          </div>
        </section>

        <section id="states" className="tbp-states-section">
          <div className="ed-container tbp-states-grid">
            <div>
              <h2 className="ed-h2 tbp-h2">All 48 states, checked against each DOT</h2>
              <p className="tbp-legend">
                <span className="tbp-legend-tile" aria-hidden /> Verified ({VERIFIED_COUNT})
                <span className="tbp-legend-tile is-draft" aria-hidden /> Draft ({STATE_INDEX.length - VERIFIED_COUNT})
              </p>
            </div>
            <StateTileMap />
          </div>
          <div className="ed-container">
            <details className="tbp-state-names-wrap">
              <summary>All state rule pages</summary>
              <ul className="tbp-state-names">
                {STATE_INDEX.map((page) => (
                  <li key={page.code}>
                    <Link to={statePath(page.slug)}>{page.name}</Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>

        <section className="tbp-priced-section">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2">What it prices</h2>
            <ul className="tbp-checks">
              {PRICED.map((item) => (
                <li key={item.label}>
                  <item.icon aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="calculator" className="tbp-band">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2 tbp-band-title">The real calculator</h2>
            <Shot
              name="result"
              alt="The calculator's estimate for Houston to Chicago: total OS/OW cost, permits, escorts, the route on a map and the miles in each state"
              width={1680}
              height={926}
              eager
            />
            <ul className="tbp-gallery">
              {GALLERY.map((shot) => (
                <li key={shot.name}>
                  <Shot name={shot.name} alt={shot.alt} width={shot.width} height={shot.height} />
                  <h3>{shot.caption}</h3>
                </li>
              ))}
            </ul>
            <div className="tbp-actions tbp-actions-center">
              <Link className="ed-btn ed-btn-accent" to={CALCULATOR_PATH}>
                <span>Price your load free</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="tbp-plans-section">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2">Free. Unlimited for $7.</h2>
            <div className="tbp-plans">
              <div className="tbp-plan">
                <p className="tbp-plan-name">Free</p>
                <p className="tbp-plan-price">$0</p>
                <ul>
                  <li><Check aria-hidden /> 5 loads a month</li>
                  <li><Check aria-hidden /> All 48 states</li>
                  <li><Check aria-hidden /> Every trailer</li>
                  <li><Check aria-hidden /> PDF quotes</li>
                </ul>
                <Link className="ed-btn" to={CALCULATOR_PATH}>
                  <span>Start free</span>
                </Link>
              </div>
              <div className="tbp-plan is-main">
                <p className="tbp-plan-name">TruckBox</p>
                <p className="tbp-plan-price">
                  $7<small>/month</small>
                </p>
                <ul>
                  <li><Check aria-hidden /> Unlimited loads</li>
                  <li><Check aria-hidden /> Permits button on DAT and Truckstop</li>
                  <li><Check aria-hidden /> Broker emails, credit checks, profit</li>
                  <li><Check aria-hidden /> 7 days free</li>
                </ul>
                <a className="ed-btn ed-btn-accent" href={installLink("osow_landing", "plans")} target="_blank" rel="noreferrer">
                  <span>Add to Chrome</span>
                </a>
              </div>
            </div>
            <p className="tbp-fine tbp-plans-note">Paid OS/OW calculators: $19 to $119 a month, still capped.*</p>
            <p className="tbp-fine tbp-plans-note">*Plans published on a leading OS/OW calculator's pricing page, October 2026.</p>
          </div>
        </section>

        <section className="tbp-bridge">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2">On DAT or Truckstop? One click from the load.</h2>
            <BoardIllustration />
            <div className="tbp-actions">
              <a className="ed-btn ed-btn-accent" href={installLink("osow_landing", "bridge")} target="_blank" rel="noreferrer">
                <span>Add TruckBox to Chrome</span>
              </a>
              <Link className="ed-btn" to="/dat-load-board-tools">
                <span>Load board tools</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="tbp-faq-section">
          <div className="ed-container tbp-faq-grid">
            <h2 className="ed-h2 tbp-h2">Questions</h2>
            <div className="tbp-faq">
              {FAQ.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="tbp-close">
          <div className="ed-container">
            <h2 className="ed-display tbp-close-title">Price your next oversize load free</h2>
            <div className="tbp-actions tbp-actions-center">
              <Link className="ed-btn ed-btn-accent" to={CALCULATOR_PATH}>
                <span>Price your load free</span>
              </Link>
            </div>
            <p className="tbp-fine tbp-actions-center">Estimates from public state sources, not a permit.</p>
          </div>
        </section>
      </main>
      <Footer />
      <StickyStart watch={heroRef} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </div>
  );
}
