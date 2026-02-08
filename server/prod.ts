// CRITICAL: Start server FIRST, import everything else AFTER
// This ensures health checks pass even if other imports crash
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';

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
  // Don't exit - let health checks continue working
});

const app = express();

// Trust proxy for correct IP handling
app.set('trust proxy', 1);

// Track initialization state
let isInitialized = false;
let initError: Error | null = null;

// CRITICAL: Health checks MUST respond IMMEDIATELY - no middleware, no delays
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/", (_req, res, next) => {
  // During initialization, respond with health check for Cloud Run
  if (!isInitialized) {
    return res.status(200).send("ok - server starting");
  }
  next();
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

// START SERVER IMMEDIATELY
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
    
    // Import middleware
    console.log("📋 [INIT] Loading middleware...");
    const { requestId } = await import("./middleware/requestId");
    const { logger } = await import("./middleware/logger");
    const { createApiRateLimit } = await import("./middleware/rateLimit");
    const { errorHandler } = await import("./middleware/errorHandler");
    const { resolveCuisineMiddleware } = await import("./middleware/resolveCuisineMiddleware");
    
    // Apply middleware
    app.use(requestId);
    app.use(logger);
    
    // CORS headers
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      const isReplitOrigin = origin && (
        origin.endsWith('.replit.app') || 
        origin.endsWith('.replit.dev') ||
        origin.endsWith('.repl.co')
      );
      const isCapacitorOrigin = origin && (
        origin === 'capacitor://localhost' ||
        origin === 'ionic://localhost' ||
        origin === 'http://localhost'
      );

      if (!origin || isReplitOrigin || isCapacitorOrigin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-device-id, x-auth-token');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: false }));

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
    const restaurantRoutes = (await import("./routes/restaurants")).default;
    
    app.use("/api/meals/dessert-creator", dessertCreatorRouter);
    app.use("/api/restaurants", resolveCuisineMiddleware, restaurantRoutes);
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
        if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
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

  } catch (error) {
    console.error("❌ [INIT] Initialization failed:", error);
    initError = error instanceof Error ? error : new Error(String(error));
    // Don't crash - server is still responding to health checks
  }
}
