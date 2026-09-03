import "openai/shims/node";
import dotenv from "dotenv";
dotenv.config(); // Load .env file FIRST before anything else

import "./bootstrap-fetch"; // Ensure fetch is available
import "./bootstrap/envSetup"; // Shared environment setup (same as prod.ts)
import { logBootStatus } from "./bootstrap/envSetup";
import { initSentry, sentryErrorHandler } from "./lib/sentry";
initSentry(); // Must be called as early as possible
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import fs from "fs";
import session from "express-session";
import path from "path";

// Startup performance optimization
    const startTime = Date.now();

// ⬇️ Your existing helpers (keep these imports as-is)
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { requestId } from "./middleware/requestId";
import { logger } from "./middleware/logger";
import { createApiRateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/requireAuth";
import { requireActiveAccess } from "./middleware/requireActiveAccess";
import { requireProAccess } from "./middleware/requireProAccess";
import healthRouter from "./routes/health.routes";
import keepaliveRouter from "./routes/keepalive";
import legalPagesRouter from "./routes/legal-pages";
import { loadOrgContext, loadOrgBySlug, getDefaultOrgContext } from "./lib/orgContext";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { resolveMealImageStorageContext } from "./services/mealImageBucket";
import { registerMarketingPageRoutes } from "./marketingPages";

// ⬇️ New: AI/Meals API router (this file must exist: server/routes/meals.ts)
import mealsRouter from "./routes/meals";
import alcoholRouter from "./routes/alcohol";
import glycemicRouter from "./routes/glycemic";
import mealSummarizeRouter from "./routes/mealSummarize";
import shoppingListRouter from "./routes/shoppingList";
import { shoppingPreviewRouter, shoppingRouter } from "./routes/shoppingListV2";
import mealLogsRouter from "./routes/mealLogs";
import waterLogsRouter from "./routes/waterLogs";
import foodLogsRouter from "./routes/foodLogs";
import wmc2LogRouter from "./routes/wmc2Log";
import wmc2TelemetryRouter from "./routes/wmc2Telemetry";
import wmc2EnhancedRouter from "./routes/wmc2Enhanced";
import qaRouter from "./routes/qa";
import mealEngineRouter from "./routes/mealEngine.routes";
import weeklyPlanRoutes from "./routes/weeklyPlan.routes";
import macroCalculatorRoutes from "./routes/macroCalculatorRoutes";

import mealPlanRoutesV1 from "./routes/mealPlans.routes";
import mealScheduleRouter from "./routes/mealSchedule";
import notifyRouter from "./routes/notify";
import notifyAckRouter from "./routes/notifyAck";
import timePresetsRouter from "./routes/timePresets";
import quickTestRouter from "./routes/notify.quicktest";
import healthRouter2 from "./routes/health";
import notifyRegisterRouter from "./routes/notify.register";
import notifyTestRouter from "./routes/notify.test";
import quickTestEnhancedRouter from "./routes/notify.quicktest.enhanced";
import adherenceRouter from "./routes/adherence";
import notifyExtrasRouter from "./routes/notifyExtras";
import cookingTutorialsRouter from "./routes/cookingTutorials.routes";
import triviaRouter from "./routes/trivia";
import challengeRoutes from "./routes/challenges";
import mealPlanRouter from "./routes/mealPlan";

import fitlifeRouter from "./routes/fitlife";
import mybestlifeRouter from "./routes/mybestlife";
import { diabetesRouter } from "./routes/diabetes";
import { constraintsRouter } from "./routes/mealEngineConstraints";
import { generationRouter } from "./routes/generation";
import preferencesRouter from "./routes/preferences";
import onboardingProgressRouter from "./routes/onboardingProgress";
import { requireDeviceId } from "./middleware/deviceId";
import { resolveCuisineMiddleware } from "./middleware/resolveCuisineMiddleware";
import cravingCreatorRouter from "./routes/craving-creator";
import dessertCreatorRouter from "./routes/dessert-creator";
import beverageCreatorRouter from "./routes/beverage-creator";
import chefPairingsRouter from "./routes/chef-pairings";
import holidayFeastRouter from "./routes/holiday-feast";
import gatheringsRouter from "./routes/gatherings";
import breakfastRouter from "./routes/breakfast";
import lunchRouter from "./routes/lunch";
import dinnerRouter from "./routes/dinner";
import snacksRouter from "./routes/snacks";
import biometricsRouter from "./routes/biometricsRoutes";
import clinicalLabsRouter from "./routes/clinicalLabs";
import gamesRouter from "./routes/games";
import manualMacrosRouter from "./routes/manualMacros";
import { testimonialsRouter } from "./routes/testimonials";
import { USE_FACEBOOK } from "./config";
import { facebookRouter } from "./routes/facebook";
import restaurantRoutes from "./routes/restaurants.js";
import abTestingMealPlansRouter from "./routes/mealPlans";
import { templateRouter } from "./routes/mealTemplates";
import { userMealPrefsRouter } from "./routes/userMealPrefs";
import stripeRouter from "./routes/stripe";
import stripeCheckoutRouter from "./routes/stripeCheckout";
import coachingRouter from "./routes/coaching";
import productCodesRouter from "./routes/product-codes";
import stripeWebhookRouter from "./routes/stripeWebhook";
import builderPlansRouter from "./routes/builderPlans";

import iosVerifyRouter from "./routes/iosVerify";
import translateRouter from "./routes/translate";
import studioGeneratorRouter from "./routes/studioGenerator";
import checkInSchedulesRouter from "./routes/checkInSchedules";
import adminRouter from "./routes/admin";
import aceProfilesRouter from "./routes/aceProfiles";
import aceInterventionsRouter from "./routes/aceInterventions";
import coachCornerRouter from "./routes/coachCorner";
import myPerfectBeginningRouter from "./routes/myPerfectBeginning";
import myPerfectBeginningGenerationRouter from "./routes/my-perfect-beginning";
import pregnancyCoachRouter from "./routes/pregnancyCoach";

const app = express();

// ─── CORS — single authoritative block, registered first ─────────────────────
// Must run before every other middleware so OPTIONS preflights are answered
// before hitting auth, rate limiting, etc.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Build the allowed-origin list from env overrides + hard-coded entries.
  const envOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) ?? [];
  const replitOrigin = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null;

  const allowedOrigins = new Set([
    ...envOrigins,
    ...(process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : []),
    ...(replitOrigin ? [replitOrigin] : []),
    // Dev servers
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    // Production web domains
    "https://myperfectmeals.com",
    "https://www.myperfectmeals.com",
    "https://app.myperfectmeals.com",
    "https://myperfectmeals.ai",
    "https://www.myperfectmeals.ai",
    "https://app.myperfectmeals.ai",
    "https://my-perfect-meals-frontend-clean.vercel.app",
    // Capacitor / Ionic native origins
    "https://localhost",       // Android Capacitor
    "http://localhost",        // Android Capacitor (fallback)
    "capacitor://localhost",   // iOS Capacitor
    "ionic://localhost",       // Ionic WebView
  ]);

  // Normalize origin: strip any trailing slash Android WebView sometimes appends.
  const normalizedOrigin = origin?.replace(/\/$/, "");

  // Allow same-origin requests (no Origin header), explicitly listed origins,
  // and any Vercel preview deployments.
  const allowed =
    !normalizedOrigin ||
    allowedOrigins.has(normalizedOrigin) ||
    normalizedOrigin.endsWith('.vercel.app');

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', normalizedOrigin ?? '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-id, x-device-id, x-auth-token'
  );

  // Answer OPTIONS preflights immediately — nothing else should run for these.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
// ─────────────────────────────────────────────────────────────────────────────

// Trust proxy MUST be set before any middleware that uses req.ip
// Railway uses 1 proxy hop - trust exactly 1 in production, none in dev
const isProd = process.env.NODE_ENV === "production";
app.set('trust proxy', isProd ? 1 : false);

// Create rate limiter ONCE at app initialization (after trust proxy is set)
const apiRateLimit = createApiRateLimit();

// ── Sandbox password reset (one-time, token-gated, no auth required) ──
// Must be registered at module scope BEFORE registerRoutes() and all broad
// /api middleware so it is never intercepted by requireAuth layers.
import { registerSandboxReset } from "./routes/sandboxReset";
registerSandboxReset(app);

