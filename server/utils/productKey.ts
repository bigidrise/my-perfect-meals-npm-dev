/**
 * computeProductKey — DB-free utility.
 *
 * Compute a stable deduplication key for a grocery product.
 * - Barcode/UPC is the strongest identity — two scans of the same product always collide.
 * - Without barcode, fall back to normalized brand + product name.
 *
 * Kept in its own file (no DB imports) so it can be used in both the
 * Express route and pure unit tests without opening a database connection.
 */
export function computeProductKey(
  barcode: string | undefined | null,
  brand: string | undefined | null,
  productName: string,
): string {
  if (barcode?.trim()) return `upc::${barcode.trim()}`;
  const b = (brand ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = productName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `name::${b}::${n}`;
}
