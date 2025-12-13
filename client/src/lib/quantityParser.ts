const fractionMap: Record<string, number> = {
  "½": 0.5,
  "⅓": 0.333,
  "⅔": 0.667,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 0.167,
  "⅚": 0.833,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

export function parseQuantity(input: string | number): number {
  if (typeof input === "number") return input;
  
  const str = String(input).trim();
  if (!str) return 1;

  const decimalMatch = str.match(/^(\d+\.\d+)$/);
  if (decimalMatch) {
    return parseFloat(decimalMatch[1]);
  }

  const wholeMatch = str.match(/^(\d+)\s*(.*)$/);
  if (wholeMatch) {
    const [, whole, rest] = wholeMatch;
    const wholeNum = parseInt(whole);
    
    if (!rest) return wholeNum;
    
    for (const [symbol, value] of Object.entries(fractionMap)) {
      if (rest === symbol) {
        return wholeNum + value;
      }
    }
    
    const fracMatch = rest.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) {
      const [, numerator, denominator] = fracMatch;
      return wholeNum + parseInt(numerator) / parseInt(denominator);
    }
    
    return wholeNum;
  }

  for (const [symbol, value] of Object.entries(fractionMap)) {
    if (str === symbol) {
      return value;
    }
  }

  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const [, numerator, denominator] = fractionMatch;
    return parseInt(numerator) / parseInt(denominator);
  }

  return 1;
}
