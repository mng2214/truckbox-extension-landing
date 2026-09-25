/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Header, Footer } from "../App";
import { usePageMeta } from "../lib/meta";

/**
 * A content page for people searching for what a dispatcher needs on the DAT load board, rather
 * than for Truck Box by name. Built from the pieces the landing already uses, so it reads as part
 * of the same site.
 */

const INSTALL_URL =
  "https://chromewebstore.google.com/detail/truck-box/pbnichodfccghlpfonecdlcbjkipmmhd";

type Tool = { title: string; body: string[]; img?: string; alt?: string };

const TOOLS: Tool[] = [
  {
    title: "Emailing the broker — in one click, or without you",
    body: [
      "Every posting ends the same way: somebody has to write the broker. Done by hand it is a copy of the email address, a new tab, a template pasted in, the lane and the MC typed again — a minute a load, and the load is gone in five.",
      "Truck Box puts the send button on the row itself. One click and the broker has your template with the lane, the equipment, your name, MC and phone already in it, sent from your own Gmail or Outlook, so the reply comes straight back to you.",
      "Auto Emailer does the same thing without you at the keyboard. Set the minimum rate, the rate per mile, the deadhead and the weight you will take on a DAT search, press Start, and it writes the broker the second a matching load is posted — refreshing the board on its own so you are first in the inbox instead of thirtieth.",
    ],
    img: "/demos/email.webp",
    alt: "One-click broker email on a DAT One load with the template already filled in",
  },
  {
    title: "Checking who you are hauling for",
    body: [
      "A good rate from a broker who pays in ninety days is not a good rate. Credit checks normally live in another tab, behind another login, which is exactly why they get skipped on a busy board.",
      "Truck Box shows the broker's credit from your own factoring account — RTS Financial, Apex Capital or Triumph — right inside the load, next to the rate you are about to accept. You need an active account with one of them; we only surface what they already tell you.",
    ],
    img: "/demos/rts.webp",
    alt: "Broker credit check from RTS shown inside a DAT load",
  },
  {
    title: "Knowing what is left after fuel, tolls and driver pay",
    body: [
      "Rate per mile on the board is a headline, not a number you can act on. It ignores the deadhead you drive to get there, the diesel the trip burns, the tolls on that corridor and what the driver takes.",
      "The profit calculator sits in the rate column and does that arithmetic on the posted load: rate minus fuel, tolls and driver pay, rate per mile with the deadhead folded in, and the break-even below which the load is not worth the truck. Diesel fills in from the national average, and one click estimates the tolls for that lane for a standard five-axle tractor-trailer — type over either if you know better.",
    ],
    img: "/demos/profit.webp",
    alt: "Profit and rate-per-mile calculator with fuel, tolls and deadhead inside a DAT load",
  },
  {
    title: "Seeing the route before you commit",
    body: [
      "Two loads with the same miles are not the same trip. Truck Box draws the route on a Google map inside the load, with the deadhead to the pickup, so a lane that looks fine in two city names stops looking fine when you see where it actually goes.",
    ],
    img: "/compare/after.webp",
    alt: "Route map with deadhead drawn inside an open DAT One load",
  },
  {
    title: "Not losing a load you already liked",
    body: [
      "Postings disappear and come back at a different price. Star a load and it stays with you: you can email that broker days later, after the posting is gone, and lane price history shows what this corridor was paying while you were deciding.",
    ],
    img: "/demos/saved.webp",
    alt: "Saved loads in Truck Box with lane price history",
  },
  {
    title: "Moving through the board without the mouse",
    body: [
      "W and S walk the loads, A and D switch searches, Space opens the detail, Q opens the route, E emails the broker. On a board you work eight hours a day, the mouse is the slow part.",
    ],
    img: "/demos/keyboard.webp",
    alt: "Keyboard shortcuts for moving through loads on the DAT board",
  },
  {
    title: "The same set on Truckstop",
    body: [
      "One-click email, credit checks, route maps, the calculator, saved loads and the shortcuts work on Truckstop too, with the same templates and settings. Auto Emailer is the one exception — it runs on DAT One only, because it depends on how that board feeds new postings into the page.",
    ],
  },
];

export default function DatToolsPage() {
  usePageMeta({
    title: "Load board tools for DAT One dispatchers — Truck Box",
    description:
      "What a dispatcher needs on the DAT One load board: one-click broker emails, automatic emailing when a load is posted, broker credit checks, a profit and rate-per-mile calculator with tolls and deadhead, route maps and saved loads. Works on Truckstop too.",
    path: "/dat-load-board-tools",
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen">
      <div className="tb-bg-blobs" aria-hidden />
      <div className="tb-bg-vignette" aria-hidden />
      <Header />

      <main style={{ paddingTop: 64 }}>
        <section className="ed-section">
          <div className="ed-container">
            <div className="max-w-3xl">
              <span className="ed-label">[ Load board tools ]</span>
              <h1 className="ed-h2 mt-4">The tools a dispatcher needs on the DAT load board</h1>
              <p className="mt-6 text-lg" style={{ color: "var(--muted)" }}>
                A day on DAT One is the same five moves over and over: read the load, check who
                posted it, work out whether it pays, write the broker, do it again. Every one of
                those moves normally costs a tab, a login or a copy-paste. Truck Box is a Chrome
                extension that puts all of them inside the board itself — here is what each one
                looks like, and what it changes.
              </p>
            </div>

            <div className="mt-16 grid gap-16">
              {TOOLS.map((tool) => (
                <article key={tool.title} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
                  <div className="max-w-xl tb-prose">
                    <h2>{tool.title}</h2>
                    {tool.body.map((line) => (
                      <p key={line.slice(0, 40)} style={{ marginTop: 12 }}>
                        {line}
                      </p>
                    ))}
                  </div>

                  {tool.img && (
                    <img
                      src={tool.img}
                      alt={tool.alt}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: "100%",
                        height: "auto",
                        border: "1px solid var(--line)",
                        display: "block",
                      }}
                    />
                  )}
                </article>
              ))}
            </div>

            <div
              className="mt-20 pt-10"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <div className="tb-prose max-w-xl">
                <h2>Try it on a live board, without installing anything</h2>
              </div>
              <p className="mt-4 max-w-xl" style={{ color: "var(--muted)" }}>
                The demo runs the extension on a simulated load board in your browser — no account,
                no card, nothing to install. If it fits the way you dispatch, the extension is $7 per
                user per month with a 7-day free trial, and every feature on this page is included.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="ed-btn" to="/demo">
                  <span>Open the demo</span>
                </Link>
                <a className="ed-btn" href={INSTALL_URL} target="_blank" rel="noreferrer">
                  <span>Add to Chrome</span>
                </a>
                <Link className="ed-btn" to="/guide">
                  <span>Setup guide</span>
                </Link>
                <Link className="ed-btn" to="/faq">
                  <span>FAQ</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
