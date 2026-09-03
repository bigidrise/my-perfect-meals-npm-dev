/**
 * Phase 4 — Prompt Sanitization Layer
 *
 * Strips direct identifiers from AI prompt strings before they leave the application
 * boundary toward OpenAI. Applied at every enforceBeforeGenerate() call site and
 * at the promptBuilder level.
 *
 * Philosophy:
 *   - Only identity tokens are stripped — medical/dietary content is NEVER modified.
 *   - Sanitization is silent and non-throwing; original text is returned on error.
 *   - No PHI values are ever stored — this file never imports from DB or schema.
 *
 * Covered identifiers:
 *   - Email addresses       → [email]
 *   - US/intl phone numbers → [phone]
 *   - UUID v4 IDs           → [id]
 */

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

const PHONE_RE =
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Returns a copy of `text` with email addresses, phone numbers, and UUID-style
 * identifiers replaced with safe placeholder tokens.
 * Never modifies medical/dietary/clinical content.
 */
export function sanitizeIdentifiers(text: string): string {
  try {
    return text
      .replace(EMAIL_RE, "[email]")
      .replace(PHONE_RE, "[phone]")
      .replace(UUID_RE, "[id]");
  } catch {
    return text;
  }
}
