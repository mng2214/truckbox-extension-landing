/**
 * Post-build prerender: snapshots the public marketing routes of the built
 * SPA so crawlers get real HTML (content + per-route meta) instead of an
 * empty #root. The client still boots normally and re-renders on load.
 *
 * Runs after `vite build`. Skips gracefully (exit 0) when a browser can't
 * be launched or PRERENDER=0 is set, so a failed prerender never blocks a
 * deploy — it just falls back to the plain SPA shell.
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROUTES = ["/", "/guide", "/faq", "/privacy"];
const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};

if (process.env.PRERENDER === "0") {
  console.log("[prerender] PRERENDER=0 — skipped");
  process.exit(0);
}

// Tiny static server over dist/ with SPA fallback to index.html.
const shell = await readFile(join(DIST, "index.html"));
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  try {
    const file = await readFile(join(DIST, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(shell);
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let browser;
try {
  const puppeteer = (await import("puppeteer")).default;
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
} catch (err) {
  console.warn(`[prerender] could not launch browser — skipping (${err.message})`);
  server.close();
  process.exit(0);
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  for (const route of ROUTES) {
    const url = `http://127.0.0.1:${port}${route}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
    // Give the router + meta hook a beat to settle.
    await page.waitForSelector("h1, h2", { timeout: 10_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));

    const html = await page.evaluate(() => {
      // Snapshot hygiene: drop the devtools-guard overlay (it fires under
      // CDP), any transient scroll locks, and third-party chat widgets.
      document.querySelectorAll("[data-tb-guard]").forEach((el) => el.remove());
      document.querySelectorAll(".crisp-client, #crisp-chatbox").forEach((el) => el.remove());
      document.body.style.overflow = "";
      return "<!doctype html>" + document.documentElement.outerHTML;
    });

    const outDir = route === "/" ? DIST : join(DIST, route.slice(1));
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "index.html"), html);
    console.log(`[prerender] ${route} -> ${route === "/" ? "" : route}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log("[prerender] done");
