/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Maximize2, X } from "lucide-react";

type Screen = { name: string; title: string; detail: string; alt: string; width: number; height: number };

const SCREENS: Screen[] = [
  {
    name: "load",
    title: "Cargo and a 3D check",
    detail: "See what is over legal before you quote.",
    alt: "The calculator's load form with a 28 foot excavator on an RGN and its 3D model, width and height marked over legal",
    width: 1680,
    height: 1076,
  },
  {
    name: "result",
    title: "The estimate",
    detail: "Total, permits and escorts, with the route.",
    alt: "The calculator's estimate for Houston to Chicago: total OS/OW cost, permits, escorts, the route on a map and the miles in each state",
    width: 1680,
    height: 926,
  },
  {
    name: "states",
    title: "Every state, with its order link",
    detail: "Fees, escorts and where to order.",
    alt: "Per-state table: Texas, Arkansas, Missouri and Illinois with miles, road class, permit fee, escorts and order links",
    width: 1680,
    height: 638,
  },
  {
    name: "trip",
    title: "A day-by-day trip plan",
    detail: "Travel windows, nightly stops, escort nights.",
    alt: "Trip plan: three days from Houston to Chicago, nightly stops and escort nights",
    width: 1680,
    height: 575,
  },
  {
    name: "economics",
    title: "Profit after the permits",
    detail: "Rate minus fuel, tolls, driver and permits.",
    alt: "Economics: load rate, fuel, tolls and driver pay with the profit on the load",
    width: 1680,
    height: 666,
  },
];

function ScreenImages({ screen, eager }: { screen: Screen; eager?: boolean }) {
  return (
    <>
      <img
        className="is-light"
        src={`/permits/${screen.name}-light.webp`}
        alt={screen.alt}
        width={screen.width}
        height={screen.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      <img
        className="is-dark"
        src={`/permits/${screen.name}-dark.webp`}
        alt={screen.alt}
        width={screen.width}
        height={screen.height}
        loading="lazy"
        decoding="async"
      />
    </>
  );
}

function Lightbox({ startIndex, onClose }: { startIndex: number; onClose: (lastIndex: number) => void }) {
  const [index, setIndex] = useState(startIndex);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const screen = SCREENS[index];
  const step = useCallback((direction: 1 | -1) => setIndex((current) => (current + direction + SCREENS.length) % SCREENS.length), []);
  const close = useCallback(() => onClose(index), [onClose, index]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, step]);

  return createPortal(
    <div className="tbp-lightbox" role="dialog" aria-modal="true" aria-label={screen.title} data-lenis-prevent onClick={close}>
      <button ref={closeButtonRef} type="button" className="tbp-lightbox-close" aria-label="Close" onClick={close}>
        <X aria-hidden />
      </button>
      <button
        type="button"
        className="tbp-lightbox-nav"
        aria-label="Previous screen"
        onClick={(event) => {
          event.stopPropagation();
          step(-1);
        }}
      >
        <ArrowLeft aria-hidden />
      </button>
      <figure className="tbp-lightbox-figure" onClick={(event) => event.stopPropagation()}>
        <div key={screen.name} className={`tbp-lightbox-image tbp-screen-${screen.name}`}>
          <ScreenImages screen={screen} eager />
        </div>
        <figcaption>
          <b>{screen.title}</b> {screen.detail}
          <span>
            {index + 1} / {SCREENS.length}
          </span>
        </figcaption>
      </figure>
      <button
        type="button"
        className="tbp-lightbox-nav"
        aria-label="Next screen"
        onClick={(event) => {
          event.stopPropagation();
          step(1);
        }}
      >
        <ArrowRight aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

export function CalculatorShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const screenButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const closeLightbox = useCallback((lastIndex: number) => {
    setZoomedIndex(null);
    setActiveIndex(lastIndex);
    screenButtonRef.current?.focus();
  }, []);

  const running = inView && zoomedIndex === null;
  const active = SCREENS[activeIndex];

  return (
    <div ref={rootRef} className={"tbp-showcase" + (running ? " is-running" : "")}>
      <ol className="tbp-showcase-tabs" role="tablist" aria-label="Calculator screens">
        {SCREENS.map((screen, index) => (
          <li key={screen.name} role="presentation">
            <button
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls="tbp-showcase-screen"
              className={index === activeIndex ? "is-active" : undefined}
              onClick={() => setActiveIndex(index)}
            >
              <span className="tbp-showcase-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="tbp-showcase-text">
                <b>{screen.title}</b>
                <small>{screen.detail}</small>
              </span>
              {index === activeIndex && (
                <span
                  key={activeIndex}
                  className="tbp-showcase-progress"
                  aria-hidden
                  onAnimationEnd={() => setActiveIndex((current) => (current + 1) % SCREENS.length)}
                />
              )}
            </button>
          </li>
        ))}
      </ol>
      <figure className="tbp-showcase-window">
        <div className="tbp-showcase-chrome" aria-hidden>
          <span className="tbp-showcase-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="tbp-showcase-url">truckbox.app/business/osow</span>
          <Maximize2 className="tbp-showcase-zoom-hint" />
        </div>
        <button
          ref={screenButtonRef}
          type="button"
          id="tbp-showcase-screen"
          className="tbp-showcase-screen"
          aria-label={`Enlarge: ${active.title}`}
          onClick={() => setZoomedIndex(activeIndex)}
        >
          {SCREENS.map((screen, index) => (
            <span
              key={screen.name}
              className={`tbp-showcase-slide tbp-screen-${screen.name}` + (index === activeIndex ? " is-active" : "")}
              aria-hidden={index !== activeIndex}
            >
              <ScreenImages screen={screen} eager={index === 0} />
            </span>
          ))}
        </button>
      </figure>
      {zoomedIndex !== null && <Lightbox startIndex={zoomedIndex} onClose={closeLightbox} />}
    </div>
  );
}
