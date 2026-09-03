/**
 * Conversation Summarizer — Phase 5
 *
 * Implements bounded continuity for the coaching engine.
 * When a conversation grows beyond the direct-window threshold,
 * older material is compressed into a validated rolling summary stored
 * in coaching_memories (category='behavior', key='conv_rolling_summary').
 *
 * The platform remembers. The model does not own memory.
 *
 * Authority:
 *  - Summaries are ADDITIVE context only — they do not replace evidence.
 *  - The summary is injected as a contextual note before conversation history.
 *  - A stale summary (>7 days) is refreshed on the next turn that exceeds the window.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const DIRECT_WINDOW = 20;       // messages below this = no summary needed
const SUMMARY_STALE_DAYS = 7;   // refresh if older than this
const SUMMARY_MEMORY_KEY = "conv_rolling_summary";
const SUMMARY_MEMORY_CATEGORY = "behavior";

// ─── Summary storage ──────────────────────────────────────────────────────────

async function loadExistingSummary(
  userId: string,
  specialization: string,
  conversationId: string
): Promise<{ id: string; summary: string; createdAt: Date } | null> {
  try {
    const r = await db.execute<{ id: string; value_json: any; created_at: string }>(sql`
      SELECT id, value_json, created_at
      FROM coaching_memories
      WHERE user_id = ${userId}
        AND specialization = ${specialization}
        AND category = ${SUMMARY_MEMORY_CATEGORY}
        AND key = ${SUMMARY_MEMORY_KEY}
        AND status = 'active'
        AND (value_json->>'conversationId') = ${conversationId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (!r.rows[0]) return null;
    return {
      id: r.rows[0].id,
      summary: r.rows[0].value_json?.summary ?? "",
      createdAt: new Date(r.rows[0].created_at),
    };
  } catch { return null; }
}

async function saveSummary(
  userId: string,
  specialization: string,
  conversationId: string,
  summary: string,
  existingId?: string
): Promise<void> {
  const valueJson = JSON.stringify({ summary, conversationId, generatedAt: new Date().toISOString() });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  if (existingId) {
    await db.execute(sql`
      UPDATE coaching_memories
      SET value_json = ${valueJson}::jsonb,
          created_at = NOW(),
          expires_at = ${expiresAt.toISOString()}
      WHERE id = ${existingId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO coaching_memories
        (user_id, specialization, category, key, value_json, confidence, status, expires_at)
      VALUES (
        ${userId}, ${specialization}, ${SUMMARY_MEMORY_CATEGORY}, ${SUMMARY_MEMORY_KEY},
        ${valueJson}::jsonb, 0.9, 'active', ${expiresAt.toISOString()}
      )
    `);
  }
}

// ─── LLM summarization ────────────────────────────────────────────────────────

async function generateSummary(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const openai = getOpenAI();

  const systemPrompt = [
    "You are summarizing an older portion of a health coaching conversation for context.",
    "Write a compact, factual summary that preserves:",
    "- The user's main health concerns raised",
    "- Key behavioral patterns or facts revealed",
    "- Any action plans that were committed to",
    "- Any confirmed outcomes or follow-ups",
    "Do NOT include generic greetings or filler. Be specific and factual.",
    "Output: a single paragraph, max 200 words, plain text only.",
  ].join("\n");

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Summarize this conversation:\n\n${transcript}` },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err: any) {
    console.warn("[ConversationSummarizer] LLM call failed:", err.message);
    return "";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BoundedHistory {
  /** The most recent messages to inject directly */
  recentMessages: Array<{ role: string; content: string }>;
  /** Optional rolling summary of older material */
  rollingContext: string | null;
  /** Total message count in the conversation */
  totalCount: number;
}

/**
 * Load conversation history with bounded continuity.
 * - If <= DIRECT_WINDOW messages exist: return all directly
 * - If > DIRECT_WINDOW: return last 10 directly + rolling summary of older material
 * - Triggers background summary refresh if stale
 */
export async function loadBoundedHistory(
  conversationId: string,
  userId: string,
  specialization: string
): Promise<BoundedHistory> {
  // Count total messages
  const countResult = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*) as cnt FROM coach_messages
    WHERE conversation_id = ${conversationId}
  `);
  const totalCount = parseInt(countResult.rows[0]?.cnt ?? "0", 10);

  if (totalCount <= DIRECT_WINDOW) {
    // Small conversation — load all directly
    const msgs = await db.execute<{ role: string; content: string }>(sql`
      SELECT role, content FROM coach_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `);
    return { recentMessages: msgs.rows, rollingContext: null, totalCount };
  }

  // Large conversation — load recent window + summary
  const recent = await db.execute<{ role: string; content: string }>(sql`
    SELECT role, content FROM coach_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at DESC
    LIMIT 10
  `);
  const recentMessages = recent.rows.reverse();

  // Load or generate rolling summary (non-blocking for current turn)
  const existing = await loadExistingSummary(userId, specialization, conversationId);

  let rollingContext: string | null = null;

  if (existing && existing.summary) {
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - SUMMARY_STALE_DAYS);

    rollingContext = existing.summary;

    // Refresh stale summary in background (don't block the response)
    if (existing.createdAt < staleCutoff) {
      refreshSummaryBackground(conversationId, userId, specialization, existing.id).catch(
        (err) => console.warn("[ConversationSummarizer] Background refresh failed:", err.message)
      );
    }
  } else {
    // Generate first summary in background — this turn gets no summary
    generateAndSaveSummary(conversationId, userId, specialization, undefined).catch(
      (err) => console.warn("[ConversationSummarizer] First summary failed:", err.message)
    );
  }

  return { recentMessages, rollingContext, totalCount };
}

async function refreshSummaryBackground(
  conversationId: string,
  userId: string,
  specialization: string,
  existingId: string
): Promise<void> {
  await generateAndSaveSummary(conversationId, userId, specialization, existingId);
}

async function generateAndSaveSummary(
  conversationId: string,
  userId: string,
  specialization: string,
  existingId?: string
): Promise<void> {
  // Load all older messages (excluding last 10)
  const allMsgs = await db.execute<{ role: string; content: string }>(sql`
    SELECT role, content FROM coach_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
    LIMIT 200
    OFFSET 0
  `);

  // Exclude the most recent 10 from the summarization input
  const olderMessages = allMsgs.rows.slice(0, Math.max(0, allMsgs.rows.length - 10));
  if (olderMessages.length === 0) return;

  const summary = await generateSummary(olderMessages);
  if (!summary) return;

  await saveSummary(userId, specialization, conversationId, summary, existingId);
  console.log(`[ConversationSummarizer] Summary saved for conversation ${conversationId.slice(0, 8)}`);
}
