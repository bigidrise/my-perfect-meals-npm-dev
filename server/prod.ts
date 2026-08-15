// CRITICAL: Start server FIRST, import everything else AFTER
// This ensures health checks pass even if other imports crash
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 [BOOT] Production server starting...");
console.log(`🕐 [BOOT] Start time: ${new Date().toISOString()}`);
console.log(`📍 [BOOT] PORT env: ${process.env.PORT || "5000 (default)"}`);
console.log(`📍 [BOOT] NODE_ENV: ${process.env.NODE_ENV || "not set"}`);

// Crash prevention: log errors instead of dying silently
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("🚨 UNCAUGHT EXCEPTION:", error);
});

// ─── SECURITY: SESSION_SECRET must be explicitly set in production ────────────
if (!process.env.SESSION_SECRET) {
  console.error("🚨 FATAL: SESSION_SECRET environment variable is not set. Refusing to start without it.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

// Sandbox reset is registered inside initializeApp() via dynamic import,
// placed explicitly before registerRoutes() so it precedes any
// app.use("/api", requireAuth, ...) layers added by registerRoutes.

// Track initialization state
let isInitialized = false;
let initError: Error | null = null;

// CRITICAL: Health checks MUST respond IMMEDIATELY - no middleware, no delays
// Cloud Run checks root path (/) for readiness
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/", (_req, res, next) => {
  if (!isInitialized) {
    return res.status(200).send("ok - server starting");
  }
  next();
});

app.get("/google0c1c00ed46ab3246.html", (_req, res) => {
  res
    .type("text/html")
    .send("google-site-verification: google0c1c00ed46ab3246.html\n");
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    initialized: isInitialized,
    initError: initError?.message || null,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "production",
    hasDatabase: !!process.env.DATABASE_URL,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    isDeployment: process.env.REPLIT_DEPLOYMENT === "1",
    // Must be true before real users onboard. When false/unset every user gets
    // PAID_FULL regardless of plan — a complete paywall bypass.
    billingEnforced: process.env.BILLING_ENFORCED === "true",
  });
});

// Lightweight health probe for the Coach Knowledge Library.
// Returns the live knowledge_patterns row count so uptime monitors can alert
// on a zero-row table (indicating the seed failed all boot retries).
app.get("/api/health/coaching-patterns", async (_req, res) => {
  try {
    const { db: dbHealth } = await import("./db");
    const { sql: sqlHealth } = await import("drizzle-orm");
    const result = await dbHealth.execute(
      sqlHealth`SELECT COUNT(*)::int AS row_count FROM knowledge_patterns`
    );
    const rowCount = (result as any).rows?.[0]?.row_count ?? (result as any)[0]?.row_count ?? 0;
    const healthy = Number(rowCount) > 0;
    res.status(healthy ? 200 : 503).json({
      ok: healthy,
      knowledge_patterns_count: Number(rowCount),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      ok: false,
      knowledge_patterns_count: null,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// START SERVER IMMEDIATELY - health checks respond before any heavy init
const port = Number(process.env.PORT || 5000);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`✅ [BOOT] Server listening on 0.0.0.0:${port}`);
  console.log(
    `⏱️ [BOOT] Ready for health checks at: ${new Date().toISOString()}`,
  );

  // Now initialize everything else in background
  initializeApp().catch((err) => {
    console.error("❌ [INIT] Background initialization failed:", err);
    initError = err;
  });
});

server.on("error", (err) => {
  console.error("🚨 [BOOT] Server error:", err);
});

// EARLY: Register static files and SPA fallback immediately so client routes
// work during the background initialization window. API routes (/api/*) are
// excluded here and will be handled once initializeApp() registers them.
const clientDistEarly = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDistEarly)) {
  // Serve static assets (JS bundles, CSS, images, etc.)
  app.use(
    express.static(clientDistEarly, {
      setHeaders: (res, filePath) => {
        if (
          /\.(js|css)$/i.test(filePath) &&
          /[\.\-][a-f0-9]{8,}\./.test(filePath)
        ) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/index\.html$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }),
  );
  // SPA fallback for all non-API GET routes — catches /sushi-creator, /lifestyle/*, etc.
  // Uses app.use() (middleware, not a named route) to avoid breaking Express route audits
  // that call .startsWith() on route paths — RegExp paths don't support .startsWith().
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.sendFile(path.join(clientDistEarly, "index.html"));
    }
    next();
  });
  console.log("✅ [BOOT] Early static + SPA fallback registered");
}

// Runs data-only migrations that are safe to defer past the 6-second boot window.
// Both queries are fully idempotent: the UPDATE only touches rows still at the
// default false, and the INSERT skips users who already have a platform_mastery
// record. A 30-second timeout gives the prod DB plenty of room under load.
async function runGrandfatherMigrations() {
  const { db: database } = await import("./db");
  const { sql } = await import("drizzle-orm");

  const timeout30s = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Grandfather migration timed out after 30000ms")), 30000),
  );

  await Promise.race([
    (async () => {
      // Grandfather existing certified professionals — Phase 2 gate protection
      // Sets procare_training_completed=true for professionals who completed Phase 1
      // BEFORE Phase 2 training existed (cutoff: 2026-07-01).
      // Idempotent: only touches rows still at the default false.
      const grandfatherResult = await database.execute(sql`
        UPDATE users
        SET procare_training_completed = true
        WHERE
          professional_role IS NOT NULL
          AND procare_training_completed = false
          AND id IN (
            SELECT user_id FROM user_certifications
            WHERE certification_type IN ('platform', 'affiliate_coaching')
              AND completed_at IS NOT NULL
              AND completed_at < '2026-07-01T00:00:00Z'
          )
      `);
      const grandfatheredCount = (grandfatherResult as any).rowCount ?? (grandfatherResult as any).count ?? '?';
      console.log(`✅ [INIT] Grandfather migration: ${grandfatheredCount} professional(s) grandfathered (procare_training_completed=true)`);

      // Cert-type bridge migration — Platform Mastery rename
      // Copies completed "platform" cert records to "platform_mastery" for users who
      // completed the Academy before the cert type was renamed. Idempotent: skips users
      // who already have a "platform_mastery" record.
      const certBridgeResult = await database.execute(sql`
        INSERT INTO user_certifications (user_id, certification_type, status, completed_at, certificate_number, certificate_name, is_certification_track, created_at, updated_at)
        SELECT
          uc.user_id,
          'platform_mastery',
          uc.status,
          uc.completed_at,
          CONCAT('cert-type-bridge-v1:', COALESCE(uc.certificate_number, '')),
          uc.certificate_name,
          uc.is_certification_track,
          NOW(),
          NOW()
        FROM user_certifications uc
        WHERE uc.certification_type = 'platform'
          AND uc.status = 'completed'
          AND uc.is_certification_track = true
          AND uc.completed_at < '2026-07-15T00:00:00Z'
          AND NOT EXISTS (
            SELECT 1 FROM user_certifications pm
            WHERE pm.user_id = uc.user_id
              AND pm.certification_type = 'platform_mastery'
          )
      `);
      const certBridgeCount = (certBridgeResult as any).rowCount ?? (certBridgeResult as any).count ?? '?';
      console.log(`✅ [INIT] Cert-type bridge: ${certBridgeCount} "platform" → "platform_mastery" record(s) created`);
    })(),
    timeout30s,
  ]);
}

