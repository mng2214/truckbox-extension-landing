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

const digest = (file) => createHash("sha1").update(fs.readFileSync(file)).digest("hex");

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
  const same = fs.existsSync(to) && digest(from) === digest(to);
  if (same) continue;
  changed.push(rel);
  if (checkOnly) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
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
