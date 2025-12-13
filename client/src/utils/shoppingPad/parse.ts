import type { ShoppingItem } from './types';
import { normalizeUnit } from './normalize';

const NUM_WORDS: Record<string, number> = {
  a:1, an:1, one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
  half:0.5, quarter:0.25, couple:2, dozen:12
};

// map unicode fractions → decimals
function normalizeFractions(s: string){
  return s
    .replace(/½/g, ' 1/2')
    .replace(/¼/g, ' 1/4')
    .replace(/¾/g, ' 3/4');
}
function parseFraction(q: string){
  // "1/2", "3/4"
  const m = q.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return NaN;
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  return b ? a/b : NaN;
}

const ADJECTIVES = /\b(large|small|medium|fresh|organic|boneless|skinless|lean|ripe|ripe|unsalted|low[-\s]sodium|gluten[-\s]free|dairy[-\s]free)\b/gi;
// common filler words
const STOPWORDS = /\b(of|a|an|the|pack|package|bag|box|bottle|jar|can|cans)\b/gi;
// "brand" style words we ignore for grouping
const BRANDY = /\b(kroger|walmart|great value|trader joe'?s|costco|kirkland|aldi)\b/gi;

function cleanName(s: string){
  return s
    .replace(ADJECTIVES, '')
    .replace(BRANDY, '')
    .replace(/\s{2,}/g,' ')
    .trim();
}

function toQty(raw: string): number | undefined {
  const v = raw.toLowerCase().trim();
  if (NUM_WORDS[v] != null) return NUM_WORDS[v];
  // "1 1/2"
  const parts = v.split(/\s+/);
  if (parts.length === 2 && /^\d+$/.test(parts[0]) && parts[1].includes('/')) {
    const base = parseFloat(parts[0]);
    const frac = parseFraction(parts[1]);
    const sum = isNaN(frac) ? NaN : base + frac;
    return isNaN(sum) ? undefined : sum;
  }
  // "1/2"
  if (v.includes('/')) {
    const f = parseFraction(v);
    return isNaN(f) ? undefined : f;
  }
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function stripParenSizes(s: string){
  // e.g. "2 (14-oz) cans black beans" → returns { rest, unitHint:"oz" }
  const m = s.match(/\((\d+(?:\.\d+)?)\s*[-\s]?([a-zA-Z]+)\)/);
  if (!m) return { rest: s, unitHint: undefined as string|undefined };
  const unitHint = normalizeUnit(m[2]);
  const rest = s.replace(m[0], '').replace(/\s{2,}/g,' ').trim();
  return { rest, unitHint };
}

function splitLines(text: string){
  // safer split on and/newlines/commas; avoid breaking words like "almond"
  return text
    .replace(/[,;]+/g, '\n')
    .replace(/\s+\band\b\s+/gi, '\n')
    .split(/\n+/)
    .map(t=>t.trim())
    .filter(Boolean);
}

export function parseLineToItem(line: string): ShoppingItem {
  let s = normalizeFractions(line).trim();
  s = s.replace(/[,.;]+/g,' ');
  // remove "of" etc only when surrounded by spaces
  s = s.replace(/\bof\b/gi,' ');

  // pull out parenthetical size hints like (14-oz)
  const { rest, unitHint } = stripParenSizes(s);
  s = rest;

  // Pattern A: qty + unit + name  (e.g., "2 lb chicken breast", "two cans black beans")
  let m = s.match(/^((?:\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|couple|dozen))\s+([a-zA-Z]+)\s+(.+)$/i);
  if (m){
    const qty = toQty(m[1]);
    const unit = normalizeUnit(m[2]) || unitHint;
    const name = cleanName(m[3]);
    return { id: crypto.randomUUID(), name, qty, unit, source:'voice' };
  }

  // Pattern B: qty + name  (e.g., "2 chicken breasts", "1 1/2 cups rice" misread)
  m = s.match(/^((?:\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|couple|dozen))\s+(.+)$/i);
  if (m){
    const qty = toQty(m[1]);
    // Try to peel a leading unit word from the name if present: "1 1/2 cups rice"
    const m2 = m[2].match(/^([a-zA-Z]+)\s+(.+)$/);
    let unit: string|undefined = unitHint;
    let nameRaw = m[2];
    if (m2) {
      const maybeUnit = normalizeUnit(m2[1]);
      if (maybeUnit && ['cup','tbsp','tsp','oz','lb','g','kg','ml','l','can','packet','count'].includes(maybeUnit)) {
        unit = maybeUnit;
        nameRaw = m2[2];
      }
    }
    const name = cleanName(nameRaw);
    return { id: crypto.randomUUID(), name, qty, unit, source:'voice' };
  }

  // Pattern C: plain name
  const name = cleanName(s.replace(STOPWORDS,' '));
  return { id: crypto.randomUUID(), name, source:'voice' };
}

export function parseMultiLineToItems(text: string): ShoppingItem[] {
  return splitLines(text).map(parseLineToItem);
}