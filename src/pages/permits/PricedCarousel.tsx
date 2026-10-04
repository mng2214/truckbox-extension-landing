/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Clock,
  FileDown,
  FileText,
  Receipt,
  Route,
  Siren,
  Weight,
  type LucideIcon,
} from "lucide-react";

const PRICED: { icon: LucideIcon; label: string; detail: string }[] = [
  { icon: FileText, label: "Permit fees", detail: "Every state's fee for your size and weight." },
  { icon: Car, label: "Escort cars", detail: "Front and rear cars by width, length and road." },
  { icon: Siren, label: "Police escorts", detail: "Flagged wherever a state calls for police." },
  { icon: Route, label: "Route surveys", detail: "When a state wants the route checked first." },
  { icon: Weight, label: "Superloads", detail: "Where a load turns superload, state by state." },
  { icon: Clock, label: "Travel curfews", detail: "Daylight-only, curfew and holiday rules." },
  { icon: CalendarDays, label: "Trip days", detail: "Day by day, with nightly stops." },
  { icon: Receipt, label: "Tolls and profit", detail: "Tolls, fuel and driver pay, then what's left." },
  { icon: FileDown, label: "PDF quotes", detail: "A clean quote for the broker or the file." },
];

export function PricedCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () =>
      setEdges({
        atStart: track.scrollLeft <= 2,
        atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
      });
    update();
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const step = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <>
      <div className="ed-container tbp-carousel-head">
        <h2 className="ed-h2 tbp-h2">What it prices</h2>
        <div className="tbp-carousel-arrows">
          <button type="button" aria-label="Previous" onClick={() => step(-1)} disabled={edges.atStart}>
            <ArrowLeft aria-hidden />
          </button>
          <button type="button" aria-label="Next" onClick={() => step(1)} disabled={edges.atEnd}>
            <ArrowRight aria-hidden />
          </button>
        </div>
      </div>
      <ul ref={trackRef} className="tbp-carousel" tabIndex={0} aria-label="What the calculator prices">
        {PRICED.map((item, index) => (
          <li key={item.label} className="tbp-carousel-card">
            <div className="tbp-carousel-top">
              <span className="tbp-carousel-icon">
                <item.icon aria-hidden />
              </span>
              <span className="tbp-carousel-index">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <h3>{item.label}</h3>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
