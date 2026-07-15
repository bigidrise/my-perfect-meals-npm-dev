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
  });
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

// Initialize application in background AFTER server is listening
async function initializeApp() {
  const startTime = Date.now();
  console.log("📋 [INIT] Starting background initialization...");

  try {
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

      await Promise.race([
        (async () => {
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
          // Professional Launchpad — Phase 2 ProCare training completion gate
          await database.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS procare_training_completed boolean NOT NULL DEFAULT false`);
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
          // Grandfather existing certified professionals — Phase 2 gate protection
          // Sets procare_training_completed=true for professionals who completed Phase 1
          // BEFORE Phase 2 training existed (cutoff: 2026-07-01).
          // Idempotent: only touches rows still at the default false.
          // The completed_at cutoff prevents this from auto-whitelisting future professionals
          // who complete Phase 1 after Phase 2 launches — they must complete Phase 2 themselves.
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
          // Adaptive Coaching Engine (ACE) — Sprint 1+2
          const { runAceMigration } = await import("./services/ace/aceBootMigration");
          await runAceMigration();
          console.log("✅ [INIT] ACE boot migration complete");

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
        })(),
        migTimeout(6000),
      ]);

      console.log("✅ [INIT] Column migrations complete");
    } catch (migErr) {
      console.warn(
        "⚠️ [INIT] Column migration skipped (timeout or error):",
        (migErr as Error).message,
      );
      console.warn(
        "⚠️ [INIT] GRANDFATHER MIGRATION MAY NOT HAVE COMPLETED — professionals who certified before Phase 2 may be incorrectly blocked if PHASE2_GATE_ENABLED is flipped on. Verify procare_training_completed rows before enabling the gate.",
      );
    }

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
    const sessionConfig: session.SessionOptions = {
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
    app.use("/api/restaurants", resolveCuisineMiddleware, restaurantRoutes);
    app.use("/api", manualMacrosRouter);
    app.use("/api", macroCalculatorRouter);
    app.use("/api/biometrics/labs", clinicalLabsRouter);
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

    // Shopping list v2 — must be mounted explicitly in prod; registerRoutes()
    // mounts it in dev but prod.ts has its own route registration path.
    const { shoppingPreviewRouter, shoppingRouter } = await import("./routes/shoppingListV2");
    app.use("/api/shopping-list-v2", shoppingPreviewRouter);
    app.use("/api/shopping-list-v2", shoppingRouter);

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

    // legal-pages — privacy policy, terms-of-service rendered pages
    const legalPagesRouter = (await import("./routes/legal-pages")).default;
    app.use(legalPagesRouter);

    // mealPlan — /api/meal-plan/current and related plan CRUD
    const mealPlanRouter = (await import("./routes/mealPlan")).default;
    app.use("/api/meal-plan", mealPlanRouter);
    app.use("/api/meal-plans", mealPlanRouter);

    // My Perfect Getaway — venue-aware dining coach
    const getawayRouter = (await import("./routes/getaway")).default;
    app.use("/api/getaway", requireAuth, getawayRouter);

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
    app.use("/api/therapeutic", requireAuth, therapeuticSetupRouter);

    // Adaptive Coaching Engine (ACE) — Sprint 1+2+3
    // Daily Check-In (aceCheckin) retired — replaced by Coach's Corner. Route moved to server/legacy/aceCheckin.ts.
    const aceProfilesRouter = (await import("./routes/aceProfiles")).default;
    const aceInterventionsRouter = (await import("./routes/aceInterventions")).default;
    const coachCornerRouter = (await import("./routes/coachCorner")).default;
    app.use("/api/ace/profile", aceProfilesRouter);
    app.use("/api/ace/interventions", aceInterventionsRouter);
    app.use("/api/coach-corner", coachCornerRouter);

    console.log("✅ [INIT] Parity routes mounted");

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
        // ── Phase 1 personal plan snapshot columns on users ───────────────
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_plan_lookup_key varchar(100)`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_entitlements text[] NOT NULL DEFAULT ARRAY[]::text[]`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_subscription_status text`);
        console.log("✅ [prod] Business tables boot migration complete");
      } catch (err: any) {
        console.error("❌ [prod] Business tables boot migration failed:", err.message);
      }
    }, 4000);
  } catch (error) {
    console.error("❌ [INIT] Initialization failed:", error);
    initError = error instanceof Error ? error : new Error(String(error));
  }
}