// Enhanced health check with OpenAI/S3 status (same fields as prod.ts)
import { getFallbackStats } from "./services/fallbackMealService";
app.get("/api/health", (_req, res) => {
  const fallbackStats = getFallbackStats();
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
    hasDatabase: !!process.env.DATABASE_URL,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    hasS3: !!(process.env.S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID),
    s3Bucket: process.env.S3_BUCKET_NAME || "NOT SET",
    trustProxy: app.get("trust proxy"),
    platform: process.env.RAILWAY_ENVIRONMENT ? "railway" : "replit",
    aiHealth: {
      fallbacksUsed: fallbackStats.totalFallbacksUsed,
      lastFallback: fallbackStats.lastFallbackTime,
      healthy: fallbackStats.aiHealthy
    },
    // Must be true before real users onboard. When false/unset every user gets
    // PAID_FULL regardless of plan — a complete paywall bypass.
    billingEnforced: process.env.BILLING_ENFORCED === "true",
  });
});

// ---------- Production Middleware ----------
app.use(requestId);
app.use(logger);

// Stripe webhook MUST come BEFORE express.json() to preserve raw body for signature verification
// IMPORTANT: Use specific path /api/stripe/webhook to avoid intercepting other /api/stripe/* routes
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRouter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

// ─── SECURITY: SESSION_SECRET must be set — never fall back to a default ──────
if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 FATAL: SESSION_SECRET is not set. Refusing to start in production with a default secret.');
    process.exit(1);
  } else {
    console.warn('⚠️  SESSION_SECRET not set — using insecure dev default. Set SESSION_SECRET before deploying.');
  }
}

// Session middleware for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'mpm-session-secret-dev-only',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  }
}));

