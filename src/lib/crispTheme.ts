/**
 * Crisp launcher re-theme: light-gray bubble + dark icon, while the violet
 * neon pulse stays in styles.css. Crisp periodically rewrites its own DOM
 * and styles (a plain stylesheet loses that war), so we enforce the two
 * paint properties inline with !important and re-apply via MutationObserver
 * whenever Crisp churns. Value-guarded to avoid observer feedback loops.
 */
const BUBBLE_BG = "#d9dbe3";
const ICON_INK = "%232a2d3a"; // url-encoded #2a2d3a — dark graphite glyph

function setImportant(el: HTMLElement, prop: string, value: string) {
  if (el.style.getPropertyValue(prop) !== value) {
    el.style.setProperty(prop, value, "important");
  }
}

/** Recolor Crisp's white glyph inside its data-uri SVG — no CSS filters
    (filters interact badly with the launcher's composited layers). */
function recolorIcon(icon: HTMLElement) {
  if (icon.dataset.tbRecolored === "1") return;
  const bgi = getComputedStyle(icon).backgroundImage;
  if (!bgi.includes("data:image/svg+xml")) return;
  const recolored = bgi
    .replace(/%23fff(?:fff)?/gi, ICON_INK)
    .replace(/fill=(["'])#fff(?:fff)?\1/gi, `fill=$1#2a2d3a$1`)
    .replace(/fill:%20?#fff(?:fff)?/gi, "fill:#2a2d3a")
    .replace(/white/g, "%232a2d3a");
  if (recolored !== bgi) {
    icon.style.setProperty("background-image", recolored, "important");
    icon.dataset.tbRecolored = "1";
  }
}

function apply() {
  const btn = document.querySelector<HTMLElement>(
    '.crisp-client [role="button"][data-maximized="false"]'
  );
  if (!btn) return;
  const wrap = btn.querySelector<HTMLElement>(":scope > span:last-child");
  const bubble = (wrap?.firstElementChild as HTMLElement | null) ?? null;
  if (!bubble) return;
  setImportant(bubble, "background-color", BUBBLE_BG);
  const icon = bubble.firstElementChild as HTMLElement | null;
  if (icon) {
    recolorIcon(icon);
    // Crisp's glyph fills ~65% of the bubble; scale it down a touch so the
    // light-gray bubble reads as the dominant surface.
    setImportant(icon, "transform", "scale(0.78)");
  }
}

export function installCrispTheme(): void {
  if (typeof window === "undefined") return;
  const observer = new MutationObserver(apply);
  const boot = window.setInterval(() => {
    const root = document.querySelector(".crisp-client");
    if (!root) return;
    window.clearInterval(boot);
    apply();
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-maximized"],
    });
  }, 400);
}
