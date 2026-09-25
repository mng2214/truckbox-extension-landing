/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrowserChrome from "./BrowserChrome";
import "./heroDemo.css";

export default function HeroDemo() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setVisible(true);
        }
      },
      { rootMargin: "250px" },
    );
    observer.observe(node);

    const fallback = window.setTimeout(() => {
      observer.disconnect();
      setVisible(true);
    }, 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      className="tb-hero-demo"
      ref={wrap}
      data-cursor
      onClick={() => navigate("/demo")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate("/demo");
      }}
    >
      <BrowserChrome
        compact
        url="app.loadboard.demo/search-loads"
        tabTitle="Load board — search"
        status={{ text: ready ? "● TruckBox running" : "● Loading", on: ready }}
      />

      <div className="tb-hero-demo-stage">
        {visible && (
          <iframe
            title="TruckBox running on a simulated load board"
            src="/demo?embed=hero"
            loading="lazy"
            onLoad={() => setReady(true)}
          />
        )}
      </div>

      <button
        type="button"
        className="ed-btn ed-btn-accent tb-hero-demo-cta"
        onClick={() => navigate("/demo")}
      >
        <span className="tb-hero-demo-cta-pulse" aria-hidden="true" />
        <span>TRY THE DEMO</span>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 12h13M12 5l7 7-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <span className="tb-hero-demo-note">
        Simulated board, demo data — no install, no account
      </span>
    </div>
  );
}
