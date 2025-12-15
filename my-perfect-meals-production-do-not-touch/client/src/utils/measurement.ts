export function toHalfStep(valueOz: number) {
  // Round to nearest 0.5 oz
  return Math.round(valueOz * 2) / 2;
}

export function oz(valueOz: number) {
  // Format like 3 1/2 oz or 4 oz
  const whole = Math.trunc(valueOz);
  const frac = valueOz - whole;
  if (Math.abs(frac) < 0.001) return `${whole} oz`;
  if (Math.abs(frac - 0.5) < 0.001) return `${whole} 1/2 oz`;
  // fallback for odd decimals
  return `${valueOz.toFixed(1)} oz`;
}