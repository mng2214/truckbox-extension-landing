import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./tour.css";

export type TourStep = {
  id: string;
  title: string;
  text: string;
  hint?: string;
  prepare?: () => void;
  target: () => Element | null;
  done?: (el: Element | null) => boolean;
  success?: string;
  hold?: number;
  click?: boolean;
  manual?: boolean;
};

type Props = {
  steps: TourStep[];
  paused?: boolean;
  stage?: () => Element | null;
  onClose: () => void;
};

type Box = { top: number; left: number; width: number; height: number };

const PAD = 7;
const DWELL = 350;
const HOLD = 700;
const GUTTER_MIN = 264;
const GUTTER_MAX = 348;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

function viewportRect(el: Element): Box {
  const r = el.getBoundingClientRect();
  let top = r.top;
  let left = r.left;
  let win: Window | null = el.ownerDocument.defaultView;
  while (win && win !== window) {
    const frame: Element | null = win.frameElement;
    if (!frame) break;
    const fr = frame.getBoundingClientRect();
    top += fr.top;
    left += fr.left;
    win = win.parent;
  }
  return { top, left, width: r.width, height: r.height };
}

function reveal(el: Element) {
  el.scrollIntoView({ block: "center", inline: "nearest" });

  const box = viewportRect(el);
  const h = window.innerHeight;
  if (box.top < 8 || box.top + box.height > h - 8) {
    window.scrollTo({ top: Math.max(0, window.scrollY + box.top - (h / 2 - box.height / 2)) });
  }
}

