import { sql } from "drizzle-orm";

// Whole-message allowlist, not substring matching. Extra questions, symptoms,
// requests, quoted prose and other substantive content must use normal handling.
export function isUnambiguousChefClosing(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[‘’]/g, "'")
    .replace(/[,.!]/g, " ").replace(/\s+/g, " ").trim();
  return /^(?:(?:no )?(?:thanks|thank you) )?(?:that's all(?: i (?:needed|need)| for (?:now|today))?|that is all(?: i (?:needed|need)| for (?:now|today))?|that answers my question|no more questions|i'm (?:all set|done)|i am (?:all set|done)|goodbye|bye)(?: (?:thanks|thank you))?$/.test(normalized);
}

export function chefClosingAcknowledgement(language?: string): string {
  const replies: Record<string, string> = {
    en: "You're welcome. Take care!", es: "De nada. ¡Cuídate!",
    fr: "Avec plaisir. Prenez soin de vous !", de: "Gern geschehen. Alles Gute!",
    it: "Prego. Abbi cura di te!", pt: "De nada. Cuide-se!",
    zh: "不客气，保重！", ja: "どういたしまして。お元気で！",
    ko: "천만에요. 건강히 지내세요!", ar: "على الرحب والسعة. اعتنِ بنفسك!",
    hi: "आपका स्वागत है। अपना ख्याल रखें!", ru: "Пожалуйста. Берегите себя!",
    vi: "Không có gì. Hãy giữ gìn sức khỏe!", tl: "Walang anuman. Ingat!",
  };
  return replies[language?.split("-")[0] ?? "en"] ?? replies.en;
}

/** A reversible total order, including equal timestamps, without schema changes. */
export function chefMessageOrder(direction: "asc" | "desc") {
  const order = direction === "asc" ? sql`ASC` : sql`DESC`;
  return process.env.NODE_ENV === "development"
    ? sql`created_at ${order}, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END ${order}, id ${order}`
    : sql`created_at ${order}`;
}

/** Use the same tuple as ORDER BY so pagination cannot drop timestamp ties. */
export function chefOlderMessageCursor(conversationId: string, beforeId: string) {
  return process.env.NODE_ENV === "development"
    ? sql`(created_at, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, id) < (
        SELECT created_at, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, id
        FROM coach_messages WHERE id = ${beforeId} AND conversation_id = ${conversationId} LIMIT 1
      )`
    : sql`created_at < (SELECT created_at FROM coach_messages WHERE id = ${beforeId} LIMIT 1)`;
}
