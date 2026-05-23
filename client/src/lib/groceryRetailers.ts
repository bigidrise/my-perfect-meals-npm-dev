export type GroceryRetailerId = 'walmart' | 'instacart' | 'amazon-fresh' | 'kroger';

export interface GroceryRetailer {
  id: GroceryRetailerId;
  name: string;
  color: string;
  buildItemUrl: (name: string) => string;
}

/**
 * Normalize a raw ingredient name into a clean, retailer-friendly search term.
 * - Strips preparation notes in parentheses (e.g. "(boneless, skinless)")
 * - Strips common brand prefixes that won't help search (Great Value, Kirkland, etc.)
 * - Strips common prep descriptors that confuse search (boneless, skinless, fresh, etc.)
 * - Lowercases and collapses whitespace
 */
export function normalizeForRetailerSearch(name: string): string {
  let s = name.trim();

  // Strip parenthetical prep notes: "chicken breast (boneless)" → "chicken breast"
  s = s.replace(/\([^)]*\)/g, '');

  // Strip common store-brand prefixes
  s = s.replace(/^(great value|kirkland signature|kirkland|store brand|generic|organic)\s+/i, '');

  // Strip prep/descriptor words that don't help retail search
  s = s.replace(/\b(boneless|skinless|fresh|frozen|chopped|diced|sliced|minced|shredded|cooked|raw|dried|ground|halved|quartered|trimmed|peeled|rinsed|drained)\b/gi, '');

  // Collapse whitespace and lowercase
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();

  return s || name.toLowerCase().trim();
}

export const GROCERY_RETAILERS: GroceryRetailer[] = [
  {
    id: 'walmart',
    name: 'Walmart',
    color: 'bg-blue-800/50 border-blue-500/30',
    buildItemUrl: (name) => {
      const q = normalizeForRetailerSearch(name);
      return q
        ? `https://www.walmart.com/search?q=${encodeURIComponent(q)}`
        : 'https://www.walmart.com/';
    },
  },
  {
    id: 'instacart',
    name: 'Instacart',
    color: 'bg-green-800/50 border-green-500/30',
    buildItemUrl: (name) => {
      const q = normalizeForRetailerSearch(name);
      return q
        ? `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`
        : 'https://www.instacart.com/';
    },
  },
  {
    id: 'amazon-fresh',
    name: 'Amazon Fresh',
    color: 'bg-orange-800/50 border-orange-500/30',
    buildItemUrl: (name) => {
      const q = normalizeForRetailerSearch(name);
      return q
        ? `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=amazonfresh`
        : 'https://www.amazon.com/fresh';
    },
  },
  {
    id: 'kroger',
    name: 'Kroger',
    color: 'bg-blue-900/50 border-blue-400/30',
    buildItemUrl: (name) => {
      const q = normalizeForRetailerSearch(name);
      return q
        ? `https://www.kroger.com/search?query=${encodeURIComponent(q)}`
        : 'https://www.kroger.com/';
    },
  },
];
