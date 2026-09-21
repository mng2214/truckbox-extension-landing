import { transformSync } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const landing = path.resolve(here, "..");
const source = path.resolve(landing, "..", "datemailer");
const target = path.join(landing, "public", "demo", "ext");

const TREES = ["src/content/adapters", "src/content/modules", "src/popup", "src/styles", "icons"];
const FILES = [];

const SKIP = new Set(["icons/datandtruckstoplogo.png", "icons/icon128.png"]);

const checkOnly = process.argv.includes("--check");

if (!fs.existsSync(source)) {
  console.error(`Extension checkout not found at ${source}.`);
  console.error("Clone it next to this repository, or skip: the committed copy still works.");
  process.exit(1);
}

const NOTICE = [
  "Truck Box \u2014 Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.",
  "Proprietary and confidential. Not open source, not public domain.",
  "No license is granted: this file may not be copied, reused, modified, redistributed,",
  "or used as input or training data for any AI or code-generation system.",
  "Licensing: info@truckbox.app",
];

const banner = (rel) => {
  if (rel.endsWith(".js")) return `/*!\n * ${NOTICE.join("\n * ")}\n */\n`;
  if (rel.endsWith(".css")) return `/*!\n * ${NOTICE.join("\n * ")}\n */\n`;
  return "";
};

const PROD_API = "https://platform.truckbox.app/api/v1";
const API_LINE = /^(\s*)(?:\/\/\s*)?const API_BASE_URL = '[^']*';(.*)$/;

const productionApiBase = (source) => {
  if (!source.includes("API_BASE_URL = ")) return source;
  return source
    .split("\n")
    .map((line) => {
      const match = API_LINE.exec(line);
      if (!match) return line;
      if (line.includes(PROD_API)) return `${match[1]}const API_BASE_URL = '${PROD_API}';${match[2]}`;
      return `${match[1]}// ${line.trim().replace(/^\/\/\s*/, "")}`;
    })
    .join("\n");
};

// The demo serves this copy from truckbox.app, so anything readable here is readable by anyone who
// opens the network tab — the whole extension, comments and all. Minifying does not make it secret,
// but it removes what is actually worth stealing: the comments explaining why each part works the
// way it does. Set SYNC_EXT_MINIFY=0 when a demo bug needs readable frames in a stack trace.
const minify = process.env.SYNC_EXT_MINIFY !== "0";

const squeeze = (rel, code) => {
  if (!minify) return code;
  try {
    if (rel.endsWith(".js")) {
      return transformSync(code, { minify: true, legalComments: "none", target: "es2020" }).code;
    }
    if (rel.endsWith(".css")) {
      return transformSync(code, { loader: "css", minify: true, legalComments: "none" }).code;
    }
    if (rel.endsWith(".html")) {
      return code.replace(/<!--(?!!)[\s\S]*?-->/g, "");
    }
  } catch (error) {
    console.warn(`  ! ${rel}: left as-is (${error.message.split("\n")[0]})`);
  }
  return code;
};

const render = (rel, file) => {
  const raw = fs.readFileSync(file);
  const text = rel.endsWith(".js") ? productionApiBase(raw.toString()) : raw.toString();
  const body = /\.(js|css|html)$/.test(rel) ? Buffer.from(squeeze(rel, text)) : raw;
  return Buffer.concat([Buffer.from(banner(rel)), body]);
};

const digest = (buf) => createHash("sha1").update(buf).digest("hex");

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [path.relative(base, full)];
  });
}

const wanted = [
  ...TREES.flatMap((tree) => walk(path.join(source, tree)).map((rel) => path.join(tree, rel))),
  ...FILES,
].filter((rel) => !SKIP.has(rel));

const changed = [];
const removed = [];

for (const rel of wanted) {
  const from = path.join(source, rel);
  const to = path.join(target, rel);
  const content = render(rel, from);
  const same = fs.existsSync(to) && digest(content) === digest(fs.readFileSync(to));
  if (same) continue;
  changed.push(rel);
  if (checkOnly) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, content);
}

for (const rel of walk(target)) {
  if (wanted.includes(rel)) continue;
  removed.push(rel);
  if (!checkOnly) fs.rmSync(path.join(target, rel));
}

const report = (label, list) => {
  if (!list.length) return;
  console.log(`${label} (${list.length}):`);
  for (const rel of list.slice(0, 12)) console.log(`  ${rel}`);
  if (list.length > 12) console.log(`  … and ${list.length - 12} more`);
};

if (checkOnly) {
  if (!changed.length && !removed.length) {
    console.log(`public/demo/ext is in sync with ${path.relative(landing, source)} (${wanted.length} files).`);
    process.exit(0);
  }
  report("Stale", changed);
  report("Orphaned", removed);
  console.error('Run "npm run sync:ext" and commit the result.');
  process.exit(1);
}

report("Copied", changed);
report("Removed", removed);
console.log(`public/demo/ext: ${wanted.length} files in sync.`);
