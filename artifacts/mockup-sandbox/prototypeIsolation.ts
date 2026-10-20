/** Private synthetic previews are never part of build/preview/deployed discovery. */
export function prototypeDevelopmentAllowed(input: {
  command: string; mode: string; isPreview?: boolean; deployment?: string;
}): boolean {
  return input.command === "serve" && input.mode === "development"
    && !input.isPreview && !input.deployment;
}

export function isDevelopmentPrototypePath(url: string): boolean {
  const privatePath = (value: string) => {
    const normalized = value.toLowerCase();
    return normalized.includes("_development") || normalized.includes("/pairing-advisor/");
  };
  let decoded = url;
  for (let pass = 0; pass < 4; pass++) {
    if (privatePath(decoded)) return true;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  return privatePath(decoded);
}
