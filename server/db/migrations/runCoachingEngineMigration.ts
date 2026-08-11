/**
 * MPM Coaching Engine — Boot Migration
 *
 * Creates all 9 Coaching Engine tables if they don't exist.
 * Called from both server/index.ts (dev) and server/prod.ts (prod).
 *
 * Uses CREATE TABLE IF NOT EXISTS — safe to run on every boot.
 * Per LMS Boot Migrations pattern: must be registered in BOTH files.
 */

import { sql } from "drizzle-orm";

type DbExecutor = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export async function runCoachingEngineMigration(db: DbExecutor): Promise<void> {
  try {
    // 1. coach_conversations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id TEXT NOT NULL,
        specialization TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_conversations_owner_idx
        ON coach_conversations (owner_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_conversations_subject_idx
        ON coach_conversations (subject_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_conversations_owner_spec_idx
        ON coach_conversations (owner_id, specialization, status)
    `);

    // 2. coach_messages
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        structured_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_messages_conversation_idx
        ON coach_messages (conversation_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_messages_conversation_time_idx
        ON coach_messages (conversation_id, created_at)
    `);

    // 3. coach_investigations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_investigations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL,
        message_id UUID,
        intent TEXT,
        observer_selection JSONB,
        evidence_json JSONB NOT NULL,
        matched_pattern_ids TEXT[],
        confidence TEXT NOT NULL DEFAULT 'low',
        coverage_score NUMERIC(4,3),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_investigations_conversation_idx
        ON coach_investigations (conversation_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_investigations_message_idx
        ON coach_investigations (message_id)
    `);

    // 4. coach_action_plans
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_action_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL,
        investigation_id UUID,
        owner_id TEXT NOT NULL,
        why TEXT NOT NULL,
        success_metric TEXT NOT NULL,
        next_check_in TEXT NOT NULL,
        next_check_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'open',
        plan_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_action_plans_conversation_idx
        ON coach_action_plans (conversation_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_action_plans_owner_idx
        ON coach_action_plans (owner_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_action_plans_owner_status_idx
        ON coach_action_plans (owner_id, status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_action_plans_followup_idx
        ON coach_action_plans (status, next_check_at)
        WHERE status = 'open'
    `);

    // 5. coach_action_items
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_action_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL,
        sequence INTEGER NOT NULL DEFAULT 0,
        kind TEXT NOT NULL,
        horizon TEXT NOT NULL,
        text TEXT NOT NULL,
        due_at TIMESTAMPTZ,
        completion_signal TEXT,
        feature_target TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_action_items_plan_idx
        ON coach_action_items (plan_id)
    `);

    // 6. coach_followups
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_followups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL,
        owner_id TEXT NOT NULL,
        due_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload_json JSONB,
        notified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_followups_plan_idx
        ON coach_followups (plan_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_followups_owner_idx
        ON coach_followups (owner_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coach_followups_due_idx
        ON coach_followups (status, due_at)
        WHERE status = 'pending'
    `);

    // 7. coaching_memories
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coaching_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        specialization TEXT NOT NULL,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json JSONB NOT NULL,
        confidence NUMERIC(4,3) NOT NULL,
        source_message_id UUID,
        status TEXT NOT NULL DEFAULT 'active',
        superseded_by_id UUID,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coaching_memories_user_spec_idx
        ON coaching_memories (user_id, specialization)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coaching_memories_user_spec_key_idx
        ON coaching_memories (user_id, specialization, key, status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS coaching_memories_active_idx
        ON coaching_memories (user_id, status, expires_at)
        WHERE status = 'active'
    `);

    // 8. nutrition_memories
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS nutrition_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json JSONB NOT NULL,
        confidence NUMERIC(4,3) NOT NULL,
        source TEXT NOT NULL,
        confirmed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS nutrition_memories_user_idx
        ON nutrition_memories (user_id)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS nutrition_memories_user_key_idx
        ON nutrition_memories (user_id, key)
    `);

    // 9. knowledge_patterns
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS knowledge_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        specialization TEXT NOT NULL,
        key TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT false,
        rule_json JSONB NOT NULL,
        template_json JSONB NOT NULL,
        safety_class TEXT NOT NULL DEFAULT 'routine',
        approved_at TIMESTAMPTZ,
        approved_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_patterns_spec_key_idx
        ON knowledge_patterns (specialization, key)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_patterns_active_idx
        ON knowledge_patterns (specialization, is_active)
        WHERE is_active = true
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS knowledge_patterns_spec_key_version_idx
        ON knowledge_patterns (specialization, key, version)
    `);

    console.log("✅ Coaching Engine boot migration complete (9 tables)");
  } catch (err: any) {
    console.error("❌ Coaching Engine boot migration failed:", err.message);
    // Non-fatal — log and continue. Tables that already exist are safe.
  }
}
