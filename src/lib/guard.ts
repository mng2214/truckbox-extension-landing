/**
 * Lightweight "look, don't touch" guard for the landing page.
 *
 * This is a *cosmetic deterrent only* — it discourages casual right-click /
 * copy / DevTools poking. It is NOT security: client code always ships to the
 * browser and any motivated user bypasses this in seconds (browser menu,
 * view-source:, disabling JS, curl, etc.). Kept intentionally non-aggressive —
 * no infinite `debugger`, no DevTools-open detection — so it never lags the
 * page or fights legitimate users.
 *
 * Form fields (inputs / textareas / anything contentEditable) are always
 * exempt so the contact form keeps working — typing, selecting, and pasting.
 */

/** True when the event target is (or sits inside) an editable field. */
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

export function installPageGuard(): void {
  if (typeof window === "undefined") return;

  // Block the right-click context menu (except in form fields).
  window.addEventListener(
    "contextmenu",
    (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    },
    { capture: true }
  );

  // Block text copy / cut (except from form fields).
  const blockClipboard = (e: ClipboardEvent) => {
    if (!isEditable(e.target)) e.preventDefault();
  };
  window.addEventListener("copy", blockClipboard, { capture: true });
  window.addEventListener("cut", blockClipboard, { capture: true });

  // Block text selection via drag (except in form fields).
  window.addEventListener(
    "selectstart",
    (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    },
    { capture: true }
  );

  // Block image dragging.
  window.addEventListener(
    "dragstart",
    (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    },
    { capture: true }
  );

  // Block common DevTools / view-source keyboard shortcuts.
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
