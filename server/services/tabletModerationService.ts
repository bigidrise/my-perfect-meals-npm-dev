export interface ModerationResult {
  allowed: boolean;
  severity: "high" | "medium" | "low" | null;
  category:
    | "abusive_language"
    | "personal_info"
    | "off_platform"
    | "inappropriate_relationship"
    | "grooming"
    | "professional_misconduct"
    | "mild_language"
    | null;
  reason: string | null;
  matchedTerms: string[];
}

export const BLOCKED_MESSAGE =
  "Message blocked. For your safety, please keep all communication respectful, professional, and within My Perfect Meals.";

// ─── HIGH SEVERITY ────────────────────────────────────────────────────────────
// Block + flag immediately. No warnings.

const ABUSIVE_LANGUAGE_HIGH: RegExp[] = [
  /\bkill\s+(you|yourself|your\s*self|him|her|them)\b/i,
  /\bi['']?ll\s+(kill|hurt|destroy)\b/i,
  /\b(death\s+threat|bomb\s+threat)\b/i,
  /\b(n[i1]gg[ae3]r?s?|f[a@]gg?[o0]ts?|k[i1]ke|sp[i1]c|ch[i1]nk|w[e3]tb[a@]ck|tr[a@]nny)\b/i,
  /\b(rape|mol[e3]st|assault)\s+(you|her|him|them)\b/i,
  /\bgo\s+die\b/i,
];

// Email addresses — any standard format
const PERSONAL_INFO_EMAIL: RegExp[] = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
];

// Phone numbers — all common formats
const PERSONAL_INFO_PHONE: RegExp[] = [
  /\b\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/,
  /\b\d{3}[\s.\-]\d{3}[\s.\-]\d{4}\b/,
  /\b\d{10}\b/,
  /\b\d{3}[\s.\-]\d{4}\b/,
];

// Social media handles and explicit off-platform contact info
const PERSONAL_INFO_HANDLES: RegExp[] = [
  /\bmy\s+(ig|insta|instagram|snap(chat)?|fb|facebook|twitter|tiktok|telegram|whatsapp|signal)\s+(is|handle|username|account|@)\b/i,
  /\b@[a-zA-Z0-9_]{3,}\b/,
];