// Disable caching on macros and studio endpoints to prevent stale 304s
app.use((req, res, next) => {
  if (req.path.includes("/macros") || req.path.includes("/studios")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Header validation for macros logging
app.use((req, _res, next) => {
  if (req.path === "/api/macros/log") {
    if (!req.get("x-device-id")) {
      console.warn("[WARN] No X-Device-Id on macros/log");
    }
    const contentType = req.get("content-type") || "";
    if (contentType.indexOf("application/json") === -1) {
      console.warn("[WARN] macros/log missing JSON content-type, got:", contentType);
    }
  }
  next();
});

app.use("/api", apiRateLimit);

// Device ID middleware for onboarding routes
app.use((req, res, next) => {
  // Only enforce device ID on onboarding routes
  if (req.path.startsWith("/api/onboarding")) {
    return requireDeviceId(req, res, next);
  }
  next();
});

// Simple request logger (safe, no fancy response-capture)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  let logged = false;
  const done = () => {
    if (logged) return;
    logged = true;
    const ms = Date.now() - start;
    log("http", `${req.method} ${req.originalUrl} - ${ms}ms`);
  };
  _res.on("finish", done);
  next();
});

// ---------- Static Files ----------
// Serve static files from client/public — the same directory Vite copies into
// client/dist/ at build time. This ensures dev and prod resolve images from
// the same canonical location. Root public/ is intentionally NOT served here;
// add new images to client/public/images/ so they reach production.
app.use(express.static(path.join(import.meta.dirname, "../client/public")));

// Public marketing routes get meaningful HTML before the client application
// mounts. The React app still takes over this same root for normal visitors.
registerMarketingPageRoutes(
  app,
  path.join(import.meta.dirname, "../client/index.html"),
);

// Object Storage route is now in routes.ts with proper 503 handling

// ---------- API Routes ----------
// Health checks and keep-alive first
app.use("/api", healthRouter);
app.use("/api", keepaliveRouter);

// ── Release identity — public, no auth, reads manifest baked at build time ───
// The acceptance gate and monitoring read this after every publish to confirm
// the correct git SHA, storage bucket, and environment are live.
app.get("/api/release", (req, res) => {
  try {
    const candidates = [
      path.join(import.meta.dirname, "../client/dist/release-manifest.json"),
      path.join(import.meta.dirname, "../client/public/release-manifest.json"),
    ];
    let manifest: Record<string, unknown> = {};
    for (const p of candidates) {
      if (fs.existsSync(p)) { manifest = JSON.parse(fs.readFileSync(p, "utf-8")); break; }
    }
    res.json({ ...manifest, apiOrigin: req.hostname, nodeVersion: process.version });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to read release manifest", detail: e.message });
  }
});

// ── Full infrastructure health — per-system status for acceptance gate ────────
// Returns 503 if any critical dependency is unhealthy. Used by monitoring too.
app.get("/api/health/full", async (req, res) => {
  const result: Record<string, string> = {};
  let httpStatus = 200;

  result.application = "healthy";

  // Database
  try {
    const { db: dbCheck } = await import("./db");
    const { sql: sqlCheck } = await import("drizzle-orm");
    await dbCheck.execute(sqlCheck`SELECT 1`);
    result.database = "healthy";
  } catch (e: any) {
    result.database = `unhealthy: ${e.message}`;
    httpStatus = 503;
  }

  // Object Storage — DEV probes its attached bucket; production must resolve
  // its explicitly configured canonical bucket before the probe can run.
  try {
    const storageContext = resolveMealImageStorageContext();
    result.storageBucketId = storageContext.bucketId;
    const { probeStorageCanary } = await import("./objectStorage");
    const probe = await probeStorageCanary(storageContext.bucketId);
    result.objectStorage = probe.ok ? "healthy" : `unhealthy: ${probe.error}`;
    if (!probe.ok) httpStatus = 503;
  } catch (e: any) {
    result.objectStorage = `unhealthy: ${e.message}`;
    result.storageBucketId = "(invalid configuration)";
    httpStatus = 503;
  }

  result.openai = process.env.OPENAI_API_KEY ? "configured" : "missing";
  if (!process.env.OPENAI_API_KEY) httpStatus = 503;
  result.auth = process.env.SESSION_SECRET ? "configured" : "missing";
  if (!process.env.SESSION_SECRET) httpStatus = 503;
  result.timestamp = new Date().toISOString();
  res.status(httpStatus).json(result);
});

// Stripe checkout route (after express.json())
app.use("/api/stripe", stripeCheckoutRouter);

// Coaching notifications
app.use("/api/coaching", coachingRouter);
app.use("/api/product-codes", productCodesRouter);

// Stripe checkout and billing (legacy routes)
app.use("/api/stripe", stripeRouter);

// iOS In-App Purchase verification
app.use("/api/ios", iosVerifyRouter);

// Food Logs System - Register BEFORE mealsRouter to prevent route conflict with /api/macros/log
app.use("/api", foodLogsRouter);

// Mount meals router at /api/meals (NOT /api — dynamic /:mealInstanceId routes would shadow other /api/* paths)
app.use("/api/meals", mealsRouter);
app.use("/api", alcoholRouter);
app.use("/api", glycemicRouter);
app.use("/api", shoppingListRouter);
app.use("/api", mealSummarizeRouter);
app.use("/api", mealLogsRouter);
app.use("/api", waterLogsRouter);
app.use("/api", wmc2LogRouter);
app.use("/api", wmc2TelemetryRouter);
app.use("/api", wmc2EnhancedRouter);
app.use("/admin", qaRouter);
app.use("/api", mealEngineRouter);
app.use("/api", weeklyPlanRoutes);
app.use("/api", macroCalculatorRoutes);

app.use("/api/meal-plan", mealPlanRoutesV1);
app.use("/api/meal-plans", mealPlanRoutesV1); // ✅ Add plural version for frontend compatibility
app.use(abTestingMealPlansRouter); // A/B testing for meal plans
app.use("/api", mealScheduleRouter);
app.use("/api", notifyRouter);
app.use("/api", notifyAckRouter);
app.use("/api", timePresetsRouter);
app.use("/api", quickTestRouter);
app.use("/api", healthRouter2);
app.use("/api", notifyRegisterRouter);
app.use("/api", notifyTestRouter);
app.use("/api", quickTestEnhancedRouter);
app.use("/api", adherenceRouter);
app.use("/api", notifyExtrasRouter);
app.use("/api", cookingTutorialsRouter);
app.use("/api/trivia", triviaRouter);
app.use("/api/challenges", challengeRoutes);
app.use("/api/fitlife", fitlifeRouter);

// My Best Life routes (rebranded from FitLife)
app.use("/api/my-best-life", mybestlifeRouter);

// Diabetes Support System
app.use("/api/diabetes", diabetesRouter);
app.use("/api/meal-engine", constraintsRouter);
app.use("/api/generation", generationRouter);

// Onboarding Progress System
app.use("/api", onboardingProgressRouter);

// User Preferences System
app.use("/api", preferencesRouter);

// User Meal Preferences System - Cafeteria goal and food preferences
app.use("/api/user-prefs/meals", userMealPrefsRouter);

// Builder Plans System - GLP-1, Diabetic, Smart Menu builders
app.use(builderPlansRouter);

// Avatar context routes
import avatarContextRoutes from "./routes/avatar-context";
app.use("/api/avatar", avatarContextRoutes);

// Meal Replacement System
app.use("/api/craving-creator", requireAuth, requireProAccess, cravingCreatorRouter);
app.use("/api/meals/dessert-creator", requireAuth, requireActiveAccess, dessertCreatorRouter);
app.use("/api/meals/beverage-creator", requireAuth, requireActiveAccess, beverageCreatorRouter);
app.use("/api/ai/chef-pairings", requireAuth, requireActiveAccess, chefPairingsRouter);
app.use("/api/holiday-feast", requireAuth, requireActiveAccess, holidayFeastRouter);
app.use("/api/gatherings", requireAuth, requireActiveAccess, gatheringsRouter);

// Studio Generation Facade (LibraryEngine + QueueEngine)
app.use("/api/studio", requireAuth, requireActiveAccess, studioGeneratorRouter);
app.use("/api/breakfast", breakfastRouter);
app.use("/api/lunch", lunchRouter);
app.use("/api/dinner", dinnerRouter);
app.use("/api/snacks", snacksRouter);

// Biometrics System - Privacy-first fitness device integration
app.use("/api/biometrics", biometricsRouter);
app.use("/api/biometrics/labs", clinicalLabsRouter);

// Manual Macros System - Quick add custom macro entries
app.use("/api", manualMacrosRouter);

// Meal Templates System - Library browsing for meal replacement
app.use("/api/meal-templates", templateRouter);

// Translation API - UI-level translation for meal content
app.use("/api/translate", requireAuth, requireActiveAccess, translateRouter);

// Game Leaderboards System
app.use("/api/games", gamesRouter);

// User Testimonials System
app.use("/api/testimonials", testimonialsRouter);

// Restaurant Guide System - with Google Places API cuisine enrichment
app.use("/api/restaurants", requireAuth, requireActiveAccess, resolveCuisineMiddleware, restaurantRoutes);
console.log("✅ Restaurant routes mounted at /api/restaurants");

// Shopping List V2 - Split into public preview and protected routes (imported at top)
app.use("/api/shopping-list-v2", shoppingPreviewRouter); // Preview endpoint (no auth)
app.use("/api/shopping-list-v2", shoppingRouter); // Protected endpoints (inherit auth from registerRoutes)

// DIRECT Holiday Feast route fix - BEFORE Vite middleware
app.post("/api/meals/holiday-feast", requireAuth, requireActiveAccess, async (req, res) => {
  console.log("🎯 WORKING Holiday Feast route HIT!");
  try {
    const {
      generateHolidayFeast,
      HolidayFeastCompletenessError,
    } = await import("./services/holidayFeastService");
    const {
      deriveProcedureRules,
      enforceBeforeGenerate,
      loadUserProtocolEnvelope,
    } = await import("./services/protocolEnvelope");

    // Map frontend fields to backend fields
    const occasion = req.body.holiday || req.body.occasion || "Christmas";
    const servings = req.body.numberOfGuests || req.body.servings || 6;
    const counts = req.body.courses || req.body.counts || { appetizers: 1, mainDishes: 1, sideDishes: 1, desserts: 1 };
    const actorId = (req as any).authUser?.id;
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const loadedEnvelope = await loadUserProtocolEnvelope(actorId);
    if (!loadedEnvelope) {
      return res.status(503).json({
        error: "PROTOCOL_ENVELOPE_UNAVAILABLE",
        message: "Your dietary and medical safety profile could not be loaded. No feast was generated.",
        retryable: true,
      });
    }
    const dietaryIdentity = [
      ...new Set([
        ...loadedEnvelope.dietaryIdentity,
        ...(Array.isArray(req.body.dietaryRestrictions) ? req.body.dietaryRestrictions : []),
      ]),
    ];
    const protocolEnvelope = {
      ...loadedEnvelope,
      dietaryIdentity,
      procedural: deriveProcedureRules(dietaryIdentity),
    };
    const protocolBlock = enforceBeforeGenerate(protocolEnvelope, {
      generatorName: "holiday_feast",
      actorId,
    }).combined;

    console.log("🔍 Mapped data:", { occasion, servings, counts });

    const result = await generateHolidayFeast({
      occasion,
      servings,
      counts,
      dietaryRestrictions: Array.isArray(req.body.dietaryRestrictions) ? req.body.dietaryRestrictions : [],
      cuisineType: req.body.cuisineType,
      budgetLevel: req.body.budgetLevel || "moderate",
      familyRecipe: req.body.familyRecipe,
      protocolEnvelope,
      protocolBlock,
    });

    res.json({
      holiday: occasion,
      servings: servings,
      feast: result.feast || [],
      recipes: result.recipes || [],
      colorTheme: result.colorTheme,
    });
  } catch (error: any) {
    console.error("❌ Holiday feast error:", error);
    if (error?.name === "HolidayFeastCompletenessError") {
      return res.status(422).json({
        error: error.code,
        message: error.message,
        expected: error.expected,
        actual: error.actual,
      });
    }
    res.status(500).json({ error: "Generation failed" });
  }
});

// STABLE v1 Kids Lunchbox Generator - BEFORE Vite middleware
app.post("/api/v1/kids-lunchbox/generate", async (req, res) => {
  res.type("application/json");
  try {
    const { kidsLunchboxV1Generate } = await import("./services/kidsLunchboxV1");
    const plan = await kidsLunchboxV1Generate(req.body);
    return res.status(200).json(plan);
  } catch (e: any) {
    console.error("❌ KidsLunchboxV1 failed:", e);
    return res.status(500).json({ error: "KidsLunchboxV1 failed", detail: e.message });
  }
});

// DIRECT Kids meals route fix - BEFORE Vite middleware - uses kidsLunchboxV1 for kid-friendly meals
app.post("/api/meals/kids", async (req, res) => {
  console.log("🧒 Kids meals route HIT!");
  try {
    const { preferences, userId, servings = 1, allergies = [] } = req.body;
    const startTime = Date.now();

    console.log("🧒 KIDS ROUTE: Generating kid-friendly meal for:", preferences);

    // Use stable kids lunchbox generator with proper kid-friendly catalog
    const { kidsLunchboxV1Generate } = await import("./services/kidsLunchboxV1");

    const result = await kidsLunchboxV1Generate({ allergies });
    
    if (!result.meal) {
      throw new Error("Failed to generate kids meal");
    }
    
    // Transform to canonical meal format with nutrition object
    const generatedMeal = {
      id: `kids-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: result.meal.name,
      description: result.meal.description,
      ingredients: result.meal.ingredients.map((ing: any) => ({
        name: ing.name,
        quantity: String(ing.amount),
        unit: ing.unit
      })),
      instructions: result.meal.instructions,
      nutrition: result.meal.nutrition,
      medicalBadges: [],
      imageUrl: result.meal.imageUrl || "/images/cravings/chicken-tenders.jpg",
      servingSize: servings > 1 ? `${servings} servings` : "1 serving",
      cookingTime: result.meal.prepTime
    };

    console.log("🧒 Kids meal generated:", generatedMeal.name);
    console.log("📊 Generation source: kids-catalog");

    // Record metrics for health endpoint (deterministic source)
    const { recordGeneration } = await import("./services/aiHealthMetrics");
    recordGeneration('/api/meals/kids', 'catalog', Date.now() - startTime);

    res.json({ meal: generatedMeal });
  } catch (error: any) {
    console.error("❌ Kids meal error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Facebook Integration (conditional, feature-flagged)
if (USE_FACEBOOK) {
  app.use("/api/facebook", facebookRouter);
}

// SMS routes
import smsRoutes from "./routes/sms";
app.use("/api/sms", smsRoutes);

// Check-in schedules + alert preferences
app.use("/api/check-in-schedules", checkInSchedulesRouter);

// Admin dashboard — requires both auth + admin role (server-enforced)
import { requireAdmin } from "./middleware/requireAdmin";
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);
import adminChefKitchensRouter from "./routes/adminChefKitchens";
app.use("/api/admin/chef-kitchens", requireAuth, requireAdmin, adminChefKitchensRouter);
import adminSignatureLibraryRouter from "./routes/adminSignatureLibrary";
app.use("/api/admin/chef-kitchens", requireAuth, requireAdmin, adminSignatureLibraryRouter);
import adminKitchenImportsRouter from "./routes/adminKitchenImports";
app.use("/api/admin/chef-kitchens", requireAuth, requireAdmin, adminKitchenImportsRouter);
import kitchensRouter from "./routes/kitchens";
app.use("/api/kitchens", requireAuth, kitchensRouter);
import kitchenLibraryRouter from "./routes/kitchenLibrary";
app.use("/api/kitchens", requireAuth, kitchenLibraryRouter);

// Initialize SMS worker (side-effect import)
import "./workers/smsWorker";

// Lazy load heavy imports to speed startup
let dailyReminderInitialized = false;

const initDailyRemindersLazy = async () => {
  if (!dailyReminderInitialized) {
    const { initDailyReminderCron } = await import("./cron/dailyReminders");
    initDailyReminderCron();
    dailyReminderInitialized = true;
  }
};

// Initialize after first request rather than at startup
setTimeout(initDailyRemindersLazy, 1000);

// Check-in alert cron (every 20 min)
let checkInAlertInitialized = false;
const initCheckInAlertLazy = async () => {
  if (!checkInAlertInitialized) {
    const { initCheckInAlertCron } = await import("./cron/checkInAlerts");
    initCheckInAlertCron();
    checkInAlertInitialized = true;
  }
};
setTimeout(initCheckInAlertLazy, 3000);

// Data retention cron (daily 2 AM — purge meal logs >365d, meal cache >90d)
let dataRetentionInitialized = false;
const initDataRetentionLazy = async () => {
  if (!dataRetentionInitialized) {
    const { initDataRetentionCron } = await import("./cron/dataRetention");
    initDataRetentionCron();
    dataRetentionInitialized = true;
  }
};
setTimeout(initDataRetentionLazy, 5000);

// Studio Video Messages — migration-gated retrying startup. A failed schema
// migration must never start a destructive worker against a missing table.
let studioVideoPurgeInitialized = false;
const initStudioVideoPurge = async (): Promise<void> => {
  if (studioVideoPurgeInitialized) return;
  try {
    const { runStudioVideoMessagesMigration } = await import("./db/migrations/runStudioVideoMessagesMigration");
    await runStudioVideoMessagesMigration();
    const { startStudioVideoPurgeWorker } = await import("./services/voiceJobWorker");
    startStudioVideoPurgeWorker();
    studioVideoPurgeInitialized = true;
  } catch (err: any) {
    console.error("❌ Studio Video purge initialization failed; retrying in 60 seconds:", err.message);
    setTimeout(initStudioVideoPurge, 60_000);
  }
};
setTimeout(initStudioVideoPurge, 10500);

// Trial expiry reminder cron (daily 9 AM — emails at 6, 5, 3, 1 days remaining)
let trialReminderInitialized = false;
const initTrialReminderLazy = async () => {
  if (!trialReminderInitialized) {
    const { initTrialReminderCron } = await import("./cron/trialReminders");
    initTrialReminderCron();
    trialReminderInitialized = true;
  }
};
setTimeout(initTrialReminderLazy, 7000);

// Import and start warmup service
import { warmupService } from "./services/warmupService";
import { reminderService } from "./reminderService";

// Start warmup service after server is ready
setTimeout(() => {
  warmupService.start();
}, 2000);

// Load existing reminders after database is stable
setTimeout(() => {
  reminderService.loadExistingReminders().catch(err => {
    console.error('Failed to load reminders on startup:', err);
  });
}, 3000);

// LMS boot migrations — idempotent CREATE/ALTER for LMS tables
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`ALTER TABLE certification_module_progress ADD COLUMN IF NOT EXISTS video_watched_pct integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS is_current_version boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS updates_pending integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS is_certification_track boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE companion_profiles ADD COLUMN IF NOT EXISTS pet_type text DEFAULT 'dog'`);
    // My Perfect Pregnancy — boot migrations
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pregnancy_stage text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pregnancy_due_date text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pregnancy_support_context jsonb`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pregnancy_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL UNIQUE,
        messages jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Performance Nutrition Protocol — boot migrations
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_context jsonb`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS competition_prep_context jsonb`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_protocol_track text`);
    // Carb Response Engine — boot migration
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS carb_cycle_state jsonb`);
    // Adaptive Performance Nutrition — Sprint 1
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_training_schedule jsonb`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_protocol_config jsonb`);
    // Therapeutic Nutrition Intelligence — Sprint 4
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS therapeutic_support_context jsonb`);
    // Alpha-gal Syndrome — clinical allergy protocol profile
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS alpha_gal_profile jsonb`);
    // DailyNutritionPrescription — persistent starch preferences
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_starch_meals_per_day integer`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS starch_distribution_strategy text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_mode_enabled boolean NOT NULL DEFAULT false`);
    // Business welcome-email idempotency guard
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz`);
    // Stable provider idempotency key (UUID) for the business welcome email — set once, never cleared
    await db.execute(sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS welcome_email_key text`);
    // Client Invitation Engine — extend business_invitations to support client type
    await db.execute(sql`ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS invitation_type text NOT NULL DEFAULT 'team_member'`);
    await db.execute(sql`ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS trial_days integer`);
    await db.execute(sql`ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS program_name text`);
    await db.execute(sql`ALTER TABLE business_invitations ADD COLUMN IF NOT EXISTS partner_record_id text`);
    // Trial Expiry Reminders — milestone tracking column
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminders_sent text[] DEFAULT '{}'`);
    // Clinical Context Screening — self-reported medication/hormone gate
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_response text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_categories jsonb`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_updated_at timestamptz`);
    // Professional Launchpad — Phase 2 ProCare training completion gate
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS procare_training_completed boolean NOT NULL DEFAULT false`);
    // Acquisition tracking — signup source captured from ?source= / ?ref= URL param
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source text`);
    // Organization relationship split — attribution (who brought them) vs care (who coaches them)
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS attribution_organization_id uuid`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS care_organization_id uuid`);
    // Language Preference — Phase 1 internationalization
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'auto'`);
    await db.execute(sql`
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
    await db.execute(sql`
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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cert_question_options (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id uuid NOT NULL,
        option_text text NOT NULL,
        is_correct boolean DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`
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
    await db.execute(sql`
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
    await db.execute(sql`
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
    // Saved Groceries — persistent grocery preference library
    await db.execute(sql`
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
    // Grandfather existing certified professionals — Phase 2 gate protection
    // Sets procare_training_completed=true for professionals who completed Phase 1
    // BEFORE Phase 2 training existed (cutoff: 2026-07-01).
    // Idempotent: only touches rows still at the default false.
    // The completed_at cutoff prevents this from auto-whitelisting future professionals
    // who complete Phase 1 after Phase 2 launches — they must complete Phase 2 themselves.
    const grandfatherResult = await db.execute(sql`
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
    console.log(`✅ Grandfather migration: ${grandfatheredCount} professional(s) grandfathered (procare_training_completed=true)`);
    // Cert-type bridge migration — Platform Mastery rename
    // Copies completed "platform" cert records to "platform_mastery" for users who
    // completed the Academy before the cert type was renamed. Idempotent: skips users
    // who already have a "platform_mastery" record. requirePhase1Cert accepts both types,
    // so this migration is additive only — no records are deleted or modified.
    const certBridgeResult = await db.execute(sql`
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
    console.log(`✅ Cert-type bridge: ${certBridgeCount} "platform" → "platform_mastery" record(s) created`);

    // Recover only verified professional accounts that predate automatic
    // Studio provisioning. The routine is idempotent and leaves unclear
    // historical provider roles untouched.
    const { backfillEligibleProviderStudios } = await import("./services/procareStudioReadiness");
    await backfillEligibleProviderStudios("development_boot");

    // Meal Shares — public shareable meal preview links
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_shares (
        share_token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        meal_name TEXT NOT NULL,
        meal_description TEXT,
        meal_image TEXT,
        calories INTEGER,
        protein NUMERIC(5,1),
        carbs NUMERIC(5,1),
        fat NUMERIC(5,1),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_shares_token_idx ON meal_shares(share_token)`);
    console.log('✅ meal_shares table ready');

    // Adaptive Coaching Engine (ACE) — Sprint 1+2
    const { runAceMigration } = await import('./services/ace/aceBootMigration');
    await runAceMigration();
    console.log('✅ ACE boot migration complete');

    // GLP-1 Daily Behavioral Tolerance — Phase 1 (corrected)
    //
    // glp1_profile: base row per user, matches migrations/0005_create_glp1_profile.sql exactly.
    // Canonical schema reference: id, user_id UNIQUE, guardrails JSONB, created_at, updated_at.
    // Tolerance is time-series data and must NOT be stored on glp1_profile.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS glp1_profile (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT UNIQUE NOT NULL,
        guardrails JSONB DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Drop the 12 tolerance columns that were incorrectly added to glp1_profile in Phase 1 boot.
    // Tolerance belongs in the dedicated dated-snapshot table below (glp1_daily_tolerance).
    // These DROPs are idempotent (IF EXISTS) and safe to run even if the columns never existed.
    for (const col of [
      'tolerance_date', 'nausea_level', 'has_vomiting', 'hydration_risk',
      'has_reflux', 'has_diarrhea', 'has_constipation', 'appetite_level',
      'should_escalate', 'escalation_reason', 'water_ml_logged', 'tolerance_rules_fired',
    ]) {
      await db.execute(sql`ALTER TABLE glp1_profile DROP COLUMN IF EXISTS ${sql.raw(col)}`);
    }

    // glp1_daily_tolerance: dated snapshot table — one row per user per day.
    // UNIQUE(user_id, tolerance_date) ensures re-resolving the same day upserts,
    // not duplicates. Mirrors migrations/0009_create_glp1_daily_tolerance.sql.
    await db.execute(sql`
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
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS glp1_daily_tolerance_user_date
        ON glp1_daily_tolerance(user_id, tolerance_date DESC)
    `);
    console.log('✅ GLP-1 daily tolerance boot migration complete (glp1_daily_tolerance)');

    // glp1_daily_checkins: structured hub self-assessment — one row per submission
    // (no unique constraint on date — supports multiple timestamped check-ins per day).
    // See server/db/schema/glp1Checkins.ts for the WHY this is a separate table.
    await db.execute(sql`
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
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS glp1_daily_checkins_user_date_idx
        ON glp1_daily_checkins(user_id, check_in_date, submitted_at DESC)
    `);
    console.log('✅ GLP-1 hub checkins boot migration complete (glp1_daily_checkins)');

    // Waitlist notify — email_sent_at column + orphan recovery
    // email_sent_at tracks confirmed sends separately from notified_at (claim lock).
    // On restart, rows with notified_at SET but email_sent_at NULL were claimed mid-send
    // and never confirmed — reset them so the next notify run picks them up cleanly.
    await db.execute(sql`
      ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS email_sent_at timestamptz
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS waitlist_recovery_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recovered_at timestamptz NOT NULL DEFAULT now(),
        row_count int NOT NULL,
        user_ids jsonb NOT NULL DEFAULT '[]'
      )
    `);
    await db.execute(sql`
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
    await db.execute(sql`
      ALTER TABLE waitlist_notify_run_logs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'started'
    `);
    await db.execute(sql`
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
    const orphanResult = await db.execute(sql`
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
      console.log(`♻️  Waitlist orphan recovery: reset notified_at for ${orphanCount} row(s) that were claimed but never confirmed sent (server restart mid-send). Audit row written to waitlist_recovery_events. They will be retried on next notify run.`);
    }

    // Partner Marketplace Isolation — ensure MPM Public org has partnerMarketplace: true
    // (idempotent; existing partner orgs that intentionally set false are unaffected
    //  because this only targets the slug "mpm-public")
    await db.execute(sql`
      UPDATE organizations
      SET feature_flags = feature_flags || '{"partnerMarketplace": true}'::jsonb,
          updated_at    = now()
      WHERE slug = 'mpm-public'
        AND (feature_flags->>'partnerMarketplace')::boolean IS DISTINCT FROM true
    `);

    console.log('✅ LMS + white label boot migrations complete');
  } catch (err: any) {
    console.error('❌ LMS boot migrations failed:', err.message);
    console.error('❌ GRANDFATHER MIGRATION MAY NOT HAVE COMPLETED — professionals who certified before Phase 2 may be incorrectly blocked if PHASE2_GATE_ENABLED is flipped on. Verify procare_training_completed rows before enabling the gate.');
  }
}, 2500);

// Promotion Engine boot migration — idempotent
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partner_promotions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id text NOT NULL,
        name text NOT NULL,
        type text NOT NULL CHECK (type IN ('extended_trial', 'discount')),
        trial_days integer,
        discount_percent integer,
        discount_duration text CHECK (discount_duration IN ('once', 'repeating', 'forever')),
        discount_months integer,
        invite_token text UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
        stripe_coupon_id text,
        stripe_promo_code_id text,
        stripe_promo_code text,
        max_uses integer,
        used_count integer NOT NULL DEFAULT 0,
        expires_at timestamptz,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promotion_redemptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        promotion_id uuid NOT NULL REFERENCES partner_promotions(id),
        redeemed_by_user_id text NOT NULL,
        redeemed_at timestamptz NOT NULL DEFAULT now(),
        applied_trial_days integer,
        applied_stripe_promo_code text,
        CONSTRAINT uniq_promo_redemption UNIQUE (promotion_id, redeemed_by_user_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_partner_promotions_owner ON partner_promotions (owner_user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_partner_promotions_token ON partner_promotions (invite_token)
    `);
    console.log('✅ Promotion Engine boot migration complete (partner_promotions, promotion_redemptions)');
  } catch (err: any) {
    console.error('❌ Promotion Engine boot migration failed:', err.message);
  }
}, 3200);

// ProCare invite token migration — adds url_token to care_invite + studio_invites
setTimeout(async () => {
  try {
    const { runProCareInviteTokenMigration } = await import("./db/migrations/runProCareInviteTokenMigration");
    await runProCareInviteTokenMigration();
  } catch (err: any) {
    console.error("❌ ProCare invite token migration failed:", err.message);
  }
}, 3300);

// Business tables boot migration — idempotent
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parents_corner_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        child_profile_id text NOT NULL,
        messages jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uniq_parents_corner_convo UNIQUE (user_id, child_profile_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_parents_corner_convos_user
      ON parents_corner_conversations (user_id)
    `);
    console.log('✅ Parent\'s Corner boot migration complete (parents_corner_conversations)');
  } catch (err: any) {
    console.error('❌ Parent\'s Corner boot migration failed:', err.message);
  }
}, 4000);

