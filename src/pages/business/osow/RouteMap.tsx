/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

// Route map. Lazy chunk: MapLibre (and its CSS and worker) load only when a result has a route.
// OpenFreeMap tiles need no key. The route is HERE's flexible polylines from /calculate; the trip
// plan's stops are placed on it by route mile.

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MlMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { decode } from "@here/flexpolyline";
import {
  durationLabel,
  miles,
  STOP_TONE,
  stopDescription,
  stopPlace,
  stopReasonsLabel,
  tripMomentLabel,
} from "./format";
import type { TripStop } from "./types";

// The bundled library can't find its worker next to itself once Vite has renamed the chunks.
setWorkerUrl(workerUrl);

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

type LngLat = [number, number];

function decodeAll(polylines: string[]): LngLat[][] {
  const out: LngLat[][] = [];
  for (const p of polylines) {
    try {
      const line = decode(p).polyline.map(([lat, lng]) => [lng, lat] as LngLat);
      if (line.length > 1) out.push(line);
    } catch {
      /* a corrupt section is skipped; the rest of the route still draws */
    }
  }
  return out;
}

const EARTH_RADIUS_MILES = 3958.8;

function distanceMiles([fromLng, fromLat]: LngLat, [toLng, toLat]: LngLat): number {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (toLat - fromLat) * toRadians;
  const longitudeDelta = (toLng - fromLng) * toRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLat * toRadians) * Math.cos(toLat * toRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine));
}

type MeasuredPath = { points: LngLat[]; milesFromStart: number[] };

/** The route sections as one path, with the distance from the start at every point. */
function measurePath(lines: LngLat[][]): MeasuredPath {
  const points: LngLat[] = [];
  const milesFromStart: number[] = [];
  for (const line of lines) {
    for (const point of line) {
      const previousIndex = points.length - 1;
      milesFromStart.push(
        previousIndex < 0 ? 0 : milesFromStart[previousIndex] + distanceMiles(points[previousIndex], point),
      );
      points.push(point);
    }
  }
  return { points, milesFromStart };
}

/** The point a share of the way along the path (0 = start, 1 = end). */
function pointAlong(path: MeasuredPath, share: number): LngLat {
  const totalMiles = path.milesFromStart[path.milesFromStart.length - 1];
  const targetMiles = Math.min(Math.max(share, 0), 1) * totalMiles;
  let low = 0;
  let high = path.milesFromStart.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (path.milesFromStart[middle] < targetMiles) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return path.points[0];
  const segmentStartMiles = path.milesFromStart[low - 1];
  const segmentMiles = path.milesFromStart[low] - segmentStartMiles;
  const shareOfSegment = segmentMiles > 0 ? (targetMiles - segmentStartMiles) / segmentMiles : 0;
  const [startLng, startLat] = path.points[low - 1];
  const [endLng, endLat] = path.points[low];
  return [startLng + (endLng - startLng) * shareOfSegment, startLat + (endLat - startLat) * shareOfSegment];
}

function stopPin(stop: TripStop, number: number): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `osw-stop is-${STOP_TONE[stop.reason]}`;
  element.textContent = String(number);
  element.title = `${number}. ${stopReasonsLabel(stop)} — ${stopDescription(stop)}`;
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", element.title);
  return element;
}

/** Popup body built from text nodes only. */
function stopPopup(stop: TripStop, number: number): HTMLDivElement {
  const body = document.createElement("div");
  body.className = "osw-stop-pop";
  const heading = document.createElement("b");
  heading.textContent = `${number}. ${stopReasonsLabel(stop)} · ${durationLabel(stop.hours)}`;
  const where = document.createElement("span");
  where.textContent = `Mile ${miles(stop.routeMile)} · ${stopPlace(stop)}`;
  const when = document.createElement("span");
  when.textContent = `${tripMomentLabel(stop.start)} → ${tripMomentLabel(stop.end)} (local)`;
  body.append(heading, where, when);
  return body;
}

function pin(kind: "o" | "d", title: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `osw-pin is-${kind}`;
  el.title = title;
  return el;
}

export default function RouteMap({
  polylines,
  theme,
  origin,
  destination,
  stops,
  routeMiles,
}: {
  polylines: string[];
  theme: "light" | "dark";
  origin: string;
  destination: string;
  stops?: TripStop[];
  routeMiles?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lines = decodeAll(polylines);
    if (!lines.length) return;

    const bounds = new LngLatBounds();
    for (const line of lines) for (const c of line) bounds.extend(c);
    const css = getComputedStyle(host);
    const accent = css.getPropertyValue("--accent").trim() || "#3a5bff";
    const casing = theme === "light" ? "#ffffff" : "#0d0d0f";

    let map: MlMap;
    try {
      map = new MlMap({
        container: host,
        style: STYLE[theme],
        // MapLibre defaults to 'high-performance', which on dual-GPU Macs switches the display to
        // the discrete GPU the first time a map mounts and blanks the screen for a moment.
        canvasContextAttributes: { powerPreference: "low-power" },
        bounds,
        fitBoundsOptions: { padding: 36 },
        attributionControl: { compact: true },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("osw-route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } },
      });
      map.addLayer({
        id: "osw-route-casing",
        type: "line",
        source: "osw-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": casing, "line-width": 7, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "osw-route",
        type: "line",
        source: "osw-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": accent, "line-width": 4 },
      });
    });
    const first = lines[0][0];
    const lastLine = lines[lines.length - 1];
    const last = lastLine[lastLine.length - 1];
    new Marker({ element: pin("o", origin) }).setLngLat(first).addTo(map);
    new Marker({ element: pin("d", destination) }).setLngLat(last).addTo(map);

    if (stops?.length && routeMiles && routeMiles > 0) {
      const path = measurePath(lines);
      stops.forEach((stop, stopIndex) => {
        const number = stopIndex + 1;
        new Marker({ element: stopPin(stop, number) })
          .setLngLat(pointAlong(path, stop.routeMile / routeMiles))
          .setPopup(new Popup({ offset: 14, closeButton: false, maxWidth: "260px" }).setDOMContent(stopPopup(stop, number)))
          .addTo(map);
      });
    }

    return () => map.remove();
  }, [polylines, theme, origin, destination, stops, routeMiles]);

  if (failed) {
    return (
      <div className="osw-map">
        <div className="osw-visual-empty">The map needs WebGL, which this browser has turned off.</div>
      </div>
    );
  }
  return <div ref={hostRef} className="osw-map" role="region" aria-label={`Route map, ${origin} to ${destination}`} />;
}