// Romantic, sexual, or flirtatious language
const INAPPROPRIATE_RELATIONSHIP: RegExp[] = [
  /\b(i\s+love\s+you|i\s+like\s+you\s+(as\s+more|romantically|that\s+way))/i,
  /\byou('re|\s+are)\s+(so\s+)?(sexy|hot|gorgeous|beautiful|attractive|cute)\b/i,
  /\bi('m|\s+am)\s+(attracted|drawn)\s+to\s+you\b/i,
  /\b(let('s|\s+us)|want\s+to)\s+(date|hook\s+up|meet\s+up\s+privately|have\s+dinner|go\s+out)\b/i,
  /\b(be\s+my\s+(girlfriend|boyfriend|partner|babe|baby))\b/i,
  /\bi\s+have\s+feelings\s+for\s+you\b/i,
  /\b(sexual|flirt|seduce|intimate|romance)\b/i,
  /\bsend\s+(me\s+)?(a\s+)?(pic(s|ture)?|photo|selfie)\b/i,
  /\b(you\s+turn\s+me\s+on|thinking\s+about\s+you)\b/i,
];

// Grooming / predatory language
const GROOMING_PREDATORY: RegExp[] = [
  /\b(keep\s+(this|it)\s+between\s+us|just\s+between\s+us|our\s+little\s+secret)\b/i,
  /\bdon'?t\s+tell\s+(anyone|anybody|your\s+(spouse|partner|husband|wife|family|doctor|trainer))\b/i,
  /\b(special\s+(treatment|relationship|attention|connection)\s+(for\s+you|just\s+for\s+you)?)\b/i,
  /\byou('re|\s+are)\s+(special|different)\s+(to\s+me|from\s+(the\s+)?others?)\b/i,
  /\bi('ll|\s+will)\s+(take\s+care\s+of\s+you\s+personally|give\s+you\s+extra\s+attention)\b/i,
  /\b(groom|manipulat|exploit|prey\s+on)\b/i,
  /\bjust\s+trust\s+me\s+on\s+this\b/i,
  /\bno\s+one\s+(else\s+)?(needs\s+to\s+know|has\s+to\s+know)\b/i,
];

// ─── MEDIUM SEVERITY ──────────────────────────────────────────────────────────
// Block + log. May be ignorance, not malice.

// Off-platform contact attempts
const OFF_PLATFORM: RegExp[] = [
  /\b(text|call|ring|message|dm|pm)\s+me\b/i,
  /\bhit\s+me\s+up\b/i,
  /\b(reach|contact|find)\s+me\s+(outside|off|beyond|away\s+from)\b/i,
  /\boutside\s+(the\s+)?(app|platform|system|my\s+perfect\s+meals)\b/i,
  /\boff\s+(the\s+)?(app|platform)\b/i,
  /\b(my|the)\s+number\s+is\b/i,
  /\bi('ll|\s+will)\s+send\s+you\s+my\s+(number|contact|info|details)\b/i,
  /\b(whatsapp|telegram|signal)\s+(me|us)\b/i,
  /\bfind\s+me\s+on\b/i,
  /\bfollow\s+me\s+on\b/i,
  /\badd\s+me\s+on\b/i,
  /\b(connect|talk)\s+(with\s+me\s+)?(offline|privately|in\s+private|outside)\b/i,
  /\b(instagram|facebook|snapchat|tiktok|twitter)\.com\b/i,
  /\b(give|send|share)\s+(me\s+)?(your\s+)?(number|contact|phone|email|address)\b/i,
];

// Professional misconduct — condescending or coercive
const PROFESSIONAL_MISCONDUCT: RegExp[] = [
  /\byou\s+wouldn'?t\s+understand\b/i,
  /\bjust\s+do\s+(what\s+i\s+say|as\s+i\s+say)\b/i,
  /\byou\s+need\s+to\s+listen\s+to\s+me\b/i,
  /\bi('m|\s+am)\s+the\s+(expert|doctor|coach|professional)\s+here\b/i,
  /\bif\s+you\s+don'?t\s+(do\s+this|listen|comply)\b/i,
  /\bi('ll|\s+will)\s+drop\s+you\s+(as\s+a\s+(client|patient))?\b/i,
  /\bdo\s+what\s+i\s+tell\s+you\b/i,
  /\byou('re|\s+are)\s+being\s+(difficult|impossible|unreasonable|a\s+problem)\b/i,
];

// ─── MEDIUM SEVERITY (existing profanity — kept) ──────────────────────────────
const PROFANITY_MEDIUM: RegExp[] = [
  /\b(fuck|f[u\*]ck|f[u\*]{2}k|sh[i1\*]t|b[i1\*]tch|a[s\$]{2}hole|d[i1]ck|c[u\*]nt|wh[o0]re|sl[u\*]t)\b/i,
  /\b(stfu|gtfo)\b/i,
  /\b(stupid|idiot|moron|dumb\s*ass|retard)\b/i,
];

// ─── LOW SEVERITY ─────────────────────────────────────────────────────────────
// Allow but log.

const MILD_LANGUAGE: RegExp[] = [
  /\b(damn|hell|crap|piss|suck[s]?)\b/i,
  /\b(shut\s+up)\b/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchAny(text: string, patterns: RegExp[]): string[] {
  const terms: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) terms.push(match[0]);
  }
  return terms;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function moderateContent(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { allowed: true, severity: null, category: null, reason: null, matchedTerms: [] };
  }

  // ── HIGH: abusive language ──────────────────────────────────────────────────
  const abusive = matchAny(text, ABUSIVE_LANGUAGE_HIGH);
  if (abusive.length > 0) {
    return { allowed: false, severity: "high", category: "abusive_language", reason: "abusive language", matchedTerms: abusive };
  }

  // ── HIGH: personal contact information ─────────────────────────────────────
  const emails = matchAny(text, PERSONAL_INFO_EMAIL);
  if (emails.length > 0) {
    return { allowed: false, severity: "high", category: "personal_info", reason: "email address shared", matchedTerms: emails };
  }

  const phones = matchAny(text, PERSONAL_INFO_PHONE);
  if (phones.length > 0) {
    return { allowed: false, severity: "high", category: "personal_info", reason: "phone number shared", matchedTerms: phones };
  }

  const handles = matchAny(text, PERSONAL_INFO_HANDLES);
  if (handles.length > 0) {
    return { allowed: false, severity: "high", category: "personal_info", reason: "external contact handle shared", matchedTerms: handles };
  }

  // ── HIGH: inappropriate relationship / flirtation ──────────────────────────
  const relationship = matchAny(text, INAPPROPRIATE_RELATIONSHIP);
  if (relationship.length > 0) {
    return { allowed: false, severity: "high", category: "inappropriate_relationship", reason: "inappropriate relationship language", matchedTerms: relationship };
  }

  // ── HIGH: grooming / predatory ─────────────────────────────────────────────
  const grooming = matchAny(text, GROOMING_PREDATORY);
  if (grooming.length > 0) {
    return { allowed: false, severity: "high", category: "grooming", reason: "grooming or predatory language", matchedTerms: grooming };
  }

  // ── MEDIUM: off-platform contact attempt ───────────────────────────────────
  const offPlatform = matchAny(text, OFF_PLATFORM);
  if (offPlatform.length > 0) {
    return { allowed: false, severity: "medium", category: "off_platform", reason: "off-platform contact attempt", matchedTerms: offPlatform };
  }

  // ── MEDIUM: professional misconduct ────────────────────────────────────────
  const misconduct = matchAny(text, PROFESSIONAL_MISCONDUCT);
  if (misconduct.length > 0) {
    return { allowed: false, severity: "medium", category: "professional_misconduct", reason: "unprofessional conduct", matchedTerms: misconduct };
  }

  // ── MEDIUM: profanity ──────────────────────────────────────────────────────
  const profanity = matchAny(text, PROFANITY_MEDIUM);
  if (profanity.length > 0) {
    return { allowed: false, severity: "medium", category: "abusive_language", reason: "inappropriate language", matchedTerms: profanity };
  }

  // ── LOW: mild language (allow but log) ─────────────────────────────────────
  const mild = matchAny(text, MILD_LANGUAGE);
  if (mild.length > 0) {
    return { allowed: true, severity: "low", category: "mild_language", reason: "mild language detected", matchedTerms: mild };
  }

  return { allowed: true, severity: null, category: null, reason: null, matchedTerms: [] };
}
