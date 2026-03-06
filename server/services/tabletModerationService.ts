export interface ModerationResult {
  allowed: boolean;
  severity: "high" | "medium" | "low" | null;
  reason: string | null;
  matchedTerms: string[];
}

const HIGH_SEVERITY_PATTERNS: RegExp[] = [
  /\bkill\s+(you|yourself|your\s*self|him|her|them)\b/i,
  /\bi['']?ll\s+(kill|hurt|destroy)\b/i,
  /\b(death\s+threat|bomb\s+threat)\b/i,
  /\b(n[i1]gg[ae3]r?s?|f[a@]gg?[o0]ts?|k[i1]ke|sp[i1]c|ch[i1]nk|w[e3]tb[a@]ck|tr[a@]nny)\b/i,
  /\b(rape|mol[e3]st|assault)\s+(you|her|him|them)\b/i,
  /\bgo\s+die\b/i,
];

const MEDIUM_SEVERITY_PATTERNS: RegExp[] = [
  /\b(fuck|f[u\*]ck|f[u\*]{2}k|sh[i1\*]t|b[i1\*]tch|a[s\$]{2}hole|d[i1]ck|c[u\*]nt|wh[o0]re|sl[u\*]t)\b/i,
  /\b(stfu|gtfo|lmfao)\b/i,
  /\b(stupid|idiot|moron|dumb\s*ass|retard)\b/i,
];

const LOW_SEVERITY_PATTERNS: RegExp[] = [
  /\b(damn|hell|crap|piss|suck[s]?)\b/i,
  /\b(shut\s+up)\b/i,
];

function checkPatterns(
  text: string,
  patterns: RegExp[],
  severity: "high" | "medium" | "low"
): { matched: boolean; terms: string[] } {
  const terms: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      terms.push(match[0]);
    }
  }
  return { matched: terms.length > 0, terms };
}

export function moderateContent(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { allowed: true, severity: null, reason: null, matchedTerms: [] };
  }

  const normalized = text.replace(/[^\w\s']/g, " ").replace(/\s+/g, " ");

  const high = checkPatterns(text, HIGH_SEVERITY_PATTERNS, "high");
  if (high.matched) {
    return {
      allowed: false,
      severity: "high",
      reason: "abusive language",
      matchedTerms: high.terms,
    };
  }

  const medium = checkPatterns(text, MEDIUM_SEVERITY_PATTERNS, "medium");
  if (medium.matched) {
    return {
      allowed: false,
      severity: "medium",
      reason: "inappropriate language",
      matchedTerms: medium.terms,
    };
  }

  const low = checkPatterns(text, LOW_SEVERITY_PATTERNS, "low");
  if (low.matched) {
    return {
      allowed: true,
      severity: "low",
      reason: "mild language detected",
      matchedTerms: low.terms,
    };
  }

  return { allowed: true, severity: null, reason: null, matchedTerms: [] };
}