// Backfill: purge stale temp URLs from meal_image_cache
// Any non-S3 URL is expired or will expire — delete so next request regenerates clean
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parents_corner_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        child_profile_id text NOT NULL,
        messages jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uniq_parents_corner_convo UNIQUE (user_id, child_profile_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_parents_corner_convos_user
      ON parents_corner_conversations (user_id)
    `);
    console.log('✅ Parent\'s Corner boot migration complete (parents_corner_conversations)');
  } catch (err: any) {
    console.error('❌ Parent\'s Corner boot migration failed:', err.message);
  }
}, 4000);

// Backfill: purge stale temp URLs from meal_image_cache
// Any non-S3 URL is expired or will expire — delete so next request regenerates clean
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parents_corner_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        child_profile_id text NOT NULL,
        messages jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uniq_parents_corner_convo UNIQUE (user_id, child_profile_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_parents_corner_convos_user
      ON parents_corner_conversations (user_id)
    `);
    console.log('✅ Parent\'s Corner boot migration complete (parents_corner_conversations)');
  } catch (err: any) {
    console.error('❌ Parent\'s Corner boot migration failed:', err.message);
  }
}, 4000);

// Backfill: purge stale temp URLs from meal_image_cache
// Any non-S3 URL is expired or will expire — delete so next request regenerates clean
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parents_corner_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        child_profile_id text NOT NULL,
        messages jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uniq_parents_corner_convo UNIQUE (user_id, child_profile_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_parents_corner_convos_user
      ON parents_corner_conversations (user_id)
    `);
    console.log('✅ Parent\'s Corner boot migration complete (parents_corner_conversations)');
  } catch (err: any) {
    console.error('❌ Parent\'s Corner boot migration failed:', err.message);
  }
}, 4000);

// Backfill: purge stale temp URLs from meal_image_cache
// Any non-S3 URL is expired or will expire — delete so next request regenerates clean
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parents_corner_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        child_profile_id text NOT NULL,
        messages jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uniq_parents_corner_convo UNIQUE (user_id, child_profile_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_parents_corner_convos_user
      ON parents_corner_conversations (user_id)
    `);
    console.log('✅ Parent\'s Corner boot migration complete (parents_corner_conversations)');

    // Pregnancy Coach conversation persistence
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pregnancy_conversations (
        user_id text PRIMARY KEY,
        messages jsonb NOT NULL DEFAULT '[]',
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ Pregnancy Coach boot migration complete (pregnancy_conversations)');
  } catch (err: any) {
    console.error('❌ Parent\'s Corner / Pregnancy boot migration failed:', err.message);
  }
}, 4000);

