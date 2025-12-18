// tools/syncCravingImages.ts
// Utility: auto‑map your existing images in public/images/cravings to presets.
// - Fuzzy matches filenames to preset names (slug compare)
// - Writes an updated cravingsPresetsData.ts with image paths injected
// - Safe: makes a backup file first; dry‑run supported

/*
Usage:
  1) Save this file as tools/syncCravingImages.ts
  2) Run DRY RUN to preview:
       npx ts-node tools/syncCravingImages.ts --dry
  3) If mapping looks good, write changes:
       npx ts-node tools/syncCravingImages.ts

Assumptions:
  - Images live in: public/images/cravings
  - Data file: client/src/data/cravingsPresetsData.ts
  - Accepts jpg|jpeg|png|webp files
  - Add manual overrides in the OVERRIDES map if any names differ wildly.
*/

import fs from 'fs';
import path from 'path';

const IMAGES_DIR = path.resolve(process.cwd(), 'public/images/cravings');
const DATA_FILE = path.resolve(process.cwd(), 'client/src/data/cravingsPresetsData.ts');
const BACKUP_FILE = DATA_FILE + '.bak';
const DRY = process.argv.includes('--dry');

const ALLOWED = new Set(['.jpg','.jpeg','.png','.webp']);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['`""]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// Manual overrides: key = preset id or slug(name), value = filename in images dir
const OVERRIDES: Record<string,string> = {
  // 'crv-009': 'pizza-cap.webp',
  // 'portobello-pizza-caps': 'pizza-cap.webp',
};

function readImages(): string[] {
  if (!fs.existsSync(IMAGES_DIR)) return [];
  return fs.readdirSync(IMAGES_DIR)
    .filter(f => ALLOWED.has(path.extname(f).toLowerCase()))
    .map(f => path.join(IMAGES_DIR, f));
}

function loadDataFile(): string {
  if (!fs.existsSync(DATA_FILE)) throw new Error('Data file not found: ' + DATA_FILE);
  return fs.readFileSync(DATA_FILE, 'utf8');
}

function writeDataFile(text: string) {
  if (DRY) {
    console.log('\n[DRY RUN] Would write updated data file.');
    return;
  }
  if (!fs.existsSync(BACKUP_FILE)) fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  fs.writeFileSync(DATA_FILE, text, 'utf8');
  console.log('✔ Updated data file written. Backup at:', BACKUP_FILE);
}

function extractPresets(src: string) {
  // naive parse: pull CRAVING_PRESETS items; we only need id & name blocks
  const items: { id: string; name: string }[] = [];
  const rx = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)"[\s\S]*?\}/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src))) items.push({ id: m[1], name: m[2] });
  return items;
}

function buildIndexBySlug(files: string[]) {
  const idx = new Map<string,string>();
  for (const full of files) {
    const base = path.basename(full, path.extname(full));
    idx.set(slugify(base), full);
  }
  return idx;
}

function proposeMapping(presets: {id:string; name:string}[], idx: Map<string,string>) {
  const map: Record<string,string> = {};
  for (const p of presets) {
    if (OVERRIDES[p.id]) { map[p.id] = OVERRIDES[p.id]; continue; }
    const s = slugify(p.name);
    if (OVERRIDES[s]) { map[p.id] = OVERRIDES[s]; continue; }

    if (idx.has(s)) { // direct slug match
      map[p.id] = path.basename(idx.get(s)!);
      continue;
    }

    // loose match: drop common tokens
    const loose = s
      .replace(/(healthy|light|protein|single-serve|air-fryer|baked)/g,'')
      .replace(/--+/g,'-')
      .replace(/^-+|-+$/g,'');
    for (const key of idx.keys()) {
      if (key.includes(loose) || loose.includes(key)) {
        map[p.id] = path.basename(idx.get(key)!);
        break;
      }
    }
  }
  return map;
}

function injectImages(src: string, mapping: Record<string,string>) {
  // Insert or replace image: "image: \"/images/cravings/<file>\"," in each item
  return src.replace(/\{\s*id:\s*"([^"]+)",[\s\S]*?name:\s*"([^"]+)"([\s\S]*?)\}/g, (full, id, name, rest) => {
    const file = mapping[id];
    if (!file) return full; // no change
    const rel = `/images/cravings/${file}`;

    if (/image:\s*"[^"]+"/.test(full)) {
      // replace existing image path
      return full.replace(/image:\s*"[^"]+"/, `image: "${rel}"`);
    }

    // Insert image right after name
    return full.replace(
      new RegExp(`(name:\\s*\"${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\")`),
      `$1,\n    image: "${rel}"`
    );
  });
}

(function main(){
  const src = loadDataFile();
  const presets = extractPresets(src);
  const files = readImages();
  console.log('Found', presets.length, 'presets; images:', files.length);
  const idx = buildIndexBySlug(files);
  const mapping = proposeMapping(presets, idx);
  console.table(Object.entries(mapping).map(([id, file]) => ({ id, file })));
  const updated = injectImages(src, mapping);
  writeDataFile(updated);
})();