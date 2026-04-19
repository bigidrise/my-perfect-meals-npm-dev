export type Category = 'Produce'|'Protein'|'Plant Proteins'|'Pantry'|'Dairy & Eggs'|'Frozen'|'Other';
export type ShoppingItem = {
  id: string;
  name: string;
  qty?: number;
  unit?: string;
  note?: string;
  category?: Category;
  checked?: boolean;
  source?: 'meal'|'manual'|'voice'|'barcode';
};