// child_profiles boot migration — My Perfect Beginning persistent child profiles
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
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
    await db.execute(sql`
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
      await db.execute(sql.raw(col));
    }
    console.log('✅ child_profiles boot migration complete (My Perfect Beginning)');
  } catch (err: any) {
    console.error('❌ child_profiles boot migration failed:', err.message);
  }
}, 4600);

// Media Assets boot migration — canonical media_assets table + saved_meals.media_asset_id FK
setTimeout(async () => {
  try {
    const { runMediaAssetsMigration } = await import("./db/migrations/runMediaAssetsMigration");
    await runMediaAssetsMigration();
    const { resumePendingMealImageRecoveries } = await import("./services/mealImageRecovery");
    await resumePendingMealImageRecoveries();
  } catch (err: any) {
    console.error("❌ Media Assets boot migration failed:", err.message);
  }
}, 4800);

// Meal image validation boot migration — validation columns on meal_image_cache
setTimeout(async () => {
  try {
    const { runMealImageValidationMigration } = await import("./db/migrations/runMealImageValidationMigration");
    await runMealImageValidationMigration();
  } catch (err: any) {
    console.error("❌ Meal image validation boot migration failed:", err.message);
  }
}, 4900);

// Daily Nutrition State boot migration (#690)
// Adds: daily_nutrition_prescriptions meal-plan snapshot cols + macro_logs.board_item_reference
setTimeout(async () => {
  try {
    const { runNutritionStateMigration } = await import("./db/migrations/runNutritionStateMigration");
    await runNutritionStateMigration();
  } catch (err: any) {
    console.error("❌ Nutrition State boot migration failed:", err.message);
  }
}, 5200);

// Bug Reports boot migration — bug_reports table + status enum
setTimeout(async () => {
  try {
    const { runBugReportsMigration } = await import("./db/migrations/runBugReportsMigration");
    await runBugReportsMigration();
  } catch (err: any) {
    console.error("❌ Bug Reports boot migration failed:", err.message);
  }
}, 5600);

// Backfill: purge stale temp URLs from meal_image_cache
// Any non-S3 URL is expired or will expire — delete so next request regenerates clean
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { mealImageCache } = await import('./db/schema/mealImageCache');
    const { sql } = await import('drizzle-orm');

    const result = await db
      .delete(mealImageCache)
      .where(sql`${mealImageCache.imageUrl} NOT LIKE '%amazonaws.com%'`);

    const count = (result as any).rowCount ?? (result as any).count ?? '?';
    if (Number(count) > 0) {
      console.log(`🧹 Image cache backfill: deleted ${count} stale non-S3 rows from meal_image_cache — they will regenerate with permanent URLs on next request`);
    } else {
      console.log(`✅ Image cache backfill: no stale entries found — cache is clean`);
    }
  } catch (err: any) {
    console.error('❌ Image cache backfill failed:', err.message);
  }
}, 5000);

// Twilio webhooks for STOP/HELP/delivery status
app.post("/twilio/status", express.urlencoded({ extended: false }), async (req, res) => {
  // Message status updates: req.body.MessageSid, MessageStatus
  console.log("Twilio status webhook received");
  res.sendStatus(200);
});

app.post("/twilio/inbound", express.urlencoded({ extended: false }), async (req, res) => {
  const from = req.body.From; 
  const body = String(req.body.Body || "").trim().toUpperCase();
  console.log(`Inbound SMS received`);

  // Handle STOP/START/HELP
  if (body === "STOP" || body === "UNSTOP" || body === "START") {
    const { userSmsSettings } = await import("./db/schema/sms");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("./db");

    const consent = body !== "STOP";
    await db.update(userSmsSettings)
      .set({ consent })
      .where(eq(userSmsSettings.phoneE164, from));
    console.log(`SMS consent updated: ${consent}`);
  }
  res.sendStatus(200);
});

// Shopping History Routes removed - all shopping functionality removed

// AI Voice & Journaling routes
import aiVoiceJournalRoutes from "./routes/ai-voice-journal";
app.use("/api/ai-voice-journal", aiVoiceJournalRoutes);


// Health check endpoints - BEFORE other routes
app.get("/api/_ping", (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));
app.post("/api/_echo", (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
  });
});

// Missing API endpoints that frontend polls - STUB IMPLEMENTATIONS
app.get("/api/users/:id/badges", (req, res) => {
  res.json([]);  // Empty badges array
});

app.get("/api/users/:id/streak", (req, res) => {
  res.json({ current: 0, longest: 0 });  // Default streak data
});

// ---------- Frontend (Vite in dev; static in prod) ----------
const PORT = Number(process.env.PORT) || 5000;

async function start() {
  // Seed default organizations on every boot (idempotent)
  try {
    const { seedDefaultOrganizations } = await import("./lib/orgSeeder");
    await seedDefaultOrganizations();
  } catch (err) {
    console.error("[Startup] Org seeder failed (non-fatal):", err);
  }

  // ── Org Config (public — must be registered BEFORE requireAuth middleware) ──
  app.get("/api/org/config", async (req, res) => {
    try {
      if ((req as any).orgContext) {
        return res.json((req as any).orgContext);
      }
      const sessionUserId = (req as any).session?.userId;
      if (sessionUserId) {
        const { db: orgDb } = await import("./db");

        // 1. Check users.organizationId (white-label / clinical tenant)
        const [user] = await orgDb
          .select({ organizationId: users.organizationId })
          .from(users)
          .where(eq(users.id, sessionUserId))
          .limit(1);

        if (user?.organizationId) {
          const directOrg = await loadOrgContext(user.organizationId);
          // false-wins: if this org hides marketplace, short-circuit immediately
          if (!directOrg.featureFlags.partnerMarketplace) return res.json(directOrg);
          // partnerMarketplace: true — keep as candidate, still check business memberships
        }

        // 2. Check active business memberships — false-wins policy across all orgs
        try {
          const { businesses: bizTable, businessMembers: bizMembersTable } = await import("./db/schema/business");
          const { isNotNull, and: andBiz } = await import("drizzle-orm");
          const memberships = await orgDb
            .select({ organizationId: bizTable.organizationId })
            .from(bizMembersTable)
            .innerJoin(bizTable, eq(bizTable.id, bizMembersTable.businessId))
            .where(
              andBiz(
                eq(bizMembersTable.userId, sessionUserId),
                eq(bizMembersTable.status, "active"),
                isNotNull(bizTable.organizationId)
              )
            );

          // false-wins: if any active org hides marketplace, return it immediately
          for (const m of memberships) {
            if (m.organizationId) {
              const bizOrg = await loadOrgContext(m.organizationId);
              if (!bizOrg.featureFlags.partnerMarketplace) return res.json(bizOrg);
            }
          }

          // All business orgs allow marketplace — return first one if present
          if (memberships.length > 0 && memberships[0].organizationId) {
            return res.json(await loadOrgContext(memberships[0].organizationId));
          }
        } catch (bizErr) {
          console.error("[org/config] Business membership lookup failed:", bizErr);
        }

        // 3. Fall back to users.organizationId org (partnerMarketplace: true at this point)
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
      return res.json(getDefaultOrgContext());
    }
  });

  // Adaptive Coaching Engine (ACE) — Sprint 1+2+3 routes
  // Daily Check-In (aceCheckin) retired — replaced by Coach's Corner. Route moved to server/legacy/aceCheckin.ts.
  app.use("/api/ace/profile", aceProfilesRouter);
  app.use("/api/ace/interventions", aceInterventionsRouter);
  app.use("/api/coach-corner", coachCornerRouter);
  app.use("/api/pregnancy", requireAuth, pregnancyCoachRouter);
  app.use("/api/my-perfect-beginning", myPerfectBeginningRouter);
  // Generation routes (create-dish, resolve-context) live in my-perfect-beginning.ts.
  // Mounted after the CRUD router so child-profile and saved-meals routes in
  // myPerfectBeginning.ts take precedence for shared paths (/generated-meals etc.).
  app.use("/api/my-perfect-beginning", myPerfectBeginningGenerationRouter);

  // Daily nutrition prescription + state routes (must be before registerRoutes for /api/* order)
  const prescriptionRoutes = (await import("./routes/prescriptionRoutes")).default;
  app.use("/api/prescription", prescriptionRoutes);
  const nutritionStateRoutes = (await import("./routes/nutritionState")).default;
  app.use("/api/nutrition-state", nutritionStateRoutes);
  const chefBudgetRoutes = (await import("./routes/chefBudget")).default;
  app.use("/api/meals/chef-budget", chefBudgetRoutes);

  // Universal Meal Refinement — Stage 1: Weekly Meal Board replace_component
  const refinementRouter = (await import("./routes/refinement")).default;
  app.use("/api/refinement", requireAuth, requireActiveAccess, refinementRouter);

  // Ensure trial_source column + trial_grants table exist before routes accept
  // signup requests that write trial_source. Must run synchronously here, not in
  // a deferred setTimeout, or the column may not exist during early boot traffic.
  await withBootRetry("Trial grants migration", async () => {
    const { db: dbTg } = await import("./db");
    const { runTrialGrantsMigration } = await import("./db/migrations/runTrialGrantsMigration");
    await runTrialGrantsMigration(dbTg);
  });
  await withBootRetry("Pilot ProCare migration", async () => {
    const { db: dbPilot } = await import("./db");
    const { runPilotProcareMigration } = await import("./db/migrations/runPilotProcareMigration");
    await runPilotProcareMigration(dbPilot);
  });
  await withBootRetry("Pilot Program migration", async () => {
    const { db: dbPilotProgram } = await import("./db");
    const { runPilotProgramMigration } = await import("./db/migrations/runPilotProgramMigration");
    await runPilotProgramMigration(dbPilotProgram);
  });
  await withBootRetry("Stripe billing migration", async () => {
    const { db: dbStripeBilling } = await import("./db");
    const { runStripeBillingMigration } = await import("./db/migrations/runStripeBillingMigration");
    await runStripeBillingMigration(dbStripeBilling);
  });
  await withBootRetry("Hydration Hub migration", async () => {
    const { db: dbHydrationHub } = await import("./db");
    const { runHydrationHubMigration } = await import("./db/migrations/runHydrationHubMigration");
    await runHydrationHubMigration(dbHydrationHub);
  });

  await withBootRetry("Email identity review migration", async () => {
    const { db: dbEmailIdentity } = await import("./db");
    const { runEmailIdentityReviewMigration } = await import("./db/migrations/runEmailIdentityReviewMigration");
    await runEmailIdentityReviewMigration(dbEmailIdentity);
  });

  await withBootRetry("Safety override correlation ID migration", async () => {
    const { db: dbSoc } = await import("./db");
    const { runSafetyOverrideCorrelationMigration } = await import("./db/migrations/runSafetyOverrideCorrelationMigration");
    await runSafetyOverrideCorrelationMigration(dbSoc);
  });

  // ── Post-migration guard: verify correlation_id column is actually present ──
  // If the migration silently failed or was rolled back, fail loudly here rather
  // than letting logSafetyOverride produce a 500 at runtime.
  {
    const { db: dbGuard } = await import("./db");
    const { assertCorrelationIdColumn } = await import("./db/migrations/assertCorrelationIdColumn");
    await assertCorrelationIdColumn(dbGuard);
  }

  // ── Inline migrations for columns that the guard will assert ─────────────
  // These ALTER TABLE statements are also present in the deferred setTimeout
  // block below, but that block runs ~2.5 s after module evaluation — after
  // start() has already called assertColumnsExist. Running them here first
  // (inside start(), fully awaited) ensures the columns exist before the
  // guard fires, even on a fresh database. Each statement is idempotent.
  await withBootRetry("Critical column pre-flight migrations", async () => {
    const { db: dbPre } = await import("./db");
    const { sql: sqlPre } = await import("drizzle-orm");
    const { runStudioVoiceStorageMigration } = await import("./db/migrations/runStudioVoiceStorageMigration");
    // Phase 2 ProCare Studio gate
    await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS procare_training_completed boolean NOT NULL DEFAULT false`);
    // Performance Hub macro resolver
    await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_mode_enabled boolean NOT NULL DEFAULT false`);
    // i18n routing
    await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'auto'`);
    // Clinical context screening gate
    await dbPre.execute(sqlPre`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinical_context_response text`);
    // Diabetic builder save flow (dev path only — prod.ts has this in schemaMigPromise)
    await dbPre.execute(sqlPre`ALTER TABLE saved_meals ADD COLUMN IF NOT EXISTS saved_from_diabetic_builder boolean NOT NULL DEFAULT false`);
    // Safety override correlation ID — guard asserts this; this ALTER ensures
    // the column exists even if the dedicated migration ran before the table existed
    await dbPre.execute(sqlPre`ALTER TABLE safety_override_audit_logs ADD COLUMN IF NOT EXISTS correlation_id text`);
    // Clinical Labs Phase 5 — hormone + thyroid panel columns
    // Must mirror the same ALTERs in prod.ts so the guard fires consistently
    // on both boot paths. Each statement is idempotent (IF NOT EXISTS).
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS reverse_t3 numeric`);
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS estradiol numeric`);
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS progesterone numeric`);
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS shbg numeric`);
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS lh numeric`);
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS fsh numeric`);
    await dbPre.execute(sqlPre`ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS dhea_s numeric`);
    await runStudioVoiceStorageMigration();
    console.log("✅ [guard-pre] Critical column pre-flight migrations complete");
  });

  // ── Extended column guard: critical columns added by recent migrations ──────
  // Any column listed here gates an important runtime flow. If a migration
  // silently failed the startup guard throws a descriptive error so the problem
  // is visible immediately rather than surfacing as a cryptic 500 at runtime.
  // NOTE: every column listed here MUST be migrated inline above (not in a
  // deferred setTimeout) so this assertion never races with its own migration.
  {
    const { db: dbColGuard } = await import("./db");
    const { assertColumnsExist, CRITICAL_COLUMNS } = await import("./bootstrap/assertColumnsExist");
    await assertColumnsExist(dbColGuard, CRITICAL_COLUMNS);
  }

  // 🎯 CRITICAL: API routes FIRST to prevent Vite middleware interference
  await registerRoutes(app);

  // API guard: any /api/* that slipped past routers -> JSON 404 (prevents SPA override)
  app.use("/api", (req, res) => {
    console.log(`🚫 API 404: ${req.method} ${req.originalUrl}`);
    res.status(404).type("application/json").send(JSON.stringify({ error: "API endpoint not found" }));
  });
  const NODE_ENV = process.env.NODE_ENV || "development";

  const server = app.listen(PORT, "0.0.0.0", () => {
    const bootTime = Date.now() - startTime;
    console.log(`🚀 Server running on 0.0.0.0:${PORT} (startup: ${bootTime}ms)`);
  });

  // Dev-only: verify image upload pipeline from within server process context.
  // Runs 3 s after boot so the sidecar is fully ready. NOT an HTTP endpoint.
  // See server/services/storageStartupDiagnostic.ts — remove after storage is proven.
  if (process.env.NODE_ENV !== "production") {
    setTimeout(async () => {
      try {
        const { runStorageStartupDiagnostic } = await import("./services/storageStartupDiagnostic");
        await runStorageStartupDiagnostic();
      } catch (err: any) {
        console.error("[StorageDiagnostic] Failed to run:", err.message);
      }
    }, 3000);
  }

  // Legal pages — served as standalone HTML BEFORE Vite/SPA middleware so they are
  // never caught by the React router. Required by Apple App Store and app stores.
  app.use(legalPagesRouter);

  if (NODE_ENV === "development") {
    // Vite dev middleware for client with proper server instance
    await setupVite(app, server);
  } else {
    // Serve built client
    const clientDist = path.resolve(import.meta.dirname, "../client/dist");
    serveStatic(app);
  }

  // Sentry error handler must come BEFORE the custom error handler
  app.use(sentryErrorHandler() as any);

  // Error handler LAST
  app.use(errorHandler);
}

