export type GroceryRetailerId = 'walmart' | 'instacart' | 'amazon-fresh' | 'kroger';

export interface GroceryRetailer {
  id: GroceryRetailerId;
  name: string;
  buildUrl: (itemNames: string[]) => string;
}

function toSearchString(names: string[]): string {
  return names
    .map((n) => n.toLowerCase().trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const GROCERY_RETAILERS: GroceryRetailer[] = [
  {
    id: 'walmart',
    name: 'Walmart',
    buildUrl: (names) => {
      const q = toSearchString(names);
      return q
        ? `https://www.walmart.com/search?q=${encodeURIComponent(q)}`
        : 'https://www.walmart.com/';
    },
  },
  {
    id: 'instacart',
    name: 'Instacart',
    buildUrl: (names) => {
      const q = toSearchString(names);
      return q
        ? `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`
        : 'https://www.instacart.com/';
    },
  },
  {
    id: 'amazon-fresh',
    name: 'Amazon Fresh',
    buildUrl: (names) => {
      const q = toSearchString(names);
      return q
        ? `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=amazonfresh`
        : 'https://www.amazon.com/fresh';
    },
  },
  {
    id: 'kroger',
    name: 'Kroger',
    buildUrl: (names) => {
      const q = toSearchString(names);
      return q
        ? `https://www.kroger.com/search?query=${encodeURIComponent(q)}`
        : 'https://www.kroger.com/';
    },
  },
];
