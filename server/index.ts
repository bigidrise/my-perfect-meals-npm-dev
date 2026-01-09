import dotenv from "dotenv";
dotenv.config(); // Load .env file FIRST before anything else

// Alias VITE_OPENAI_API_KEY to OPENAI_API_KEY if the latter isn't set
// (VITE_ prefix is for client-side Vite builds, server code uses OPENAI_API_KEY)
if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
  console.log("✅ Aliased VITE_OPENAI_API_KEY to OPENAI_API_KEY");
}

import "./bootstrap-fetch"; // Ensure fetch is available
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
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
import healthRouter from "./routes/health.routes";
import keepaliveRouter from "./routes/keepalive";

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
import holidayFeastRouter from "./routes/holiday-feast";
import breakfastRouter from "./routes/breakfast";
import lunchRouter from "./routes/lunch";
import dinnerRouter from "./routes/dinner";
import snacksRouter from "./routes/snacks";
import biometricsRouter from "./routes/biometricsRoutes";
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
import stripeWebhookRouter from "./routes/stripeWebhook";
import builderPlansRouter from "./routes/builderPlans";
import passwordResetRouter from "./routes/password-reset";
import iosVerifyRouter from "./routes/iosVerify";
import translateRouter from "./routes/translate";

const app = express();

// CORS middleware for production (Vercel frontend)
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://my-perfect-meals-frontend-clean.vercel.app',
    'http://localhost:5173', // for local dev
    'http://localhost:5000'  // for Replit dev
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Trust proxy MUST be set before any middleware that uses req.ip
// Railway uses 1 proxy hop - trust exactly 1 in production, none in dev
const isProd = process.env.NODE_ENV === "production";
app.set('trust proxy', isProd ? 1 : false);

// Create rate limiter ONCE at app initialization (after trust proxy is set)
const apiRateLimit = createApiRateLimit();

// Enhanced health check for Railway debugging
app.get("/api/health", (_req, res) => res.json({ 
  ok: true, 
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || "development",
  hasDatabase: !!process.env.DATABASE_URL,
  trustProxy: app.get("trust proxy"),
  platform: process.env.RAILWAY_ENVIRONMENT ? "railway" : "replit"
}));

// ---------- Production Middleware ----------
app.use(requestId);
app.use(logger);

