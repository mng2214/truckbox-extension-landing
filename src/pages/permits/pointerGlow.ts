/*! Truck Box — Website and Interactive Demo
 *  Copyright (c) 2025-2026 TruckBox LLC (Illinois, USA). All rights reserved.
 *  Proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef } from "react";

const MAX_TILT_DEGREES = 4;

export function usePointerGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onEnter = () => element.classList.add("is-pointing");
    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      const horizontal = (event.clientX - box.left) / box.width;
      const vertical = (event.clientY - box.top) / box.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--pointer-x", `${(horizontal * 100).toFixed(1)}%`);
        element.style.setProperty("--pointer-y", `${(vertical * 100).toFixed(1)}%`);
        element.style.setProperty("--tilt-x", `${((0.5 - vertical) * MAX_TILT_DEGREES).toFixed(2)}deg`);
        element.style.setProperty("--tilt-y", `${((horizontal - 0.5) * MAX_TILT_DEGREES).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      element.classList.remove("is-pointing");
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
    };

    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}

export function useMagnetic<T extends HTMLElement>(strength = 0.16) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onEnter = () => {
      element.style.transition = "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)";
    };
    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      const offsetX = (event.clientX - (box.left + box.width / 2)) * strength;
      const offsetY = (event.clientY - (box.top + box.height / 2)) * strength;
      element.style.transform = `translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px)`;
    };
    const onLeave = () => {
      element.style.transition = "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)";
      element.style.transform = "translate(0, 0)";
    };

    element.addEventListener("pointerenter", onEnter);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointerenter", onEnter);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return ref;
}
