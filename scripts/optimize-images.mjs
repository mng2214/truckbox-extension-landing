import sharp from "sharp";
import { readdir, stat, unlink } from "node:fs/promises";
import { join, extname } from "node:path";

const DIRS = ["public/guide", "public/demos", "public/compare"];
const deleteOriginals = process.argv.includes("--delete-originals");

for (const dir of DIRS) {
  for (const name of await readdir(dir)) {
    const ext = extname(name).toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(ext)) continue;
    const src = join(dir, name);
    const out = join(dir, name.slice(0, -ext.length) + ".webp");
    const before = (await stat(src)).size;
    await sharp(src).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    const after = (await stat(out)).size;
    console.log(`${src}: ${(before / 1024).toFixed(0)}K -> ${(after / 1024).toFixed(0)}K`);
    if (deleteOriginals) await unlink(src);
  }
}
console.log("done");
