import { installChromeShim } from "./chromeShim";

const EXT = "/demo/ext";

const ADAPTERS = [
  "src/content/adapters/site-adapter.js",
  "src/content/adapters/dat-adapter.js",
  "src/content/adapters/truckstop-adapter.js",
];

const LOADER = "src/content/adapters/adapter-loader.js";

const MODULES = [
  "src/content/modules/ui-injector.js",
  "src/content/modules/saved-loads.js",
  "src/content/modules/profit-calc.js",
  "src/content/modules/load-parser.js",
  "src/content/modules/template-menu.js",
  "src/content/modules/keyboard-shortcuts.js",
  "src/content/modules/maps-integration.js",
  "src/content/modules/load-capture.js",
];

function loadScript(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${EXT}/${path}`;
    script.async = false;
    script.dataset.demoExt = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${path}`));
    document.head.appendChild(script);
  });
}

function loadStyles(path: string) {
  if (document.querySelector(`link[data-demo-ext="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${EXT}/${path}`;
  link.dataset.demoExt = path;
  document.head.appendChild(link);
}

let booted: Promise<void> | null = null;

export function bootExtension(): Promise<void> {
  if (booted) return booted;

  booted = (async () => {
    installChromeShim(window);

    (window as unknown as { __tbDemoShim?: unknown }).__tbDemoShim = (frame: Window & typeof globalThis) =>
      installChromeShim(frame);

    loadStyles("src/styles/content.css");

    for (const path of ADAPTERS) await loadScript(path);

    const registered = (window as unknown as { TB_ADAPTERS?: { id: string; hostMatches: () => boolean; isLoadsPage: () => boolean }[] }).TB_ADAPTERS;
    (registered || []).forEach((adapter) => {
      const isDat = adapter.id === "dat";
      adapter.hostMatches = () => isDat;
      if (isDat) adapter.isLoadsPage = () => true;
    });

    await loadScript(LOADER);
    for (const path of MODULES) await loadScript(path);
  })();

  return booted;
}

export async function popupSrcDoc(): Promise<string> {
  const response = await fetch(`${EXT}/src/popup/popup.html`);
  const html = await response.text();
  const bootstrap =
    `<base href="${EXT}/src/popup/">` +
    `<script>window.parent.__tbDemoShim(window);</script>`;
  return html.includes("<head>")
    ? html.replace("<head>", `<head>${bootstrap}`)
    : bootstrap + html;
}
