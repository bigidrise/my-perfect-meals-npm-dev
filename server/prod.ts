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
        })(),
        migTimeout(6000),
      ]);

      console.log("✅ [INIT] Column migrations complete");
    } catch (migErr) {
      console.warn(
        "⚠️ [INIT] Column migration skipped (timeout or error):",
        (migErr as Error).message,
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

    // legal-pages — privacy policy, terms-of-service rendered pages
    const legalPagesRouter = (await import("./routes/legal-pages")).default;
    app.use(legalPagesRouter);

    // mealPlan — /api/meal-plan/current and related plan CRUD
    const mealPlanRouter = (await import("./routes/mealPlan")).default;
    app.use("/api/meal-plan", mealPlanRouter);
    app.use("/api/meal-plans", mealPlanRouter);

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
  } catch (error) {
    console.error("❌ [INIT] Initialization failed:", error);
    initError = error instanceof Error ? error : new Error(String(error));
  }
}
