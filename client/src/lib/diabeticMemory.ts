export type BglBucket = "low" | "in-range" | "elevated" | "high";

export interface DiabeticMemoryStamp {
  version: 1;
  generatedBglMgdl: number;
  glucoseContext: string;
  protocolTypeLabel: string;
  bglBucket: BglBucket;
  recommendedBglRange: string;
  generatedAt: string;
  source: "diabetic-builder";
}

export function getBglBucket(bgl: number): BglBucket {
  if (bgl < 70) return "low";
  if (bgl <= 140) return "in-range";
  if (bgl <= 200) return "elevated";
  return "high";
}

export function getProtocolLabel(bucket: BglBucket): string {
  switch (bucket) {
    case "low":       return "Hypoglycemia Support Protocol";
    case "in-range":  return "Glucose Balance Protocol";
    case "elevated":  return "Elevated Glucose Support";
    case "high":      return "High BGL Management Protocol";
  }
}

export function getRecommendedRange(bgl: number): string {
  const bucket = getBglBucket(bgl);
  switch (bucket) {
    case "low":       return "40–70 mg/dL";
    case "in-range":  return "70–140 mg/dL";
    case "elevated":  return "141–200 mg/dL";
    case "high":      return "200–400 mg/dL";
  }
}

export function buildDiabeticMemory(
  latestBgl: number,
  glucoseContext: string
): DiabeticMemoryStamp {
  const bucket = getBglBucket(latestBgl);
  return {
    version: 1,
    generatedBglMgdl: latestBgl,
    glucoseContext,
    protocolTypeLabel: getProtocolLabel(bucket),
    bglBucket: bucket,
    recommendedBglRange: getRecommendedRange(latestBgl),
    generatedAt: new Date().toISOString(),
    source: "diabetic-builder",
  };
}
