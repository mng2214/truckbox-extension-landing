/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Gift,
  LogIn,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Header, Footer } from "../../App";
import { usePageMeta } from "../../lib/meta";
import { installLink } from "../business/installLink";
import { CALCULATOR_PATH, LANDING_PATH, LAST_CHECKED, STATE_INDEX, VERIFIED_COUNT, flagPath, statePath } from "./permitsData";
import { EXAMPLE_LANE, EXAMPLE_LOAD, EXAMPLE_PRICED_ON, EXAMPLE_STATES, EXAMPLE_TOTALS } from "./example";
import { LEGAL, RIGS, type Rig } from "../business/osow/equipment";
import { StateTileMap } from "./StateTileMap";
import { TrailerProfile } from "./TrailerProfile";
import { PricedCarousel } from "./PricedCarousel";
import { CalculatorShowcase } from "./CalculatorShowcase";
import { FaqAccordion } from "./FaqAccordion";
import { useMagnetic, usePointerGlow } from "./pointerGlow";
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

function RouteReceipt() {
  return (
    <div className="tbp-receipt-paper">
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
    </div>
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

function openChat() {
  const crisp = (window as unknown as { $crisp?: { push: (command: unknown[]) => void; is?: unknown } }).$crisp;
  if (crisp && typeof crisp.is === "function") crisp.push(["do", "chat:open"]);
  else window.location.assign("/#contact");
}

export default function PermitsLanding() {
  const heroRef = useRef<HTMLElement>(null);
  const freePlanRef = usePointerGlow<HTMLDivElement>();
  const truckBoxPlanRef = usePointerGlow<HTMLDivElement>();
  const heroCtaRef = useMagnetic<HTMLAnchorElement>();
  const closeCtaRef = useMagnetic<HTMLAnchorElement>();
  const trailerCards = LANDING_RIGS.map((rig) => (
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
  ));
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
              <h1 className="ed-display tbp-h1">
                <span className="ed-accent">Free</span> oversize permit calculator for all 48 states
              </h1>
              <p className="tbp-lede">Hot shot to stretch RGN. Permits, escorts, police and curfews, priced state by state.</p>
              <Link ref={heroCtaRef} className="ed-btn ed-btn-accent tbp-hero-cta tbp-arrow-cta" to={CALCULATOR_PATH}>
                <span>Price your load free</span>
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <ul className="tbp-perks" aria-label="Free plan">
                <li>
                  <LogIn aria-hidden /> Google sign-in
                </li>
                <li>
                  <ShieldCheck aria-hidden /> No card
                </li>
                <li>
                  <Gift aria-hidden /> 5 loads a month free
                </li>
              </ul>
              <div className="tbp-included">
                <p className="tbp-included-title">
                  <BadgeCheck aria-hidden /> Free and unlimited with TruckBox
                </p>
                <p className="tbp-included-text">TruckBox users price every load free. No extra subscription.</p>
                <Link className="tbp-see-run" to="/#features">
                  All TruckBox features for $7/month <ArrowRight aria-hidden />
                </Link>
              </div>
            </div>
            <div className="tbp-hero-proof">
              <RouteReceipt />
              <a className="tbp-see-run" href="#calculator">
                See this run in the calculator <ArrowRight aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section className="tbp-trailers-section">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2">For every open-deck trailer</h2>
          </div>
          <div className="tbp-marquee">
            <div className="tbp-marquee-track">
              <ul className="tbp-trailers">{trailerCards}</ul>
              <ul className="tbp-trailers" aria-hidden>
                {trailerCards}
              </ul>
            </div>
          </div>
        </section>

        <section id="states" className="tbp-states-section">
          <div className="ed-container tbp-states-grid">
            <div>
              <h2 className="ed-h2 tbp-h2">All 48 states, checked against each DOT</h2>
              <details className="tbp-state-names-wrap">
                <summary>All state rule pages</summary>
                <ul className="tbp-state-names">
                  {STATE_INDEX.map((page) => (
                    <li key={page.code}>
                      <Link to={statePath(page.slug)}>
                        <img src={flagPath(page.slug)} alt="" loading="lazy" height={14} />
                        {page.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            <StateTileMap />
          </div>
        </section>

        <section className="tbp-priced-section">
          <PricedCarousel />
        </section>

        <section id="calculator" className="tbp-band">
          <div className="ed-container">
            <h2 className="ed-h2 tbp-h2 tbp-band-title">The real calculator</h2>
            <CalculatorShowcase />
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
              <div ref={freePlanRef} className="tbp-plan">
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
              <div ref={truckBoxPlanRef} className="tbp-plan is-main">
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

        <section className="tbp-faq-section">
          <div className="ed-container tbp-faq-grid">
            <div className="tbp-faq-intro">
              <h2 className="ed-h2 tbp-h2">Questions</h2>
              <p>Something else? Ask us in the chat.</p>
              <button type="button" className="ed-btn tbp-faq-chat" onClick={openChat}>
                <MessageCircle aria-hidden className="h-4 w-4" />
                <span>Ask in chat</span>
              </button>
            </div>
            <FaqAccordion items={FAQ} />
          </div>
        </section>

        <section className="tbp-close">
          <div className="ed-container">
            <h2 className="ed-display tbp-close-title">Price your next oversize load free</h2>
            <div className="tbp-actions tbp-actions-center">
              <Link ref={closeCtaRef} className="ed-btn ed-btn-accent tbp-arrow-cta" to={CALCULATOR_PATH}>
                <span>Price your load free</span>
                <ArrowRight aria-hidden className="h-4 w-4" />
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
