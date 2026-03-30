// CRITICAL: Start server FIRST, import everything else AFTER
// This ensures health checks pass even if other imports crash
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from 'url';
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 [BOOT] Production server starting...");
console.log(`🕐 [BOOT] Start time: ${new Date().toISOString()}`);
console.log(`📍 [BOOT] PORT env: ${process.env.PORT || '5000 (default)'}`);
console.log(`📍 [BOOT] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Crash prevention: log errors instead of dying silently
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
});

const app = express();
app.set("trust proxy", 1);


// Trust proxy for correct IP handling (Cloud Run uses 1 proxy hop)
app.set('trust proxy', 1);

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
  res.type("text/html").send("google-site-verification: google0c1c00ed46ab3246.html\n");
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
  console.log(`⏱️ [BOOT] Ready for health checks at: ${new Date().toISOString()}`);
  
  // Now initialize everything else in background
  initializeApp().catch(err => {
    console.error("❌ [INIT] Background initialization failed:", err);
    initError = err;
  });
});

server.on('error', (err) => {
  console.error('🚨 [BOOT] Server error:', err);
});

// Initialize application in background AFTER server is listening
async function initializeApp() {
  const startTime = Date.now();
  console.log("📋 [INIT] Starting background initialization...");
  
  try {
    // Import bootstrap modules
    console.log("📋 [INIT] Loading bootstrap modules...");
    await import("./bootstrap-fetch");
    await import("./bootstrap/envSetup");
    
    const { logBootStatus, validateCriticalEnv } = await import("./bootstrap/envSetup");
    logBootStatus('production');
    
    const envValidation = validateCriticalEnv();
    if (!envValidation.valid) {
      console.warn("⚠️ [INIT] Missing env vars:", envValidation.missing.join(', '));
    }
    
    // Safe column migrations (adds missing columns without altering types)
    console.log("📋 [INIT] Running safe column migrations...");
    try {
      const { db: database } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await database.execute(sql`ALTER TABLE macro_logs ADD COLUMN IF NOT EXISTS starchy_carbs numeric DEFAULT '0' NOT NULL`);
      await database.execute(sql`ALTER TABLE macro_logs ADD COLUMN IF NOT EXISTS fibrous_carbs numeric DEFAULT '0' NOT NULL`);
      console.log("✅ [INIT] Column migrations complete");
    } catch (migErr) {
      console.warn("⚠️ [INIT] Column migration warning:", migErr);
    }

    // Import middleware
    console.log("📋 [INIT] Loading middleware...");
    const { requestId } = await import("./middleware/requestId");
    const { logger } = await import("./middleware/logger");
    const { createApiRateLimit } = await import("./middleware/rateLimit");
    const { errorHandler } = await import("./middleware/errorHandler");
    const { resolveCuisineMiddleware } = await import("./middleware/resolveCuisineMiddleware");
    
    // CORS — registered first so OPTIONS preflights are answered before
    // requestId, logger, auth, or rate-limiting can interfere.
    app.use((req, res, next) => {
      const origin = req.headers.origin;

      // Normalize: Android WebView sometimes appends a trailing slash
      const normalizedOrigin = origin?.replace(/\/$/, "");

      const allowed =
        !normalizedOrigin ||
        normalizedOrigin.endsWith('.replit.app') ||
        normalizedOrigin.endsWith('.replit.dev') ||
        normalizedOrigin.endsWith('.repl.co') ||
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin === 'https://myperfectmeals.com' ||
        normalizedOrigin === 'https://www.myperfectmeals.com' ||
        normalizedOrigin === 'https://app.myperfectmeals.com' ||
        // Capacitor / Ionic native origins
        normalizedOrigin === 'https://localhost' ||   // Android Capacitor
        normalizedOrigin === 'http://localhost' ||    // Android fallback
        normalizedOrigin === 'capacitor://localhost' || // iOS Capacitor
        normalizedOrigin === 'ionic://localhost';     // Ionic WebView

      if (allowed) {
        res.header('Access-Control-Allow-Origin', normalizedOrigin ?? '*');
        res.header('Access-Control-Allow-Credentials', 'true');
      }

      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-device-id, x-auth-token');

      if (req.method === 'OPTIONS') {
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
      secret: process.env.SESSION_SECRET || 'mpm-session-secret-dev-only',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'none' as const,
      }
    };

    if (process.env.DATABASE_URL) {
      try {
        const PgSession = connectPgSimple(session);
        const sessionPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          ssl: process.env.DATABASE_URL.includes('sslmode=require') 
            ? { rejectUnauthorized: false } 
            : undefined,
        });
        sessionConfig.store = new PgSession({
          pool: sessionPool,
          tableName: 'session',
          createTableIfMissing: true,
          pruneSessionInterval: 60 * 15,
        });
        console.log("✅ [INIT] PostgreSQL session store configured");
      } catch (pgSessionErr) {
        console.warn("⚠️ [INIT] Failed to create PG session store, using default:", pgSessionErr);
      }
    } else {
      console.warn("⚠️ [INIT] DATABASE_URL not set, sessions will use default MemoryStore");
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
    const dessertCreatorRouter = (await import("./routes/dessert-creator")).default;
    const beverageCreatorRouter = (await import("./routes/beverage-creator")).default;
    const restaurantRoutes = (await import("./routes/restaurants")).default;
    const manualMacrosRouter = (await import("./routes/manualMacros")).default;
    const clinicalLabsRouter = (await import("./routes/clinicalLabs")).default;
    const translateRouter = (await import("./routes/translate")).default;
    const { requireAuth } = await import("./middleware/requireAuth");
    const { requireActiveAccess } = await import("./middleware/requireActiveAccess");
    
    app.use("/api/meals/dessert-creator", dessertCreatorRouter);
    app.use("/api/meals/beverage-creator", beverageCreatorRouter);
    app.use("/api/restaurants", resolveCuisineMiddleware, restaurantRoutes);
    app.use("/api", manualMacrosRouter);
    app.use("/api/biometrics/labs", clinicalLabsRouter);
    app.use("/api/translate", requireAuth, requireActiveAccess, translateRouter);
    console.log("✅ [INIT] Additional routes mounted");
    
    // Register main routes
    console.log("📋 [INIT] Registering main routes...");
    const { registerRoutes } = await import("./routes");
    await registerRoutes(app);
    console.log(`✅ [INIT] Main routes registered in ${Date.now() - startTime}ms`);

    // API 404 handler
    app.use("/api", (req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });

    // Serve static files
    const clientDist = path.resolve(__dirname, "../client/dist");
    console.log("📁 [INIT] Serving static files from:", clientDist);
    
    app.use(express.static(clientDist, {
      setHeaders: (res, filePath) => {
        if (/\.(js|css)$/i.test(filePath) && /[\.\-][a-f0-9]{8,}\./.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/\.(png|jpg|jpeg|gif|svg|woff2?)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=86400");
        } else if (/index\.html$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      }
    }));

    // SPA fallback
    app.get("*", (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(clientDist, "index.html"));
    });

    // Error handler LAST
    app.use(errorHandler);
    
    // Mark as fully initialized
    isInitialized = true;
    console.log(`🎉 [INIT] Full initialization complete in ${Date.now() - startTime}ms`);
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