function onScreen(el: Element) {
  const box = viewportRect(el);
  return box.top >= 0 && box.top + box.height <= window.innerHeight;
}

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export default function Tour({ steps, paused = false, stage, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState(false);
  const [settled, setSettled] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const masks = useRef<(HTMLDivElement | null)[]>([]);

  const held = useRef<Element | null>(null);
  const lastBox = useRef<Box | null>(null);
  const doneAt = useRef(0);
  const bound = useRef<{ el: Element; fn: EventListener } | null>(null);
  const clicked = useRef(false);
  const scrolled = useRef(false);
  const startedAt = useRef(0);
  const indexRef = useRef(0);

  const step: TourStep | undefined = steps[index];
  const last = index >= steps.length;

  useEffect(() => {
    indexRef.current = index;
    held.current = null;
    lastBox.current = null;
    doneAt.current = 0;
    scrolled.current = false;
    clicked.current = false;
    setSettled(false);
    if (bound.current) {
      bound.current.el.removeEventListener("click", bound.current.fn, true);
      bound.current = null;
    }
    startedAt.current = performance.now();
    step?.prepare?.();
  }, [index, step]);

  const shake = () => {
    const node = card.current;
    if (!node) return;
    node.classList.remove("is-nudged");
    void node.offsetWidth;
    node.classList.add("is-nudged");
    window.setTimeout(() => node.classList.remove("is-nudged"), 460);
  };

  useEffect(() => {
    if (last) onClose();
  }, [last, onClose]);

  useEffect(() => {
    if (!paused && doneAt.current) doneAt.current = performance.now();
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useLayoutEffect(() => {
    if (paused || last) return;

    const place = (box: Box | null) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hole: Box = box
        ? {
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }
        : { top: -20, left: -20, width: 0, height: 0 };

      const [top, right, bottom, left] = masks.current;
      if (top) {
        top.style.top = "0px";
        top.style.left = "0px";
        top.style.width = w + "px";
        top.style.height = Math.max(0, hole.top) + "px";
      }
      if (bottom) {
        bottom.style.top = Math.max(0, hole.top + hole.height) + "px";
        bottom.style.left = "0px";
        bottom.style.width = w + "px";
        bottom.style.height = Math.max(0, h - hole.top - hole.height) + "px";
      }
      if (left) {
        left.style.top = Math.max(0, hole.top) + "px";
        left.style.left = "0px";
        left.style.width = Math.max(0, hole.left) + "px";
        left.style.height = Math.max(0, hole.height) + "px";
      }
      if (right) {
        right.style.top = Math.max(0, hole.top) + "px";
        right.style.left = Math.max(0, hole.left + hole.width) + "px";
        right.style.width = Math.max(0, w - hole.left - hole.width) + "px";
        right.style.height = Math.max(0, hole.height) + "px";
      }

      const r = ring.current;
      if (r) {
        r.style.opacity = box ? "1" : "0";
        r.style.top = hole.top + "px";
        r.style.left = hole.left + "px";
        r.style.width = hole.width + "px";
        r.style.height = hole.height + "px";
      }

      const c = card.current;
      if (!c) return;

      if (!box) {
        c.style.width = "";
        c.classList.remove("is-aside");
        c.style.top = Math.round(h / 2 - c.offsetHeight / 2) + "px";
        c.style.left = Math.round(w / 2 - c.offsetWidth / 2) + "px";
        return;
      }

      const frame = stage?.()?.getBoundingClientRect();
      const gutters = {
        left: frame ? frame.left : 0,
        right: frame ? w - frame.right : 0,
      };
      const near = hole.left + hole.width / 2 > w / 2 ? "right" : "left";
      const far = near === "right" ? "left" : "right";
      const aside =
        gutters[near] >= GUTTER_MIN ? near : gutters[far] >= GUTTER_MIN ? far : null;

      c.classList.toggle("is-aside", !!aside);

      if (aside && frame) {
        const gw = Math.min(GUTTER_MAX, gutters[aside] - 24);
        c.style.width = gw + "px";
        const ch2 = c.offsetHeight;
        const left3 =
          aside === "left"
            ? (frame.left - gw) / 2
            : frame.right + (gutters.right - gw) / 2;
        c.style.top = Math.round(clamp(hole.top + hole.height / 2 - ch2 / 2, 12, h - ch2 - 12)) + "px";
        c.style.left = Math.round(clamp(left3, 12, w - gw - 12)) + "px";
        return;
      }

      c.style.width = "";
      const cw = c.offsetWidth;
      const ch = c.offsetHeight;
      const below = hole.top + hole.height + 14;
      const above = hole.top - ch - 14;

      if (below + ch > h - 12 && above < 12) {
        const room = { left: hole.left, right: w - hole.left - hole.width };
        const beside = room.right >= cw + 24 ? "right" : room.left >= cw + 24 ? "left" : null;
        if (beside) {
          const left4 = beside === "right" ? hole.left + hole.width + 14 : hole.left - cw - 14;
          c.style.top = Math.round(clamp(hole.top + hole.height / 2 - ch / 2, 12, h - ch - 12)) + "px";
          c.style.left = Math.round(clamp(left4, 12, w - cw - 12)) + "px";
          return;
        }
      }

      const top2 = clamp(below + ch < h - 12 ? below : above, 12, h - ch - 12);
      const left2 = clamp(hole.left + hole.width / 2 - cw / 2, 12, w - cw - 12);
      c.style.top = Math.round(top2) + "px";
      c.style.left = Math.round(left2) + "px";
    };

    const tick = () => {
      const current = steps[indexRef.current];
      if (!current) return;

      if (doneAt.current) {
        ring.current?.classList.add("is-done");
        place(lastBox.current);
        if (performance.now() - doneAt.current > (current.hold ?? HOLD)) {
          setIndex((n) => (n === indexRef.current ? n + 1 : n));
        }
        return;
      }
      ring.current?.classList.remove("is-done");

      if (!held.current || !held.current.isConnected || !visible(held.current)) {
        const found = current.target();
        held.current = found && visible(found) ? found : null;
      }
      const el = held.current;

      if (current.click && el && bound.current?.el !== el) {
        if (bound.current) bound.current.el.removeEventListener("click", bound.current.fn, true);
        const fn = () => {
          clicked.current = true;
        };
        el.addEventListener("click", fn, true);
        bound.current = { el, fn };
      }

      const young = performance.now() - startedAt.current < 1500;
      if (el && (!scrolled.current || (young && !onScreen(el)))) {
        scrolled.current = true;
        reveal(el);
      }

      lastBox.current = el ? viewportRect(el) : null;
      place(lastBox.current);
      setMissing(!el);

      const ready = performance.now() - startedAt.current > DWELL;

      if (ready && !current.manual && (clicked.current || current.done?.(el))) {
        if ((current.hold ?? HOLD) <= 0) {
          setIndex((n) => (n === indexRef.current ? n + 1 : n));
          return;
        }
        doneAt.current = performance.now();
        setSettled(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 60);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
      if (bound.current) {
        bound.current.el.removeEventListener("click", bound.current.fn, true);
        bound.current = null;
      }
    };
  }, [paused, last, steps, stage]);

  if (paused || last) return null;

  if (!step) return null;

  return (
    <div className="tour" ref={root}>
      {[0, 1, 2, 3].map((n) => (
        <div
          key={n}
          className="tour-mask"
          ref={(node) => {
            masks.current[n] = node;
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            shake();
          }}
        />
      ))}

      <div className="tour-ring" ref={ring} />

      <div className="tour-card" ref={card}>
        <span className="tour-step">
          Step {index + 1} of {steps.length}
        </span>
        <b className="tour-title">{step.title}</b>
        <p className="tour-text">{step.text}</p>
        {missing && step.hint && <p className="tour-hint">{step.hint}</p>}

        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onClose}>
            Skip the tour
          </button>
          {settled ? (
            <span className="tour-done">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5l5 5 9-11"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {step.success || "Done"}
            </span>
          ) : step.manual ? (
            <button type="button" className="tour-next" onClick={() => setIndex(index + 1)}>
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h13M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <span className="tour-wait">Your turn</span>
          )}
        </div>
      </div>
    </div>
  );
}
