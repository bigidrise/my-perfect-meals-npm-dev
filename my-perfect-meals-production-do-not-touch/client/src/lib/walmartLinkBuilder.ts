// client/src/lib/walmartLinkBuilder.ts

export interface WalmartSearchItem {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  category?: string;
}

const WALMART_SEARCH_BASE = "https://www.walmart.com/search?q=";

/**
 * Normalize a shopping list item into a compact Walmart search term.
 * We keep it simple and robust:
 * - lowercase
 * - strip punctuation
 * - collapse whitespace
 * - optionally add unit to help Walmart find the right size
 */
function normalizeSearchTerm(item: WalmartSearchItem): string {
  let term = (item.name || "").toLowerCase();

  // strip most punctuation, keep alphanumerics and spaces
  term = term
    .replace(/[\r\n]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!term) return "";

  // For some items, adding unit helps (oz, lb, cup, etc.)
  if (item.unit) {
    const unit = item.unit.toLowerCase().trim();
    if (unit && !["each", "unit"].includes(unit)) {
      term += " " + unit;
    }
  }

  return term;
}

/**
 * Build a Walmart search URL that includes all items in a single query.
 * Example: https://www.walmart.com/search?q=chicken+breast,greek+yogurt,broccoli
 */
export function buildWalmartSearchUrl(items: WalmartSearchItem[]): string {
  if (!items || items.length === 0) {
    return "https://www.walmart.com/";
  }

  const terms: string[] = [];

  for (const item of items) {
    const term = normalizeSearchTerm(item);
    if (!term) continue;

    // avoid duplicates
    if (!terms.includes(term)) {
      terms.push(term);
    }

    // crude guard against absurdly long URLs
    const joined = terms.join(", ");
    if (joined.length > 400) {
      break;
    }
  }

  if (terms.length === 0) {
    return "https://www.walmart.com/";
  }

  const query = encodeURIComponent(terms.join(", "));
  return `${WALMART_SEARCH_BASE}${query}`;
}