// Reminder System v2 — start the per-minute scheduler
import('./services/reminderScheduler').then(({ startReminderScheduler }) => {
  startReminderScheduler();
}).catch((err) => console.error('[index] Failed to start reminder scheduler:', err));

// MPB Generated Meals — DB persistence for child meal cards + images
setTimeout(async () => {
  try {
    const { pool } = await import('./db');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mpb_generated_meals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        child_profile_id TEXT,
        recipe_data JSONB NOT NULL,
        image_url TEXT,
        selected_option_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mpb_generated_meals_user
        ON mpb_generated_meals (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mpb_generated_meals_child
        ON mpb_generated_meals (child_profile_id, created_at DESC);
    `);
    console.log("✅ MPB Generated Meals boot migration complete");
  } catch (err: any) {
    console.error("❌ MPB Generated Meals boot migration failed:", err.message);
  }
}, 4500);

// ── meal_translations boot migration + FK cascade (dynamic imports — module-scope setTimeout) ─
setTimeout(async () => {
  try {
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');

    // 1. Create table
    await db.execute(sql`
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
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_meal_translations_meal_locale
        ON meal_translations (saved_meal_id, locale)
    `);

    // 2. Purge any orphaned rows before adding the FK (avoids constraint-violation on old data)
    await db.execute(sql`
      DELETE FROM meal_translations
      WHERE NOT EXISTS (
        SELECT 1 FROM saved_meals sm WHERE sm.id = meal_translations.saved_meal_id
      )
    `);

    // 3. Add FK ON DELETE CASCADE (idempotent)
    await db.execute(sql`
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

    console.log("✅ Meal Translations boot migration + FK complete");
  } catch (err: any) {
    console.error("❌ Meal Translations boot migration failed:", err.message);
  }
}, 5000);

// classification_source boot migration — expand CHECK constraint to include
// 'conservative_fallback' and widen column to VARCHAR(25).
// Idempotent: safe to run on every boot.
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    // Ensure column exists (new envs) and is wide enough for 'conservative_fallback' (21 chars)
    await db.execute(sql`
      ALTER TABLE macro_logs
        ADD COLUMN IF NOT EXISTS classification_source VARCHAR(25)
          NOT NULL DEFAULT 'unclassified'
    `);
    await db.execute(sql`
      ALTER TABLE macro_logs
        ALTER COLUMN classification_source TYPE VARCHAR(25)
    `);
    // Drop old 3-value constraint (if any), then re-add with the 4th value
    await db.execute(sql`
      ALTER TABLE macro_logs
        DROP CONSTRAINT IF EXISTS macro_logs_classification_source_check
    `);
    await db.execute(sql`
      ALTER TABLE macro_logs
        ADD CONSTRAINT macro_logs_classification_source_check
        CHECK (classification_source IN (
          'ingredient', 'user_input', 'unclassified', 'conservative_fallback'
        ))
    `);
    console.log("✅ classification_source boot migration complete (macro_logs)");
  } catch (err: any) {
    console.error("❌ classification_source boot migration failed:", err.message);
  }
}, 5500);