// Initialize application in background AFTER server is listening
async function initializeApp() {
  const startTime = Date.now();
  console.log("📋 [INIT] Starting background initialization...");

  try {
    // Initialize Sentry as early as possible so captureException works throughout boot
    const { initSentry } = await import("./lib/sentry");
    initSentry();

    // Import bootstrap modules
    console.log("📋 [INIT] Loading bootstrap modules...");
    await import("./bootstrap-fetch");
    await import("./bootstrap/envSetup");

    const { logBootStatus, validateCriticalEnv } = await import(
      "./bootstrap/envSetup"
    );
    logBootStatus("production");

    const envValidation = validateCriticalEnv();
    if (!envValidation.valid) {
      console.warn(
        "⚠️ [INIT] Missing env vars:",
        envValidation.missing.join(", "),
      );
    }

    // Safe column migrations — wrapped in a hard 6 s timeout so a locked table
    // never stalls the full boot sequence. Columns were added in earlier deploys;
    // this is a no-op on a live DB and can safely be skipped if slow.
    //
    // schemaMigPromise is declared outside the try/catch so the background
    // grandfather migration task can await it — ensuring data migrations never
    // run before the required columns exist, even when boot times out first.
    let schemaMigPromise: Promise<void> = Promise.resolve();

    console.log("📋 [INIT] Running safe column migrations...");
    try {
      const migTimeout = (ms: number) =>
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Migration timed out after ${ms}ms`)),
            ms,
          ),
        );

      const { db: database } = await import("./db");
      const { sql } = await import("drizzle-orm");

      // Assign the IIFE to a named promise before racing so the background
      // grandfather task can await its natural completion independently.
      schemaMigPromise = (async () => {
          await database.execute(
            sql`ALTER TABLE macro_logs ADD COLUMN IF NOT EXISTS starchy_carbs numeric DEFAULT '0' NOT NULL`,
          );
          await database.execute(
            sql`ALTER TABLE macro_logs ADD COLUMN IF NOT EXISTS fibrous_carbs numeric DEFAULT '0' NOT NULL`,
          );
          await database.execute(
            sql`ALTER TABLE client_links ADD COLUMN IF NOT EXISTS meal_board_control text NOT NULL DEFAULT 'client'`,
          );
          await database.execute(
            sql`ALTER TABLE client_links ADD COLUMN IF NOT EXISTS board_control_updated_at timestamptz`,
          );
          // Diabetic Meal Builder saved-meals columns
          await database.execute(
            sql`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS saved_from_diabetic_builder boolean NOT NULL DEFAULT false`,
          );
          await database.execute(
            sql`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS generated_bgl_mgdl integer`,
          );
          await database.execute(
            sql`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS glucose_context varchar(64)`,
          );
          await database.execute(
            sql`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS protocol_type varchar(64)`,
          );
          await database.execute(
            sql`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS bgl_bucket varchar(16)`,
          );
          // LMS: video progress + cert version tracking
          await database.execute(
            sql`ALTER TABLE certification_module_progress ADD COLUMN IF NOT EXISTS video_watched_pct integer DEFAULT 0`,
          );
          await database.execute(
            sql`ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS is_current_version boolean DEFAULT true`,
          );
          await database.execute(
            sql`ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS updates_pending integer DEFAULT 0`,
          );
          await database.execute(
            sql`ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS is_certification_track boolean DEFAULT false`,
          );
          await database.execute(
            sql`ALTER TABLE companion_profiles ADD COLUMN IF NOT EXISTS pet_type text DEFAULT 'dog'`,
          );
          // My Perfect Pregnancy — boot migrations
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pregnancy_stage text`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pregnancy_due_date text`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pregnancy_support_context jsonb`);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS pregnancy_conversations (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id text NOT NULL UNIQUE,
              messages jsonb NOT NULL DEFAULT '[]'::jsonb,
              updated_at timestamptz NOT NULL DEFAULT now()
            )
          `);
          // Performance Nutrition Protocol — boot migrations
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_context jsonb`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS competition_prep_context jsonb`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_protocol_track text`);
          // Carb Response Engine — boot migration
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS carb_cycle_state jsonb`);
          // Adaptive Performance Nutrition — Sprint 1
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_training_schedule jsonb`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_protocol_config jsonb`);
          // Therapeutic Nutrition Intelligence — Sprint 4
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS therapeutic_support_context jsonb`);
          // Alpha-gal Syndrome — clinical allergy protocol profile
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS alpha_gal_profile jsonb`);
          // DailyNutritionPrescription — persistent starch preferences
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_starch_meals_per_day integer`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS starch_distribution_strategy text`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_mode_enabled boolean NOT NULL DEFAULT false`);
          // Clinical Context Screening — self-reported medication/hormone gate
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_response text`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_categories jsonb`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_updated_at timestamptz`);
          // Professional Launchpad — Phase 2 ProCare training completion gate
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS procare_training_completed boolean NOT NULL DEFAULT false`);
          // Acquisition tracking — signup source captured from ?source= / ?ref= URL param
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source text`);
          // Organization relationship split — attribution (who brought them) vs care (who coaches them)
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS attribution_organization_id uuid`);
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS care_organization_id uuid`);
          // Language Preference — Phase 1 internationalization
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'auto'`);
          // LMS content tables
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS cert_modules (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              cert_type text NOT NULL,
              slug text NOT NULL,
              title text NOT NULL,
              description text,
              module_type text NOT NULL DEFAULT 'quiz',
              video_url text,
              sort_order integer NOT NULL DEFAULT 0,
              passing_score_pct integer DEFAULT 80,
              question_limit integer DEFAULT 5,
              is_active boolean DEFAULT true,
              created_at timestamptz NOT NULL DEFAULT now(),
              CONSTRAINT uniq_cert_module_slug UNIQUE (cert_type, slug)
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS cert_questions (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              cert_type text NOT NULL,
              module_slug text NOT NULL,
              question_text text NOT NULL,
              is_active boolean DEFAULT true,
              sort_order integer NOT NULL DEFAULT 0,
              created_at timestamptz NOT NULL DEFAULT now()
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS cert_question_options (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              question_id uuid NOT NULL,
              option_text text NOT NULL,
              is_correct boolean DEFAULT false,
              sort_order integer NOT NULL DEFAULT 0
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS lms_update_modules (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              title text NOT NULL,
              description text,
              video_url text,
              target_roles text[],
              is_required boolean DEFAULT false,
              related_cert_type text,
              released_at timestamptz,
              created_at timestamptz NOT NULL DEFAULT now()
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS user_lms_updates (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id text NOT NULL,
              update_module_id uuid NOT NULL,
              video_watched boolean DEFAULT false,
              completed boolean DEFAULT false,
              completed_at timestamptz,
              created_at timestamptz NOT NULL DEFAULT now(),
              CONSTRAINT uniq_user_lms_update UNIQUE (user_id, update_module_id)
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS white_label_inquiries (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              name text NOT NULL,
              email text NOT NULL,
              business_name text NOT NULL,
              audience_size text,
              use_case text NOT NULL,
              checkboxes_acknowledged jsonb NOT NULL,
              stages_acknowledged jsonb NOT NULL,
              submitted_at timestamptz NOT NULL DEFAULT now(),
              ip_address text,
              user_agent text
            )
          `);
          // Adaptive Coaching Engine (ACE) — Sprint 1+2
          const { runAceMigration } = await import("./services/ace/aceBootMigration");
          await runAceMigration();
          console.log("✅ [INIT] ACE boot migration complete");

          // GLP-1 Daily Behavioral Tolerance — Phase 1 (corrected)
          //
          // glp1_profile: base row per user, matches migrations/0005_create_glp1_profile.sql.
          // Canonical schema: id, user_id UNIQUE, guardrails JSONB, created_at, updated_at.
          // Tolerance is time-series data and must NOT be stored on glp1_profile.
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS glp1_profile (
              id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id TEXT UNIQUE NOT NULL,
              guardrails JSONB DEFAULT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
          `);

          // Drop the 12 tolerance columns incorrectly added to glp1_profile in Phase 1 boot.
          // Idempotent IF EXISTS — safe to run even if columns never existed.
          for (const col of [
            'tolerance_date', 'nausea_level', 'has_vomiting', 'hydration_risk',
            'has_reflux', 'has_diarrhea', 'has_constipation', 'appetite_level',
            'should_escalate', 'escalation_reason', 'water_ml_logged', 'tolerance_rules_fired',
          ]) {
            await database.execute(sql`ALTER TABLE glp1_profile DROP COLUMN IF EXISTS ${sql.raw(col)}`);
          }

          // glp1_daily_tolerance: dated snapshot — one row per user per day.
          // UNIQUE(user_id, tolerance_date) ensures re-resolving upserts, not duplicates.
          // Mirrors migrations/0009_create_glp1_daily_tolerance.sql.
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS glp1_daily_tolerance (
              id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id               TEXT NOT NULL,
              tolerance_date        DATE NOT NULL,
              nausea_level          TEXT NOT NULL DEFAULT 'none',
              has_vomiting          BOOLEAN NOT NULL DEFAULT FALSE,
              hydration_risk        TEXT NOT NULL DEFAULT 'none',
              has_reflux            BOOLEAN NOT NULL DEFAULT FALSE,
              has_diarrhea          BOOLEAN NOT NULL DEFAULT FALSE,
              has_constipation      BOOLEAN NOT NULL DEFAULT FALSE,
              appetite_level        TEXT NOT NULL DEFAULT 'normal',
              should_escalate       BOOLEAN NOT NULL DEFAULT FALSE,
              escalation_reason     TEXT,
              water_ml_logged       INTEGER NOT NULL DEFAULT 0,
              rules_applied         TEXT[] NOT NULL DEFAULT '{}',
              rules_withheld        TEXT[] NOT NULL DEFAULT '{}',
              rules_evaluated       TEXT[] NOT NULL DEFAULT '{}',
              nutrition_adaptations TEXT[] NOT NULL DEFAULT '{}',
              safety_escalations    TEXT[] NOT NULL DEFAULT '{}',
              resolver_version      TEXT NOT NULL DEFAULT '1.0',
              resolved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(user_id, tolerance_date)
            )
          `);
          await database.execute(sql`
            CREATE INDEX IF NOT EXISTS glp1_daily_tolerance_user_date
              ON glp1_daily_tolerance(user_id, tolerance_date DESC)
          `);
          console.log("✅ [INIT] GLP-1 daily tolerance boot migration complete (glp1_daily_tolerance)");

          // glp1_daily_checkins: structured hub self-assessment
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS glp1_daily_checkins (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id text NOT NULL,
              check_in_date date NOT NULL,
              submitted_at timestamptz NOT NULL DEFAULT NOW(),
              source text NOT NULL DEFAULT 'hub',
              nausea text NOT NULL DEFAULT 'none',
              constipation text NOT NULL DEFAULT 'none',
              diarrhea text NOT NULL DEFAULT 'none',
              reflux text NOT NULL DEFAULT 'none',
              bloating text NOT NULL DEFAULT 'none',
              early_fullness text NOT NULL DEFAULT 'none',
              food_aversions text NOT NULL DEFAULT 'none',
              fatigue text NOT NULL DEFAULT 'none',
              dizziness text NOT NULL DEFAULT 'none',
              headache text NOT NULL DEFAULT 'none',
              vomiting text NOT NULL DEFAULT 'none',
              can_keep_fluids_down text NOT NULL DEFAULT 'yes',
              can_eat_without_worsening text NOT NULL DEFAULT 'yes',
              reduced_urination boolean NOT NULL DEFAULT false,
              symptom_trend text NOT NULL DEFAULT 'na',
              symptoms_after_dose text NOT NULL DEFAULT 'unsure',
              appetite_level text NOT NULL DEFAULT 'normal',
              medication_name text,
              medication_class text,
              notify_care_team text NOT NULL DEFAULT 'none'
            )
          `);
          await database.execute(sql`
            CREATE INDEX IF NOT EXISTS glp1_daily_checkins_user_date_idx
              ON glp1_daily_checkins(user_id, check_in_date, submitted_at DESC)
          `);
          console.log("✅ [INIT] GLP-1 hub checkins boot migration complete (glp1_daily_checkins)");

          // Waitlist notify — email_sent_at column + orphan recovery
          // email_sent_at tracks confirmed sends separately from notified_at (claim lock).
          // On restart, rows with notified_at SET but email_sent_at NULL were claimed mid-send
          // and never confirmed — reset them so the next notify run picks them up cleanly.
          await database.execute(sql`
            ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS email_sent_at timestamptz
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS waitlist_recovery_events (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              recovered_at timestamptz NOT NULL DEFAULT now(),
              row_count int NOT NULL,
              user_ids jsonb NOT NULL DEFAULT '[]'
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS waitlist_notify_run_logs (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              triggered_at timestamptz NOT NULL DEFAULT now(),
              triggered_by_user_id text NOT NULL,
              triggered_by_email text NOT NULL,
              status text NOT NULL DEFAULT 'started',
              sent int NOT NULL DEFAULT 0,
              skipped int NOT NULL DEFAULT 0,
              failed int NOT NULL DEFAULT 0,
              force boolean NOT NULL DEFAULT false,
              failures jsonb NOT NULL DEFAULT '[]'
            )
          `);
          await database.execute(sql`
            ALTER TABLE waitlist_notify_run_logs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'started'
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS cert_relink_audit_log (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              admin_user_id text NOT NULL,
              old_user_id text NOT NULL,
              new_user_id text NOT NULL,
              certification_type text NOT NULL,
              certificate_number text,
              progress_rows_relinked int NOT NULL DEFAULT 0,
              created_at timestamptz NOT NULL DEFAULT now()
            )
          `);
          // Reset orphaned rows and capture their user IDs atomically via CTE.
          // If any rows were reset, write a structured audit entry so admins can
          // see exactly which users were affected and when.
          const orphanResult = await database.execute(sql`
            WITH reset AS (
              UPDATE user_certifications
              SET notified_at = NULL
              WHERE certification_type = 'marketing_coaching'
                AND status = 'waitlisted'
                AND notified_at IS NOT NULL
                AND email_sent_at IS NULL
              RETURNING user_id
            ),
            audit AS (
              INSERT INTO waitlist_recovery_events (row_count, user_ids)
              SELECT count(*)::int, jsonb_agg(user_id)
              FROM reset
              HAVING count(*) > 0
            )
            SELECT count(*)::int AS recovered FROM reset
          `);
          const orphanCount = Number((orphanResult.rows?.[0] as any)?.recovered ?? 0);
          if (orphanCount > 0) {
            console.log(`♻️  [INIT] Waitlist orphan recovery: reset notified_at for ${orphanCount} row(s) claimed but never confirmed sent (server restart mid-send). Audit row written to waitlist_recovery_events. They will be retried on next notify run.`);
          }

          // Unique partial index — prevents a second active row for the same
          // (business_id, user_id) pair even if the in-code guard is bypassed
          // (race condition, partial failure). Allows re-invite because removed
          // rows are not covered by the WHERE clause. Idempotent via IF NOT EXISTS.
          await database.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_active
              ON business_members (business_id, user_id)
              WHERE status = 'active'
          `);
          console.log("✅ [INIT] business_members active uniqueness index ensured");

          // Trial grants schema — must run inside schemaMigPromise (not a deferred
          // setTimeout) so trial_source column and trial_grants table exist before
          // any signup request writes trial_source. Uses IF NOT EXISTS throughout
          // so it is a no-op on an already-migrated database.
          const { runTrialGrantsMigration } = await import("./db/migrations/runTrialGrantsMigration");
          await runTrialGrantsMigration(database as any);
          console.log("✅ [INIT] Trial grants schema ensured");
      })();

      // Race the schema migration promise against a 6-second boot timeout.
      // The timeout only unblocks the boot path — schemaMigPromise keeps running
      // so the background grandfather task can await its natural completion.
      await Promise.race([schemaMigPromise, migTimeout(6000)]);

      console.log("✅ [INIT] Column migrations complete");
    } catch (migErr) {
      console.warn(
        "⚠️ [INIT] Column migration skipped (timeout or error):",
        (migErr as Error).message,
      );
    }

    // Run data migrations (grandfather + cert-bridge) in the background.
    // Awaiting schemaMigPromise first guarantees required columns exist before
    // we attempt the UPDATE/INSERT, even when boot timed out early.
    // On a live prod DB, columns already exist so schema errors are treated as
    // non-blocking (the .catch(() => {}) swallows them before proceeding).
    setImmediate(() => {
      schemaMigPromise
        .catch(() => {}) // schema error already logged above; columns exist on live DB
        .then(() => runGrandfatherMigrations())
        .catch((err: Error) => {
          console.warn("⚠️ [INIT] Background grandfather migration failed:", err?.message);
        });
    });

    // Import middleware
    console.log("📋 [INIT] Loading middleware...");
    const { requestId } = await import("./middleware/requestId");
    const { logger } = await import("./middleware/logger");
    const { createApiRateLimit } = await import("./middleware/rateLimit");
    const { errorHandler } = await import("./middleware/errorHandler");
    const { resolveCuisineMiddleware } = await import(
      "./middleware/resolveCuisineMiddleware"
    );

    // CORS — registered first so OPTIONS preflights are answered before
    // requestId, logger, auth, or rate-limiting can interfere.
    app.use((req, res, next) => {
      const origin = req.headers.origin;

      // Normalize: Android WebView sometimes appends a trailing slash
      const normalizedOrigin = origin?.replace(/\/$/, "");

      const allowed =
        !normalizedOrigin ||
        normalizedOrigin.endsWith(".replit.app") ||
        normalizedOrigin.endsWith(".replit.dev") ||
        normalizedOrigin.endsWith(".repl.co") ||
        normalizedOrigin.endsWith(".vercel.app") ||
        normalizedOrigin === "https://myperfectmeals.com" ||
        normalizedOrigin === "https://www.myperfectmeals.com" ||
        normalizedOrigin === "https://app.myperfectmeals.com" ||
        normalizedOrigin === "https://myperfectmeals.ai" ||
        normalizedOrigin === "https://www.myperfectmeals.ai" ||
        normalizedOrigin === "https://app.myperfectmeals.ai" ||
        // Capacitor / Ionic native origins
        normalizedOrigin === "https://localhost" || // Android Capacitor
        normalizedOrigin === "http://localhost" || // Android fallback
        normalizedOrigin === "capacitor://localhost" || // iOS Capacitor
        normalizedOrigin === "ionic://localhost"; // Ionic WebView

      if (allowed) {
        res.header("Access-Control-Allow-Origin", normalizedOrigin ?? "*");
        res.header("Access-Control-Allow-Credentials", "true");
      }

      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, x-user-id, x-device-id, x-auth-token",
      );

      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      next();
    });

    // Request ID + logging run after CORS so preflights don't create noise
    app.use(requestId);
    app.use(logger);

    // CRITICAL: Stripe webhook MUST be registered before express.json() so the
    // raw Buffer body is preserved for signature verification. express.json()
    // would parse it into an object, making constructEvent() throw a 400.
    const stripeWebhookRouter = (await import("./routes/stripeWebhook")).default;
    app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRouter);

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: false }));

    // PostgreSQL-backed session store (production-ready, no MemoryStore)
    // Guarded: if DATABASE_URL is missing, fall back to MemoryStore with warning
    const sessionConfig: any = {
      secret: process.env.SESSION_SECRET || "mpm-session-secret-dev-only",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "none" as const,
      },
    };

    if (process.env.DATABASE_URL) {
      try {
        const PgSession = connectPgSimple(session);
        const sessionPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          ssl: process.env.DATABASE_URL.includes("sslmode=require")
            ? { rejectUnauthorized: false }
            : undefined,
        });
        sessionConfig.store = new PgSession({
          pool: sessionPool,
          tableName: "session",
          createTableIfMissing: true,
          pruneSessionInterval: 60 * 15,
        });
        console.log("✅ [INIT] PostgreSQL session store configured");
      } catch (pgSessionErr) {
        console.warn(
          "⚠️ [INIT] Failed to create PG session store, using default:",
          pgSessionErr,
        );
      }
    } else {
      console.warn(
        "⚠️ [INIT] DATABASE_URL not set, sessions will use default MemoryStore",
      );
    }

    app.use(session(sessionConfig));

    // Cache control for macros
    app.use((req, res, next) => {
      if (req.path.includes("/macros")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });

    const apiRateLimit = createApiRateLimit();
    app.use("/api", apiRateLimit);

    // Import and mount routers
    console.log("📋 [INIT] Loading routes...");
    const dessertCreatorRouter = (await import("./routes/dessert-creator"))
      .default;
    const beverageCreatorRouter = (await import("./routes/beverage-creator"))
      .default;
    const restaurantRoutes = (await import("./routes/restaurants")).default;
    const manualMacrosRouter = (await import("./routes/manualMacros")).default;
    const clinicalLabsRouter = (await import("./routes/clinicalLabs")).default;
    const { requireClinicalLabsAccess } = await import("./middleware/requireClinicalLabsAccess");
    const translateRouter = (await import("./routes/translate")).default;
    const mealsRouter = (await import("./routes/meals")).default;
    const macroCalculatorRouter = (await import("./routes/macroCalculatorRoutes")).default;
    const { requireAuth } = await import("./middleware/requireAuth");
    const { requireActiveAccess } = await import(
      "./middleware/requireActiveAccess"
    );

    app.use("/api/meals/dessert-creator", dessertCreatorRouter);
    app.use("/api/meals/beverage-creator", beverageCreatorRouter);
    app.use("/api/meals", mealsRouter);
    app.use("/api/restaurants", requireAuth, resolveCuisineMiddleware, restaurantRoutes);
    app.use("/api", manualMacrosRouter);
    app.use("/api", macroCalculatorRouter);
    app.use("/api/biometrics/labs", requireAuth, requireClinicalLabsAccess, clinicalLabsRouter);

    // Daily Nutrition Prescription — shared resolver for all builders
    const prescriptionRoutes = (await import("./routes/prescriptionRoutes")).default;
    app.use("/api/prescription", prescriptionRoutes);

    // Daily Nutrition State — canonical per-date state (prescription + consumed + planned + remaining)
    const nutritionStateRoutes = (await import("./routes/nutritionState")).default;
    app.use("/api/nutrition-state", nutritionStateRoutes);

    // Chef Budget — server-authoritative per-meal budget for Create-with-Chef
    const chefBudgetRoutes = (await import("./routes/chefBudget")).default;
    app.use("/api/meals/chef-budget", chefBudgetRoutes);

    // Bug Reports — authenticated in-app diagnostic submission
    const bugReportsRoutes = (await import("./routes/bugReports")).default;
    app.use("/api/bug-reports", bugReportsRoutes);
    app.use(
      "/api/translate",
      requireAuth,
      requireActiveAccess,
      translateRouter,
    );

    // Explicitly mount check-in-schedules BEFORE registerRoutes so the
    // DELETE /:id handler is always present even if registerRoutes changes.
    const checkInSchedulesRouter = (await import("./routes/checkInSchedules"))
      .default;
    app.use("/api/check-in-schedules", checkInSchedulesRouter);

    // Clinical Interventions — provider-set patient conditions that enter
    // the Protocol Envelope and change every generator's behavior.
    const clinicalInterventionsRouter = (await import("./routes/clinicalInterventions")).default;
    app.use("/api", clinicalInterventionsRouter);

    // Shopping list v2 — must be mounted explicitly in prod; registerRoutes()
    // mounts it in dev but prod.ts has its own route registration path.
    const { shoppingPreviewRouter, shoppingRouter } = await import("./routes/shoppingListV2");
    app.use("/api/shopping-list-v2", shoppingPreviewRouter);
    app.use("/api/shopping-list-v2", shoppingRouter);

    // Reminder System v2 — cross-platform meal reminders
    const remindersRouter = (await import("./routes/reminders")).default;
    app.use("/api/user/reminders", remindersRouter);

    // Kitchen routes — must be mounted before registerRoutes() and the /api 404 catch
    const kitchensRouter = (await import("./routes/kitchens")).default;
    const kitchenLibraryRouter = (await import("./routes/kitchenLibrary"))
      .default;
    const adminChefKitchensRouter = (await import("./routes/adminChefKitchens"))
      .default;
    const adminSignatureLibraryRouter = (
      await import("./routes/adminSignatureLibrary")
    ).default;
    const adminKitchenImportsRouter = (
      await import("./routes/adminKitchenImports")
    ).default;
    const { requireAdmin } = await import("./middleware/requireAdmin");

    app.use("/api/kitchens", requireAuth, kitchensRouter);
    app.use("/api/kitchens", requireAuth, kitchenLibraryRouter);
    app.use(
      "/api/admin/chef-kitchens",
      requireAuth,
      requireAdmin,
      adminChefKitchensRouter,
    );
    app.use(
      "/api/admin/chef-kitchens",
      requireAuth,
      requireAdmin,
      adminSignatureLibraryRouter,
    );
    app.use(
      "/api/admin/chef-kitchens",
      requireAuth,
      requireAdmin,
      adminKitchenImportsRouter,
    );

    console.log("✅ [INIT] Additional routes mounted");

    // ── Routes present in index.ts (dev) but not previously in prod.ts ──────
    // academy — Platform Mastery lesson progress, enrollment, quizzes, certificates
    const academyRouter = (await import("./routes/academyRoutes")).default;
    app.use("/api/academy", academyRouter);

    // coaching — notify-coach, activate-client, send-invite, client queue
    const coachingRouter = (await import("./routes/coaching")).default;
    app.use("/api/coaching", coachingRouter);

    // admin — user search, onboarding reset, subscription management, etc.
    const adminRouter = (await import("./routes/admin")).default;
    app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

    // product-codes — promo / redemption code apply
    const productCodesRouter = (await import("./routes/product-codes")).default;
    app.use("/api/product-codes", productCodesRouter);

    // sms — user SMS settings & consent
    const smsRoutes = (await import("./routes/sms")).default;
    app.use("/api/sms", smsRoutes);

    // ai-voice-journal — voice check-in, mood timeline, prefs
    const aiVoiceJournalRoutes = (await import("./routes/ai-voice-journal")).default;
    app.use("/api/ai-voice-journal", aiVoiceJournalRoutes);

    // business — Clinical Business multi-seat subscription management
    const businessRouter = (await import("./routes/businessRoutes")).default;
    app.use("/api/business", businessRouter);

    // partner — partner identity records (promo codes, commission terms, timeline)
    const partnerRouter = (await import("./routes/partnerRoutes")).default;
    app.use("/api/partner", partnerRouter);

    // promotions — Promotion Engine (trial extensions, discount codes, invite links)
    const promotionRouter = (await import("./routes/promotionRoutes")).default;
    app.use("/api/promotions", promotionRouter);

    // marketing-center — referral tools, monthly campaigns, messaging guidelines
    const marketingCenterRouter = (await import("./routes/marketingCenterRoutes")).default;
    app.use("/api/marketing-center", marketingCenterRouter);

    // procare-invite — token-based deep-link acceptance (public GET, authenticated POST)
    const procareInviteRouter = (await import("./routes/procareInviteRoutes")).default;
    app.use("/api/procare-invite", procareInviteRouter);

    // legal-pages — privacy policy, terms-of-service rendered pages
    const legalPagesRouter = (await import("./routes/legal-pages")).default;
    app.use(legalPagesRouter);

    // mealPlan — /api/meal-plan/current and related plan CRUD
    const mealPlanRouter = (await import("./routes/mealPlan")).default;
    app.use("/api/meal-plan", mealPlanRouter);
    app.use("/api/meal-plans", mealPlanRouter);

    // My Perfect Buffet — plate-building from user-described buffet foods
    const buffetRouter = (await import("./routes/buffet")).default;
    app.use("/api/buffet", requireAuth, buffetRouter);

    // My Perfect Getaway — venue-aware dining coach
    const getawayRouter = (await import("./routes/getaway")).default;
    app.use("/api/getaway", requireAuth, getawayRouter);

    // My Perfect Beginning — kid-friendly recipe generator + Parent's Corner AI
    // (routes/myPerfectBeginning.ts is the canonical file; routes/my-perfect-beginning.ts is the older stub)

    // My Perfect Pregnancy — trimester-aware nutrition coach
    const pregnancyCoachRouter = (await import("./routes/pregnancyCoach")).default;
    app.use("/api/pregnancy", requireAuth, pregnancyCoachRouter);

    // Performance Nutrition — sport-specific fueling protocol
    const performanceNutritionRouter = (await import("./routes/performanceNutrition")).default;
    app.use("/api/performance", requireAuth, performanceNutritionRouter);

    // Carb Response Engine — carb cycle state, log, and override
    const carbCycleRouter = (await import("./routes/carbCycle")).default;
    app.use("/api/performance", requireAuth, carbCycleRouter);

    // Nutrition Personalization Summary — read-only Protocol Envelope mirror
    const nutritionSummaryRouter = (await import("./routes/nutritionSummary")).default;
    app.use("/api/nutrition-summary", requireAuth, nutritionSummaryRouter);

    // Therapeutic Nutrition Intelligence — Sprint 4
    const therapeuticSetupRouter = (await import("./routes/therapeuticSetup")).default;
    const { requireStrictClinicalAccess } = await import("./middleware/requireClinicalAccess");
    app.use("/api/therapeutic", requireAuth, requireStrictClinicalAccess, therapeuticSetupRouter);

    // Adaptive Coaching Engine (ACE) — Sprint 1+2+3
    // Daily Check-In (aceCheckin) retired — replaced by Coach's Corner. Route moved to server/legacy/aceCheckin.ts.
    const aceProfilesRouter = (await import("./routes/aceProfiles")).default;
    const aceInterventionsRouter = (await import("./routes/aceInterventions")).default;
    const coachCornerRouter = (await import("./routes/coachCorner")).default;
    app.use("/api/ace/profile", aceProfilesRouter);
    app.use("/api/ace/interventions", aceInterventionsRouter);
    app.use("/api/coach-corner", coachCornerRouter);

    // My Perfect Beginning — CRUD + Parent's Corner (child profiles, saved meals)
    const myPerfectBeginningParentRouter = (await import("./routes/myPerfectBeginning")).default;
    app.use("/api/my-perfect-beginning", requireAuth, myPerfectBeginningParentRouter);
    // Generation routes (create-dish, resolve-context) — requires requireAuth already applied above
    const myPerfectBeginningGenerationRouter = (await import("./routes/my-perfect-beginning")).default;
    app.use("/api/my-perfect-beginning", myPerfectBeginningGenerationRouter);

    // Meal Sharing — POST /api/meals/share (auth) + GET /api/share/:token (public)
    const mealSharesRouter = (await import("./routes/mealSharesRouter")).default;
    app.use("/api/meals", mealSharesRouter);
    app.use("/api/share", mealSharesRouter);

    // Universal Meal Refinement — Stage 1: Weekly Meal Board replace_component
    const refinementRouter = (await import("./routes/refinement")).default;
    const trialRouter = (await import("./routes/trial")).default;
    const { requireActiveAccess: rafRefineAccess } = await import("./middleware/requireActiveAccess");
    app.use("/api/refinement", requireAuth, rafRefineAccess, refinementRouter);
    app.use("/api/trial", trialRouter);

    console.log("✅ [INIT] Parity routes mounted");

    // ── Org Config — PUBLIC endpoint, must be registered before requireAuth layers ──
    // Missing from prod.ts causes 404 in production; OrgContext.tsx calls this on boot.
    app.get("/api/org/config", async (req, res) => {
      try {
        const { loadOrgContext, loadOrgBySlug, getDefaultOrgContext } = await import("./lib/orgContext");
        const { db: orgDb } = await import("./db");
        const { users: usersTable } = await import("./db/schema") as any;
        const { eq: eqOrg, isNotNull, and: andBiz } = await import("drizzle-orm");

        if ((req as any).orgContext) {
          return res.json((req as any).orgContext);
        }

        const sessionUserId = (req as any).session?.userId;
        if (sessionUserId) {
          // 1. Check users.organizationId (white-label / clinical tenant)
          const [user] = await orgDb
            .select({ organizationId: usersTable.organizationId })
            .from(usersTable)
            .where(eqOrg(usersTable.id, sessionUserId))
            .limit(1);

          if (user?.organizationId) {
            const directOrg = await loadOrgContext(user.organizationId);
            if (!directOrg.featureFlags.partnerMarketplace) return res.json(directOrg);
          }

          // 2. Check active business memberships — false-wins policy
          try {
            const { businesses: bizTable, businessMembers: bizMembersTable } = await import("./db/schema/business");
            const memberships = await orgDb
              .select({ organizationId: bizTable.organizationId })
              .from(bizMembersTable)
              .innerJoin(bizTable, eqOrg(bizTable.id, bizMembersTable.businessId))
              .where(
                andBiz(
                  eqOrg(bizMembersTable.userId, sessionUserId),
                  eqOrg(bizMembersTable.status, "active"),
                  isNotNull(bizTable.organizationId)
                )
              );

            for (const m of memberships) {
              if (m.organizationId) {
                const bizOrg = await loadOrgContext(m.organizationId);
                if (!bizOrg.featureFlags.partnerMarketplace) return res.json(bizOrg);
              }
            }

            if (memberships.length > 0 && memberships[0].organizationId) {
              return res.json(await loadOrgContext(memberships[0].organizationId));
            }
          } catch (bizErr) {
            console.error("[org/config] Business membership lookup failed:", bizErr);
          }

          // 3. Fall back to users.organizationId org
          if (user?.organizationId) {
            return res.json(await loadOrgContext(user.organizationId));
          }
        }

        const slugHeader = req.headers["x-org-slug"] as string | undefined;
        if (slugHeader) {
          const org = await loadOrgBySlug(slugHeader);
          if (org) return res.json(org);
        }
        return res.json(getDefaultOrgContext());
      } catch (err) {
        console.error("[org/config] Error:", err);
        const { getDefaultOrgContext } = await import("./lib/orgContext");
        return res.json(getDefaultOrgContext());
      }
    });

    // ── Sandbox password reset — registered BEFORE registerRoutes() so it
    //    sits earlier in the Express stack than any app.use("/api", requireAuth)
    //    layer that registerRoutes() adds. Dynamic import catches any load errors.
    try {
      const { registerSandboxReset } = await import("./routes/sandboxReset");
      registerSandboxReset(app);
      console.log("✅ [INIT] Sandbox reset endpoint registered");
    } catch (sbErr) {
      console.error("⚠️ [INIT] Failed to register sandbox reset endpoint:", sbErr);
    }

    // Register main routes
    console.log("📋 [INIT] Registering main routes...");
    const { registerRoutes } = await import("./routes");
    await registerRoutes(app);
    console.log(
      `✅ [INIT] Main routes registered in ${Date.now() - startTime}ms`,
    );

    // API 404 handler
    app.use("/api", (req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });

    // Serve static files
    const clientDist = path.resolve(__dirname, "../client/dist");
    console.log("📁 [INIT] Serving static files from:", clientDist);

    app.use(
      express.static(clientDist, {
        setHeaders: (res, filePath) => {
          if (
            /\.(js|css)$/i.test(filePath) &&
            /[\.\-][a-f0-9]{8,}\./.test(filePath)
          ) {
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          } else if (/\.(png|jpg|jpeg|gif|svg|woff2?)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=86400");
          } else if (/index\.html$/i.test(filePath)) {
            res.setHeader(
              "Cache-Control",
              "no-cache, no-store, must-revalidate",
            );
          } else {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
          }
        },
      }),
    );

    // SPA fallback
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(clientDist, "index.html"));
    });

    // Error handler LAST
    app.use(errorHandler);

    // Mark as fully initialized
    isInitialized = true;
    console.log(
      `🎉 [INIT] Full initialization complete in ${Date.now() - startTime}ms`,
    );
    console.log(`✅ [INIT] Server fully ready at: ${new Date().toISOString()}`);

    // Background services - AFTER full initialization (non-blocking)
    setTimeout(async () => {
      try {
        console.log("📋 [BG] Starting background services...");
        const { initDailyReminderCron } = await import("./cron/dailyReminders");
        initDailyReminderCron();
        console.log("✅ [BG] Daily reminder cron started");

        // Reminder System v2 — per-minute scheduler
        const { startReminderScheduler } = await import("./services/reminderScheduler");
        startReminderScheduler();
      } catch (bgErr) {
        console.warn("⚠️ [BG] Background service warning:", bgErr);
      }
    }, 5000);

    // Warmup service — pings /api/health every 4 min to prevent cold starts
    setTimeout(async () => {
      try {
        const { warmupService } = await import("./services/warmupService");
        warmupService.start();
        console.log("✅ [BG] Warmup service started");
      } catch (bgErr) {
        console.warn("⚠️ [BG] Warmup service failed to start:", bgErr);
      }
    }, 7000);

    // ProCare invite token migration — adds url_token to care_invite + studio_invites
    setTimeout(async () => {
      try {
        const { runProCareInviteTokenMigration } = await import("./db/migrations/runProCareInviteTokenMigration");
        await runProCareInviteTokenMigration();
      } catch (err: any) {
        console.error("❌ [prod] ProCare invite token migration failed:", err.message);
      }
    }, 3300);

    // Business tables boot migration — idempotent
    setTimeout(async () => {
      try {
        const { db } = await import("./db");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS businesses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            owner_user_id text NOT NULL UNIQUE,
            stripe_customer_id text,
            stripe_subscription_id text,
            plan text NOT NULL DEFAULT 'clinical_business_monthly',
            seat_limit int NOT NULL DEFAULT 4,
            status text NOT NULL DEFAULT 'active',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS business_members (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id uuid NOT NULL,
            user_id text NOT NULL,
            role text NOT NULL DEFAULT 'staff',
            status text NOT NULL DEFAULT 'active',
            joined_at timestamptz DEFAULT now(),
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (business_id, user_id)
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS business_invitations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id uuid NOT NULL,
            email text NOT NULL,
            token text NOT NULL UNIQUE,
            role text NOT NULL DEFAULT 'staff',
            status text NOT NULL DEFAULT 'pending',
            invited_by_user_id text NOT NULL,
            expires_at timestamptz NOT NULL,
            accepted_at timestamptz,
            accepted_by_user_id text,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        // ── Phase 1 additive columns on businesses ────────────────────────
        await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS organization_id uuid`);
        await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS independent_client_policy text NOT NULL DEFAULT 'allowed_with_disclosure'`);
        // ── Business welcome-email idempotency guard ──────────────────────
        await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz`);
        // Stable provider idempotency key (UUID) for the business welcome email — set once, never cleared
        await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS welcome_email_key text`);
        // ── Phase 1 personal plan snapshot columns on users ───────────────
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_plan_lookup_key varchar(100)`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_entitlements text[] NOT NULL DEFAULT ARRAY[]::text[]`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_subscription_status text`);
        await db.execute(sql`ALTER TABLE business_members ADD COLUMN IF NOT EXISTS removed_at timestamptz`);
        await db.execute(sql`ALTER TABLE business_members ADD COLUMN IF NOT EXISTS notice_dismissed_at timestamptz`);
        // ── Phase 0 client ownership policy columns ───────────────────────
        await db.execute(sql`ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS policy_snapshot text`);
        await db.execute(sql`ALTER TABLE business_members ADD COLUMN IF NOT EXISTS policy_snapshot text`);
        await db.execute(sql`ALTER TABLE business_members ADD COLUMN IF NOT EXISTS policy_acknowledged_at timestamptz`);
        // ── One-active-seat-per-user constraint ───────────────────────────────
        // Prevents a user from holding active seats in two businesses simultaneously,
        // even under concurrent invite-accept requests that bypass the application-
        // level pre-check.  Only one row with status='active' per user_id is allowed.
        await db.execute(sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_business_members_one_active_per_user
          ON business_members(user_id)
          WHERE status = 'active'
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS business_policy_history (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id uuid NOT NULL,
            changed_by_user_id text NOT NULL,
            old_policy text,
            new_policy text NOT NULL,
            changed_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        // Partner Marketplace Isolation — ensure MPM Public org has partnerMarketplace: true
        await db.execute(sql`
          UPDATE organizations
          SET feature_flags = feature_flags || '{"partnerMarketplace": true}'::jsonb,
              updated_at    = now()
          WHERE slug = 'mpm-public'
            AND (feature_flags->>'partnerMarketplace')::boolean IS DISTINCT FROM true
        `);
        console.log("✅ [prod] Business tables boot migration complete");

        // Partner Center — marketing_campaigns and marketing_assets tables
        await db.execute(sql`ALTER TABLE partner_records ADD COLUMN IF NOT EXISTS branding_mode text NOT NULL DEFAULT 'standard'`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS marketing_campaigns (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title text NOT NULL,
            description text,
            month_key text NOT NULL UNIQUE,
            status text NOT NULL DEFAULT 'draft',
            audience_modes text[] NOT NULL DEFAULT '{}',
            published_at timestamptz,
            expires_at timestamptz,
            created_by text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS marketing_assets (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
            asset_type text NOT NULL DEFAULT 'other',
            label text,
            filename text NOT NULL,
            object_key text NOT NULL DEFAULT '',
            mime_type text,
            byte_size integer,
            caption_text text,
            display_order integer DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        console.log("✅ [prod] Partner Center boot migration complete (marketing_campaigns, marketing_assets)");
      } catch (err: any) {
        console.error("❌ [prod] Business tables boot migration failed:", err.message);
      }

      // Studio relationship integrity — deduplicate client_links and add unique pair constraint
      setTimeout(async () => {
        try {
          const { db: database } = await import("./db");
          const { sql } = await import("drizzle-orm");
          // Deduplicate: for each (client_user_id, pro_user_id) pair keep the active row
          // (if any) or the most recently created row, then delete the rest.
          await database.execute(sql`
            DELETE FROM client_links
            WHERE id NOT IN (
              SELECT DISTINCT ON (client_user_id, pro_user_id) id
              FROM client_links
              ORDER BY client_user_id, pro_user_id,
                (CASE WHEN active = true THEN 0 ELSE 1 END),
                created_at DESC
            )
          `);

          // Unique constraint: one relationship record per (client, pro) pair.
          await database.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_client_links_unique_pair
            ON client_links (client_user_id, pro_user_id)
          `);

          // Reconcile stale careTeamMember rows left active while their parent studio
          // membership is revoked — a pre-existing state from before the deactivation fix.
          await database.execute(sql`
            UPDATE care_team_member ctm
            SET status = 'revoked', updated_at = now()
            FROM studios s
            WHERE ctm.pro_user_id = s.owner_user_id
              AND ctm.status = 'active'
              AND EXISTS (
                SELECT 1 FROM studio_memberships sm
                WHERE sm.client_user_id = ctm.user_id
                  AND sm.studio_id = s.id
                  AND sm.status = 'revoked'
                  AND sm.is_archived = true
              )
              AND NOT EXISTS (
                SELECT 1 FROM studio_memberships sm
                WHERE sm.client_user_id = ctm.user_id
                  AND sm.studio_id = s.id
                  AND sm.status = 'active'
                  AND sm.is_archived = false
              )
          `);

          console.log("✅ [prod] client_links integrity migration complete (dedup + unique pair index + careTeamMember reconcile)");
        } catch (err: any) {
          console.error("❌ [prod] client_links integrity migration failed:", err.message);
        }
      }, 4500);

      // Parent's Corner — persist conversations per child profile
      setTimeout(async () => {
        try {
          const { db: database } = await import("./db");
          const { sql } = await import("drizzle-orm");
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS parents_corner_conversations (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id text NOT NULL,
              child_profile_id text NOT NULL,
              messages jsonb NOT NULL DEFAULT '[]',
              updated_at timestamptz NOT NULL DEFAULT now(),
              CONSTRAINT uniq_parents_corner_convo UNIQUE (user_id, child_profile_id)
            )
          `);
          await database.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_parents_corner_convos_user
            ON parents_corner_conversations (user_id)
          `);
          console.log("✅ [prod] Parent's Corner boot migration complete (parents_corner_conversations)");
        } catch (err: any) {
          console.error("❌ [prod] Parent's Corner boot migration failed:", err.message);
        }
      }, 5000);

      // child_profiles — My Perfect Beginning persistent child profiles
      setTimeout(async () => {
        try {
          const { db: database } = await import("./db");
          const { sql } = await import("drizzle-orm");
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS child_profiles (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id text NOT NULL,
              name text NOT NULL,
              date_of_birth text,
              age_stage text NOT NULL DEFAULT 'toddler',
              allergies jsonb NOT NULL DEFAULT '[]',
              dietary_preferences jsonb NOT NULL DEFAULT '[]',
              medical_conditions jsonb NOT NULL DEFAULT '[]',
              feeding_concerns jsonb NOT NULL DEFAULT '[]',
              sensory_issues jsonb NOT NULL DEFAULT '[]',
              dislikes jsonb NOT NULL DEFAULT '[]',
              cultural_preferences text,
              emoji text NOT NULL DEFAULT '👶',
              is_archived boolean NOT NULL DEFAULT false,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            )
          `);
          await database.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_child_profiles_user
            ON child_profiles (user_id)
            WHERE is_archived = false
          `);
          // Phase 2 — extended profile fields required by the Pediatric Resolver
          const phase2Columns = [
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS sex text`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS height_cm numeric`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS weight_kg numeric`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS growth_context text DEFAULT 'typical'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS birth_history jsonb DEFAULT '{}'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS feeding_development jsonb DEFAULT '{}'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS family_goals jsonb DEFAULT '[]'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS kitchen_equipment jsonb DEFAULT '[]'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS kitchen_budget text DEFAULT 'moderate'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS kitchen_time_minutes integer DEFAULT 30`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS kitchen_skill text DEFAULT 'intermediate'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS school_safe_required boolean DEFAULT false`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS pediatrician_oversight boolean DEFAULT false`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS medication_affects_appetite boolean DEFAULT false`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS g_tube boolean DEFAULT false`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS feeding_ability jsonb DEFAULT '{}'`,
            `ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS allergy_details jsonb DEFAULT '[]'`,
          ];
          for (const col of phase2Columns) {
            await database.execute(sql.raw(col));
          }
          console.log("✅ [prod] child_profiles boot migration complete (My Perfect Beginning)");
        } catch (err: any) {
          console.error("❌ [prod] child_profiles boot migration failed:", err.message);
        }
      }, 5600);

      // Media Assets — canonical media_assets table + saved_meals.media_asset_id FK
      setTimeout(async () => {
        try {
          const { runMediaAssetsMigration } = await import("./db/migrations/runMediaAssetsMigration");
          await runMediaAssetsMigration();
        } catch (err: any) {
          console.error("❌ [prod] Media Assets boot migration failed:", err.message);
        }
      }, 5400);

      // Meal image validation — validation columns on meal_image_cache
      setTimeout(async () => {
        try {
          const { runMealImageValidationMigration } = await import("./db/migrations/runMealImageValidationMigration");
          await runMealImageValidationMigration();
        } catch (err: any) {
          console.error("❌ [prod] Meal image validation boot migration failed:", err.message);
        }
      }, 5500);

      // Daily Nutrition State migration (#690)
      // Adds: daily_nutrition_prescriptions meal-plan snapshot cols + macro_logs.board_item_reference
      setTimeout(async () => {
        try {
          const { sql: migSql } = await import("drizzle-orm");
          const { db: database } = await import("./db");
          await database.execute(migSql`ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS meals_per_day integer`);
          await database.execute(migSql`ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS starch_meals_per_day integer`);
          await database.execute(migSql`ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS starch_distribution_strategy text`);
          await database.execute(migSql`ALTER TABLE macro_logs ADD COLUMN IF NOT EXISTS board_item_reference text`);
          await database.execute(migSql`
            CREATE UNIQUE INDEX IF NOT EXISTS macro_logs_board_item_ref_uniq
            ON macro_logs(board_item_reference)
            WHERE board_item_reference IS NOT NULL
          `);
          console.log("✅ [prod] Daily Nutrition State schema additions complete");
        } catch (err: any) {
          console.error("❌ [prod] Nutrition State migration failed:", err.message);
        }
      }, 6200);

      // Bug Reports migration — bug_reports table + status enum
      setTimeout(async () => {
        try {
          const { runBugReportsMigration } = await import("./db/migrations/runBugReportsMigration");
          await runBugReportsMigration();
        } catch (err: any) {
          console.error("❌ [prod] Bug Reports migration failed:", err.message);
        }
      }, 6800);

      // Promotion Engine — partner_promotions + promotion_redemptions tables
      setTimeout(async () => {
        try {
          const { db: database } = await import("./db");
          const { sql } = await import("drizzle-orm");
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS partner_promotions (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              owner_user_id text NOT NULL,
              name text NOT NULL,
              type text NOT NULL CHECK (type IN ('extended_trial', 'discount')),
              trial_days integer,
              discount_percent integer,
              discount_duration text,
              discount_months integer,
              max_uses integer,
              used_count integer NOT NULL DEFAULT 0,
              expires_at timestamptz,
              status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
              invite_token text UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
              stripe_coupon_id text,
              stripe_promo_code_id text,
              stripe_promo_code text,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            )
          `);
          await database.execute(sql`
            CREATE TABLE IF NOT EXISTS promotion_redemptions (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              promotion_id uuid NOT NULL REFERENCES partner_promotions(id),
              redeemed_by_user_id text NOT NULL,
              applied_trial_days integer,
              applied_stripe_promo_code text,
              redeemed_at timestamptz NOT NULL DEFAULT now(),
              CONSTRAINT uniq_promotion_redemption UNIQUE (promotion_id, redeemed_by_user_id)
            )
          `);
          await database.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_partner_promotions_owner ON partner_promotions (owner_user_id)
          `);
          await database.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_partner_promotions_token ON partner_promotions (invite_token)
          `);
          console.log("✅ [prod] Promotion Engine boot migration complete (partner_promotions, promotion_redemptions)");
        } catch (err: any) {
          console.error("❌ [prod] Promotion Engine boot migration failed:", err.message);
        }
      }, 5500);

      // ── meal_translations: table + orphan sweep + FK CASCADE (dynamic imports) ─
      setTimeout(async () => {
        try {
          const { db: dbMt } = await import("./db");
          const { sql: sqlMt } = await import("drizzle-orm");

          // 1. Create table
          await dbMt.execute(sqlMt`
            CREATE TABLE IF NOT EXISTS meal_translations (
              id              SERIAL PRIMARY KEY,
              saved_meal_id   UUID NOT NULL,
              locale          VARCHAR(10) NOT NULL,
              translated_name TEXT NOT NULL,
              translated_description TEXT,
              translated_ingredients  JSONB,
              translated_instructions JSONB,
              source_hash     VARCHAR(32) NOT NULL,
              created_at      TIMESTAMPTZ DEFAULT NOW(),
              UNIQUE(saved_meal_id, locale)
            )
          `);
          await dbMt.execute(sqlMt`
            CREATE INDEX IF NOT EXISTS idx_meal_translations_meal_locale
              ON meal_translations (saved_meal_id, locale)
          `);

          // 2. Purge orphaned rows before adding the FK (avoids constraint-violation on old data)
          await dbMt.execute(sqlMt`
            DELETE FROM meal_translations
            WHERE NOT EXISTS (
              SELECT 1 FROM saved_meals sm WHERE sm.id = meal_translations.saved_meal_id
            )
          `);

          // 3. Add FK ON DELETE CASCADE (idempotent)
          await dbMt.execute(sqlMt`
            DO $do$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_mt_saved_meal'
                  AND table_name      = 'meal_translations'
              ) THEN
                ALTER TABLE meal_translations
                  ADD CONSTRAINT fk_mt_saved_meal
                  FOREIGN KEY (saved_meal_id) REFERENCES saved_meals(id) ON DELETE CASCADE;
              END IF;
            END $do$
          `);

          console.log("✅ [prod] Meal Translations boot migration + FK complete");
        } catch (err: any) {
          console.error("❌ [prod] Meal Translations boot migration failed:", err.message);
        }
      }, 6000);

      // classification_source boot migration — expand CHECK constraint to include
      // 'conservative_fallback' and widen column to VARCHAR(25).
      // Idempotent: safe to run on every boot.
      setTimeout(async () => {
        try {
          const { db: dbCs } = await import("./db");
          const { sql: sqlCs } = await import("drizzle-orm");
          await dbCs.execute(sqlCs`
            ALTER TABLE macro_logs
              ADD COLUMN IF NOT EXISTS classification_source VARCHAR(25)
                NOT NULL DEFAULT 'unclassified'
          `);
          await dbCs.execute(sqlCs`
            ALTER TABLE macro_logs
              ALTER COLUMN classification_source TYPE VARCHAR(25)
          `);
          await dbCs.execute(sqlCs`
            ALTER TABLE macro_logs
              DROP CONSTRAINT IF EXISTS macro_logs_classification_source_check
          `);
          await dbCs.execute(sqlCs`
            ALTER TABLE macro_logs
              ADD CONSTRAINT macro_logs_classification_source_check
              CHECK (classification_source IN (
                'ingredient', 'user_input', 'unclassified', 'conservative_fallback'
              ))
          `);
          console.log("✅ [prod] classification_source boot migration complete (macro_logs)");
        } catch (err: any) {
          console.error("❌ [prod] classification_source boot migration failed:", err.message);
        }
      }, 7000);

      // ── Grocery Coach recommendation history (variety memory) ────────────────
      setTimeout(async () => {
        try {
          const { db: dbGcr } = await import("./db");
          const { sql: sqlGcr } = await import("drizzle-orm");
          await dbGcr.execute(sqlGcr`
            CREATE TABLE IF NOT EXISTS grocery_coach_recommendation_history (
              id              serial PRIMARY KEY,
              user_id         text        NOT NULL,
              meal_name       text        NOT NULL,
              primary_protein text,
              cuisine_style   text,
              major_starch    text,
              cooking_method  text,
              created_at      timestamptz NOT NULL DEFAULT now()
            )
          `);
          await dbGcr.execute(sqlGcr`
            CREATE INDEX IF NOT EXISTS idx_gcr_history_user_date
              ON grocery_coach_recommendation_history (user_id, created_at DESC)
          `);
          await dbGcr.execute(sqlGcr`
            ALTER TABLE grocery_coach_recommendation_history
              ADD COLUMN IF NOT EXISTS meal_type text
          `);
          // Task 903: tag rows with the dietary identity active at recommendation time
          // so that switching diets (e.g. vegan → omnivore) flushes the avoid-list.
          await dbGcr.execute(sqlGcr`
            ALTER TABLE grocery_coach_recommendation_history
              ADD COLUMN IF NOT EXISTS dietary_identity_tag text NOT NULL DEFAULT 'omnivore'
          `);
          console.log("✅ [prod] Grocery Coach recommendation history boot migration complete");
        } catch (err: any) {
          console.error("❌ [prod] Grocery Coach recommendation history migration failed:", err.message);
        }
      }, 7500);

      // ── Shared retry helper for coaching boot migrations ─────────────────────
      // A transient DB connection timeout on any coaching migration would leave
      // the engine in a partially-migrated state with no recovery path without
      // retries. withBootRetry wraps any async migration fn with up to
      // MAX_BOOT_ATTEMPTS attempts, 5 s apart, logging progress at each step.
      const MAX_BOOT_ATTEMPTS = 3;
      async function withBootRetry(label: string, fn: () => Promise<void>): Promise<void> {
        for (let attempt = 1; attempt <= MAX_BOOT_ATTEMPTS; attempt++) {
          try {
            await fn();
            return; // success — stop retrying
          } catch (err: any) {
            if (attempt < MAX_BOOT_ATTEMPTS) {
              console.warn(`⚠️  [prod] ${label} attempt ${attempt} failed: ${err.message} — retrying in 5 s`);
              await new Promise((r) => setTimeout(r, 5000));
            } else {
              console.error(`❌ [prod] ${label} failed after ${MAX_BOOT_ATTEMPTS} attempts:`, err.message);
            }
          }
        }
      }

      // ── Coaching Engine boot migration (9 tables) ─────────────────────────
      setTimeout(async () => {
        await withBootRetry("Coaching Engine boot migration", async () => {
          const { db: dbCe } = await import("./db");
          const { runCoachingEngineMigration } = await import("./db/migrations/runCoachingEngineMigration");
          await runCoachingEngineMigration(dbCe);
        });
      }, 8000);

      // ── Coach Knowledge Library seed (5 adult Corner patterns) ─────────────
      // Runs with retry: a transient DB connection timeout during cold start
      // should not permanently lose the patterns. Retries up to 3 times, 5 s
      // apart. The seed itself creates knowledge_patterns IF NOT EXISTS first,
      // so it is safe to run before the coaching engine migration completes.
      // Uses a hand-rolled loop (not withBootRetry) so the exhausted-alert path
      // can emit a structured log + Sentry event for team visibility.
      setTimeout(async () => {
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const { seedCoachKnowledgePatterns } = await import("./db/seeds/coachKnowledgePatterns");
            await seedCoachKnowledgePatterns();
            break; // success — stop retrying
          } catch (err: any) {
            if (attempt < MAX_ATTEMPTS) {
              console.warn(`⚠️  [prod] Coach Knowledge Library seed attempt ${attempt} failed: ${err.message} — retrying in 5 s`);
              await new Promise((r) => setTimeout(r, 5000));
            } else {
              console.error(`❌ [prod] Coach Knowledge Library seed failed after ${MAX_ATTEMPTS} attempts:`, err.message);
              // Always emit a structured log so the team can grep/alert on this key —
              // a silent, permanent seed failure means Chef's Corner degrades with no visibility.
              console.error("[ALERT] coach_knowledge_library_seed_exhausted", JSON.stringify({
                event: "coach_knowledge_library_seed_exhausted",
                attempts: MAX_ATTEMPTS,
                error: err.message,
                impact: "Chef's Corner coaching patterns missing — knowledge_patterns table may be empty",
                timestamp: new Date().toISOString(),
              }));
              // Also forward to Sentry when initialized (DSN configured in env).
              // captureException is a no-op when Sentry is not initialized, so the
              // structured log above is the unconditional fallback signal.
              try {
                const { captureException } = await import("./lib/sentry");
                captureException(err, {
                  context: "coach_knowledge_library_seed",
                  attempts: MAX_ATTEMPTS,
                  impact: "Chef's Corner coaching patterns missing — knowledge_patterns table may be empty",
                });
              } catch (_sentryErr) {
                // import or capture failed — structured log above is sufficient
              }
            }
          }
        }
      }, 9500);

      // ── Phase 3B: Platform Observability infrastructure ──────────────────────
      setTimeout(async () => {
        await withBootRetry("Phase 3B boot migration", async () => {
          const { db: dbP3b } = await import("./db");
          const { runPhase3BMigration } = await import("./db/migrations/runPhase3BMigration");
          await runPhase3BMigration(dbP3b);
        });
      }, 11000);

      // ── Coaching Engine Phase 5 (completion provenance + followup index) ─────
      setTimeout(async () => {
        await withBootRetry("Coaching Phase 5 boot migration", async () => {
          const { db: dbP5 } = await import("./db");
          const { runPhase5Migration } = await import("./db/migrations/runPhase5Migration");
          await runPhase5Migration(dbP5);
        });

      }, 12500);

      // ── Saved Groceries — boot migration ─────────────────────────────────────
      await withBootRetry("Saved Groceries boot migration", async () => {
        const { db: dbSg } = await import("./db");
        const { sql: sqlSg } = await import("drizzle-orm");
        await dbSg.execute(sqlSg`
          CREATE TABLE IF NOT EXISTS user_saved_grocery_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_name text NOT NULL,
            brand text,
            barcode text,
            product_key text NOT NULL,
            category text,
            source text NOT NULL DEFAULT 'manual',
            nutrition_json jsonb,
            product_meta jsonb,
            image_url text,
            saved_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uniq_saved_grocery_user_product_key UNIQUE (user_id, product_key)
          )
        `);
      });

      // Safety override correlation ID — add correlation_id to safety_override_audit_logs
      await withBootRetry("Safety override correlation ID migration", async () => {
        const { db: dbSoc } = await import("./db");
        const { runSafetyOverrideCorrelationMigration } = await import("./db/migrations/runSafetyOverrideCorrelationMigration");
        await runSafetyOverrideCorrelationMigration(dbSoc as any);
      });

      // ── Post-migration guard: verify correlation_id column is actually present ──
      // If the migration silently failed or was rolled back, fail loudly here rather
      // than letting logSafetyOverride produce a 500 at runtime.
      {
        const { db: dbGuard } = await import("./db");
        const { assertCorrelationIdColumn } = await import("./db/migrations/assertCorrelationIdColumn");
        await assertCorrelationIdColumn(dbGuard as any);
      }

      // ── Inline migrations for columns that the guard will assert ────────────
      // schemaMigPromise above is raced against a 6-second timeout and may
      // still be running in the background when we reach this point. Running
      // the five critical ALTERs here (fully awaited, with retries) guarantees
      // they are committed before assertColumnsExist fires, even when
      // schemaMigPromise is slow or has not yet reached these statements.
      // All statements are idempotent (IF NOT EXISTS).
      await withBootRetry("Critical column pre-flight migrations", async () => {
        const { db: dbPre } = await import("./db");
        const { sql: sqlPre } = await import("drizzle-orm");
        // Phase 2 ProCare Studio gate
        await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS procare_training_completed boolean NOT NULL DEFAULT false`);
        // Performance Hub macro resolver
        await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_mode_enabled boolean NOT NULL DEFAULT false`);
        // i18n routing
        await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'auto'`);
        // Clinical context screening gate
        await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_response text`);
        // Diabetic builder save flow
        await dbPre.execute(sqlPre`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS saved_from_diabetic_builder boolean NOT NULL DEFAULT false`);
        console.log("✅ [guard-pre] Critical column pre-flight migrations complete");
      });

      // ── Extended column guard: critical columns added by recent migrations ──
      // Any column listed here gates an important runtime flow. A descriptive
      // error thrown here surfaces migration failures immediately at boot
      // rather than as cryptic 500s or silent data loss at runtime.
      // NOTE: every column listed here MUST be migrated in the preflight block
      // above so this assertion never races with its own migration.
      {
        const { db: dbColGuard } = await import("./db");
        const { assertColumnsExist } = await import("./bootstrap/assertColumnsExist");
        await assertColumnsExist(dbColGuard, [
          {
            table: "safety_override_audit_logs",
            column: "correlation_id",
            hint: "Safety PIN overrides will fail at runtime (logSafetyOverride writes this column)",
          },
          {
            table: "users",
            column: "procare_training_completed",
            hint: "Phase 2 ProCare Studio gate — professionals without this column always fail the training check",
          },
          {
            table: "saved_meals",
            column: "saved_from_diabetic_builder",
            hint: "Diabetic builder save flow — meal saves will 500 if this column is absent",
          },
          {
            table: "users",
            column: "performance_mode_enabled",
            hint: "Performance Hub macro resolver — missing column causes incorrect macro targets for athletes",
          },
          {
            table: "users",
            column: "preferred_language",
            hint: "i18n routing — missing column falls back to English for all users silently",
          },
          {
            table: "users",
            column: "clinical_context_response",
            hint: "Clinical context screening gate — missing column bypasses medication/hormone screening",
          },
        ]);
      }

      // Universal Meal Refinement — original_meal_snapshot column (Stage 1)
      setTimeout(async () => {
        try {
          const { db: database } = await import("./db");
          const { sql: migSql } = await import("drizzle-orm");
          await database.execute(migSql`
            ALTER TABLE meal_board_items
              ADD COLUMN IF NOT EXISTS original_meal_snapshot jsonb
          `);
          console.log("✅ [prod] meal_board_items.original_meal_snapshot migration complete");
        } catch (err: any) {
          console.error("❌ [prod] meal_board_items.original_meal_snapshot migration failed:", err.message);
        }
      }, 12500);

      // ── Coach Follow-up Cron (every 10 min) ──────────────────────────────────
      setTimeout(async () => {
        try {
          const { initCoachFollowupCron } = await import("./cron/coachFollowupCron");
          initCoachFollowupCron();
        } catch (err: any) {
          console.error("❌ [prod] Coach followup cron init failed:", err.message);
        }
      }, 13000);

    }, 4000);
  } catch (error) {
    console.error("❌ [INIT] Initialization failed:", error);
    initError = error instanceof Error ? error : new Error(String(error));
    // Column guard failures are fatal: serving traffic with missing critical
    // columns causes silent data loss or 500s. Crash loudly so the deployment
    // fails visibly instead of silently degrading.
    if (initError.message.startsWith("🚨 STARTUP GUARD:")) {
      console.error("🚨 [INIT] Critical column(s) missing — halting process to prevent data loss.");
      process.exit(1);
    }
  }
}
