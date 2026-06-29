
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

export function installPageGuard(): void {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "contextmenu",
    (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    },
    { capture: true }
  );

  const blockClipboard = (e: ClipboardEvent) => {
    if (!isEditable(e.target)) e.preventDefault();
  };
  window.addEventListener("copy", blockClipboard, { capture: true });
  window.addEventListener("cut", blockClipboard, { capture: true });
  window.addEventListener(
    "selectstart",
    (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    },
    { capture: true }
  );

  window.addEventListener(
    "dragstart",
    (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    },
    { capture: true }
  );

  window.addEventListener(
    "keydown",
    (e) => {
      const k = e.key.toLowerCase();
      const blocked =
        e.key === "F12" || // DevTools
        (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")) || // Inspect / Console
        ((e.ctrlKey || e.metaKey) && k === "u") || // View source
        ((e.ctrlKey || e.metaKey) && e.altKey && (k === "i" || k === "j")) || // mac DevTools
        ((e.ctrlKey || e.metaKey) && k === "s"); // Save page
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );
}

export function installDevtoolsDetector(): void {
  if (typeof window === "undefined") return;

  const WIDTH_GAP = 160;

  let overlay: HTMLDivElement | null = null;

  const show = () => {
    if (overlay) return;
    const el = document.createElement("div");
    el.setAttribute("data-tb-guard", "");
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "text-align:center",
      "padding:24px",
      "background:rgba(10,10,12,0.96)",
      "backdrop-filter:blur(10px)",
      "-webkit-backdrop-filter:blur(10px)",
      "color:#f5f5f7",
      "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    ].join(";");
    el.innerHTML =
      '<div style="max-width:420px">' +
      '<div style="font-size:1.15rem;font-weight:700;letter-spacing:-0.01em;margin-bottom:10px">Developer tools detected</div>' +
      '<div style="opacity:.7;font-size:.92rem;line-height:1.55">Please close your browser’s developer tools to continue using TruckBox.</div>' +
      "</div>";
    document.documentElement.appendChild(el);
    document.body.style.overflow = "hidden";
    overlay = el;
  };

  const hide = () => {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = "";
  };

  let consoleSawIt = false;
  const probe = document.createElement("div");
  Object.defineProperty(probe, "id", {
    get() {
      consoleSawIt = true;
      return "";
    },
  });

  const check = () => {
    const widthOpen = window.outerWidth - window.innerWidth > WIDTH_GAP;

    consoleSawIt = false;
    console.log(probe);
    console.clear();
    const consoleOpen = consoleSawIt;

    if (widthOpen || consoleOpen) show();
    else hide();
  };

  window.addEventListener("resize", check, { passive: true });
  window.setInterval(check, 1000);
  check();
}