// ── Daily Nutrition State — schema additions ───────────────────────────────────
// Adds meal-plan config snapshot columns to daily_nutrition_prescriptions and
// board_item_reference to macro_logs. Idempotent: safe on every boot.
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    // Meal-plan config snapshot on prescriptions
    await db.execute(sql`ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS meals_per_day integer`);
    await db.execute(sql`ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS starch_meals_per_day integer`);
    await db.execute(sql`ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS starch_distribution_strategy text`);
    // Board reservation link on macro_logs
    await db.execute(sql`ALTER TABLE macro_logs ADD COLUMN IF NOT EXISTS board_item_reference text`);
    // Unique partial index: one macro_log per board_item_reference (NULLs excluded
    // so non-board logs remain unrestricted). Prevents double-logging board items.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS macro_logs_board_item_ref_uniq
      ON macro_logs(board_item_reference)
      WHERE board_item_reference IS NOT NULL
    `);
    console.log("✅ Daily Nutrition State schema additions complete");
  } catch (err: any) {
    console.error("❌ Daily Nutrition State schema additions failed:", err.message);
  }
}, 5800);

// ── Shared retry helper for coaching boot migrations ──────────────────────────
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
        console.warn(`⚠️  ${label} attempt ${attempt} failed: ${err.message} — retrying in 5 s`);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error(`❌ ${label} failed after ${MAX_BOOT_ATTEMPTS} attempts:`, err.message);
      }
    }
  }
}

// ── Coaching Engine boot migration (9 tables) ─────────────────────────────────
setTimeout(async () => {
  await withBootRetry("Coaching Engine boot migration", async () => {
    const { db } = await import("./db");
    const { runCoachingEngineMigration } = await import("./db/migrations/runCoachingEngineMigration");
    await runCoachingEngineMigration(db);
  });
}, 6000);

// ── Coach Knowledge Library seed (5 adult Corner patterns) ────────────────────
// Runs with retry: a transient DB connection timeout during cold start should
// not permanently lose the patterns. Retries up to 3 times, 5 s apart.
setTimeout(async () => {
  await withBootRetry("Coach Knowledge Library seed", async () => {
    const { seedCoachKnowledgePatterns } = await import("./db/seeds/coachKnowledgePatterns");
    await seedCoachKnowledgePatterns();
  });
}, 7500);

// ── Phase 3B: Platform Observability infrastructure ───────────────────────────
setTimeout(async () => {
  await withBootRetry("Phase 3B boot migration", async () => {
    const { db } = await import("./db");
    const { runPhase3BMigration } = await import("./db/migrations/runPhase3BMigration");
    await runPhase3BMigration(db);
  });
}, 8500);

// ── Coaching Engine Phase 5 migration (completion provenance + followup index) ─
setTimeout(async () => {
  await withBootRetry("Coaching Phase 5 boot migration", async () => {
    const { db } = await import("./db");
    const { runPhase5Migration } = await import("./db/migrations/runPhase5Migration");
    await runPhase5Migration(db);
  });

}, 9500);

// ── Coach Follow-up Cron (every 10 min) ─────────────────────────────────────
setTimeout(async () => {
  try {
    const { initCoachFollowupCron } = await import("./cron/coachFollowupCron");
    initCoachFollowupCron();
  } catch (err: any) {
    console.error("❌ Coach followup cron init failed:", err.message);
  }
}, 10000);

// Global process error handlers for stability
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue for stability
});

// ── Grocery Coach recommendation history (variety memory) ─────────────────────
// Non-critical — variety enforcement degrades gracefully if this migration fails.
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grocery_coach_recommendation_history (
        id          serial PRIMARY KEY,
        user_id     text        NOT NULL,
        meal_name   text        NOT NULL,
        primary_protein text,
        cuisine_style   text,
        major_starch    text,
        cooking_method  text,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_gcr_history_user_date
        ON grocery_coach_recommendation_history (user_id, created_at DESC)
    `);
    await db.execute(sql`
      ALTER TABLE grocery_coach_recommendation_history
        ADD COLUMN IF NOT EXISTS meal_type text
    `);
    // Task 903: tag rows with the dietary identity active at recommendation time
    // so that switching diets (e.g. vegan → omnivore) flushes the avoid-list.
    await db.execute(sql`
      ALTER TABLE grocery_coach_recommendation_history
        ADD COLUMN IF NOT EXISTS dietary_identity_tag text NOT NULL DEFAULT 'omnivore'
    `);
    console.log("✅ Grocery Coach recommendation history boot migration complete");
  } catch (err: any) {
    console.error("❌ Grocery Coach recommendation history migration failed:", err.message);
  }
}, 6500);

// Universal Meal Refinement — original_meal_snapshot column (Stage 1)
// Adds the snapshot column to meal_board_items so the restore path can
// recover the exact pre-swap state.  Idempotent: safe on every boot.
setTimeout(async () => {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      ALTER TABLE meal_board_items
        ADD COLUMN IF NOT EXISTS original_meal_snapshot jsonb
    `);
    console.log("✅ meal_board_items.original_meal_snapshot boot migration complete");
  } catch (err: any) {
    console.error("❌ meal_board_items.original_meal_snapshot migration failed:", err.message);
  }
}, 7000);

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  // Log but don't exit in development for better stability
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