// CORS headers for API access with credentials support
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Build allowed origins from multiple sources
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
  const allowedOrigins = [
    ...corsOrigins,
    process.env.APP_ORIGIN,
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    // Vercel production domain
    "https://myperfectmeals.com",
    "https://www.myperfectmeals.com",
    // Capacitor iOS/Android native app origins
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    // Allow Vercel preview deployments (format: *.vercel.app)
  ].filter(Boolean);

  // Also allow Vercel preview domains (ending with .vercel.app)
  const isVercelPreview = origin && origin.endsWith('.vercel.app');

  // Allow requests with no origin (same-origin), from allowed origins, or Vercel preview deployments
  if (!origin || allowedOrigins.includes(origin) || isVercelPreview) {
    res.header('Access-Control-Allow-Origin', origin || allowedOrigins[0] || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    // Log blocked origins in development for debugging
    if (process.env.NODE_ENV !== "production") {
      log("cors", `Blocked origin: ${origin}`);
    }
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-device-id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Stripe webhook MUST come BEFORE express.json() to preserve raw body for signature verification
// IMPORTANT: Use specific path /api/stripe/webhook to avoid intercepting other /api/stripe/* routes
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRouter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

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

// Disable caching on macros endpoints to prevent stale 304s
app.use((req, res, next) => {
  if (req.path.includes("/macros")) {
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
  const done = () => {
    const ms = Date.now() - start;
    log("http", `${req.method} ${req.originalUrl} - ${ms}ms`);
  };
  // ensure we log after response ends
  _res.on("finish", done);
  _res.on("close", done);
  next();
});

// ---------- Static Files ----------
// Serve static files from public directory BEFORE API routes
app.use(express.static(path.join(import.meta.dirname, "../public")));

// Object Storage route is now in routes.ts with proper 503 handling

// ---------- API Routes ----------
// Health checks and keep-alive first
app.use("/api", healthRouter);
app.use("/api", keepaliveRouter);

// Password reset routes (public, no auth required)
app.use(passwordResetRouter);

// Stripe checkout route (after express.json())
app.use("/api/stripe", stripeCheckoutRouter);

// Stripe checkout and billing (legacy routes)
app.use("/api/stripe", stripeRouter);

// iOS In-App Purchase verification
app.use("/api/ios", iosVerifyRouter);

// Food Logs System - Register BEFORE mealsRouter to prevent route conflict with /api/macros/log
app.use("/api", foodLogsRouter);

// Mount your AI endpoints under /api/*
app.use("/api", mealsRouter);
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
app.use("/api/craving-creator", cravingCreatorRouter);  
app.use("/api/meals/dessert-creator", dessertCreatorRouter);
app.use("/api/holiday-feast", holidayFeastRouter);
app.use("/api/breakfast", breakfastRouter);
app.use("/api/lunch", lunchRouter);
app.use("/api/dinner", dinnerRouter);
app.use("/api/snacks", snacksRouter);

// Biometrics System - Privacy-first fitness device integration
app.use("/api/biometrics", biometricsRouter);

// Manual Macros System - Quick add custom macro entries
app.use("/api", manualMacrosRouter);

// Meal Templates System - Library browsing for meal replacement
app.use("/api/meal-templates", templateRouter);

// Translation API - UI-level translation for meal content
app.use("/api/translate", translateRouter);

// Game Leaderboards System
app.use("/api/games", gamesRouter);

// User Testimonials System
app.use("/api/testimonials", testimonialsRouter);

// Restaurant Guide System - with Google Places API cuisine enrichment
app.use("/api/restaurants", resolveCuisineMiddleware, restaurantRoutes);
console.log("✅ Restaurant routes mounted at /api/restaurants");

// Shopping List V2 - Split into public preview and protected routes (imported at top)
app.use("/api/shopping-list-v2", shoppingPreviewRouter); // Preview endpoint (no auth)
app.use("/api/shopping-list-v2", shoppingRouter); // Protected endpoints (inherit auth from registerRoutes)

// DIRECT Holiday Feast route fix - BEFORE Vite middleware
app.post("/api/meals/holiday-feast", async (req, res) => {
  console.log("🎯 WORKING Holiday Feast route HIT! Body:", req.body);
  try {
    const { generateHolidayFeast } = await import("./services/holidayFeastService");

    // Map frontend fields to backend fields
    const occasion = req.body.holiday || req.body.occasion || "Christmas";
    const servings = req.body.numberOfGuests || req.body.servings || 6;
    const counts = req.body.courses || req.body.counts || { appetizers: 1, mainDishes: 1, sideDishes: 1, desserts: 1 };

    console.log("🔍 Mapped data:", { occasion, servings, counts });

    const result = await generateHolidayFeast({
      occasion,
      servings,
      counts,
      dietaryRestrictions: req.body.dietaryRestrictions || [],
      cuisineType: req.body.cuisineType,
      budgetLevel: req.body.budgetLevel || "moderate",
      familyRecipe: req.body.familyRecipe,
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
  console.log("🧒 Kids meals route HIT! Body:", req.body);
  try {
    const { preferences, userId, servings = 1, allergies = [] } = req.body;
    const startTime = Date.now();

    console.log("🧒 KIDS ROUTE: Generating kid-friendly meal for:", preferences);

    // Use stable kids lunchbox generator with proper kid-friendly catalog
    const { kidsLunchboxV1Generate } = await import("./services/kidsLunchboxV1");
    
    const result = await kidsLunchboxV1Generate({
      favorites: preferences || "",
      allergies: allergies
    });
    
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

// Twilio webhooks for STOP/HELP/delivery status
app.post("/twilio/status", express.urlencoded({ extended: false }), async (req, res) => {
  // Message status updates: req.body.MessageSid, MessageStatus
  console.log("Twilio status webhook:", req.body.MessageSid, req.body.MessageStatus);
  res.sendStatus(200);
});

app.post("/twilio/inbound", express.urlencoded({ extended: false }), async (req, res) => {
  const from = req.body.From; 
  const body = String(req.body.Body || "").trim().toUpperCase();
  console.log(`Inbound SMS from ${from}: ${body}`);

  // Handle STOP/START/HELP
  if (body === "STOP" || body === "UNSTOP" || body === "START") {
    const { userSmsSettings } = await import("./db/schema/sms");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("./db");

    const consent = body !== "STOP";
    await db.update(userSmsSettings)
      .set({ consent })
      .where(eq(userSmsSettings.phoneE164, from));
    console.log(`SMS consent updated for ${from}: ${consent}`);
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

  if (NODE_ENV === "development") {
    // Vite dev middleware for client with proper server instance
    await setupVite(app, server);
  } else {
    // Serve built client
    const clientDist = path.resolve(import.meta.dirname, "../client/dist");
    serveStatic(app);
  }

  // Error handler LAST
  app.use(errorHandler);
}

// Global process error handlers for stability
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue for stability
});

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