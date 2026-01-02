import type { Express } from "express";
import { createServer, type Server } from "http";
import { familyRecipesRouter } from "./routes/familyRecipes";
import { uploadsRouter } from "./routes/uploads";
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { requireAuth, AuthenticatedRequest } from "./middleware/requireAuth";
import { insertUserSchema, insertMealPlanSchema, insertMealLogSchema, insertMealReminderSchema, insertUserGlycemicSettingsSchema, aiMealPlanArchive, barcodes, mealLogsEnhanced, mealLog, userMealPrefs, insertUserMealPrefsSchema, meals, users, mealPlans, shoppingListItems } from "@shared/schema";
import { db } from "./db";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { reminderService } from "./reminderService";
import { generateMealPlan } from "./ai-service";
import holidayFeastRouter from "./routes/holiday-feast";
import holidayFamilyRecipeRouter from "./routes/holiday-family-recipe";

import { generateCravingMeal, generateWeeklyMeals } from "./services/stableMealGenerator";
import { generateCravingMealWithProfile } from "./services/generators/cravingCreatorWrapped";
// Shopping list import removed - will be implemented per ChatGPT specifications
import avatarChatRouter from "./routes/avatarChat";
import conciergeRouter from "./routes/concierge";
import chefRouter from "./routes/chef";
import cookingChallengesRouter from "./routes/cookingChallenges.routes";
import cookingClassesRouter from "./routes/cookingClasses.routes";

import mealPlanArchiveRouter from "./routes/mealPlanArchive.routes";
import { VoiceCommandParser } from "./voiceCommandParser";
import { VoiceCommandExecutor } from "./voiceCommandExecutor";
import { saveGlycemicSettings, getGlycemicSettings } from './services/glycemicSettingsService';
import multer from 'multer';
import OpenAI from 'openai';
import pushNotificationsRouter from './routes/pushNotifications';
import biometricsRouter from './routes/biometricsRoutes';
import alcoholRouter from './routes/alcohol';
import mealPlanReplaceRouter from './routes/meal-plan-replace';
import authSessionRouter from './routes/auth.session';
import { MealEngineService } from "./services/mealEngineService";
import { generateFridgeRescueMeals } from "./services/fridgeRescueGenerator";
import { fridgeRescueRouter } from "./routes/fridgeRescue";
import alcoholLogRouter from './routes/alcohol-log';
import vitalsBpRouter from './routes/vitals-bp';
import proteinTargetsRouter from './routes/proteinTargets';
import { cookingRouter } from './routes/cooking';
import { mealImagesRouter } from './routes/mealImages';
import weekBoardRoutes from './routes/weekBoard';
// Deleted: diabeticHubRouter
import manualMacrosRouter from './routes/manualMacros';
// Import routes
import mealPlansRoutes from "./routes/mealPlans";
import mealLogsRoutes from "./routes/mealLogs";
import macroLogsRoutes from "./routes/macroLogs";
import alcoholLogRoutes from "./routes/alcohol-log";
import glucoseLogRoutes from "./routes/glucose-logs";
import biometricsRoutes from "./routes/biometricsRoutes";
// Deleted: glp1ShotsRoutes
import builderPlansRoutes from "./routes/builderPlans";
import careTeamRoutes from "./routes/careTeamRoutes";
import procareRoutes from "./routes/procareRoutes";
import onboardingProgressRoutes from "./routes/onboardingProgress";
import foundersRoutes from "./routes/foundersRoutes";
import physicianReportsRoutes from "./routes/physicianReports";
import mealFinderRouter from "./routes/mealFinder";
import { registerAdminSql } from "./adminSql";
import glp1ShotsRoutes from "./routes/glp1Shots"; // Added import for glp1ShotsRoutes
import glp1Routes from "./routes/glp1"; // GLP-1 profile routes
import stripeCheckoutRouter from "./routes/stripeCheckout"; // Added import for stripeCheckoutRouter
import stripeWebhookRouter from "./routes/stripeWebhook"; // Added import for stripeWebhookRouter
import lockedDaysRouter from "./routes/lockedDays";

// Helper function to determine features by subscription plan
function getFeaturesByPlan(plan: string) {
  const features = {
    basic: [
      "ai-meal-creator",
      "meals-for-kids", 
      "craving-creator",
      "biometrics-hub"
    ],
    premium: [
      "ai-meal-creator",
      "meals-for-kids",
      "craving-creator", 
      "restaurant-guide",
      "fridge-rescue",
      "biometrics-hub"
    ],
    ultimate: [
      "ai-meal-creator",
      "meals-for-kids",
      "craving-creator",
      "restaurant-guide", 
      "fridge-rescue",
      "holiday-feast",
      "potluck-planner",
      "biometrics-hub"
    ]
  };

  return features[plan as keyof typeof features] || features.basic;
}

// Duplicate prevention and measurement normalization helpers
function mealSig(m: { name?: string; ingredients?: any[] }) {
  const name = String(m.name ?? "").toLowerCase();
  const ings = (Array.isArray(m.ingredients) ? m.ingredients : [])
    .slice(0, 5)
    .map((i: any) => String(i.name ?? i.ingredient ?? "").toLowerCase().trim())
    .join("|");
  return `${name}::${ings}`;
}

const FRACTIONS: [number, string][] = [
  [0.75, "3/4"], [0.5, "1/2"], [0.33, "1/3"], [0.25, "1/4"], [0.66, "2/3"]
];

function toKitchenFraction(n: number): string {
  if (!isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  for (const [v, f] of FRACTIONS) if (Math.abs(rounded - v) <= 0.02) return f;
  if (Math.abs(rounded - Math.round(rounded)) <= 0.02) return String(Math.round(rounded));
  return String(rounded);
}

const UNIT_DEFAULTS: Record<string, { unit?: string; piece?: string }> = {
  cucumber: { piece: "medium" },
  lemon: { piece: "medium" },
  lime: { piece: "medium" },
  egg: { piece: "large" },
  onion: { piece: "small" },
  garlic: { unit: "clove" },
  oil: { unit: "tbsp" },
  olive: { unit: "tbsp" },
  salt: { unit: "tsp" },
  pepper: { unit: "tsp" },
  vinegar: { unit: "tbsp" },
  yogurt: { unit: "cup" },
  milk: { unit: "cup" },
  rice: { unit: "cup" },
  pasta: { unit: "oz" },
  cheese: { unit: "oz" },
  chicken: { unit: "oz" },
  beef: { unit: "oz" },
  turkey: { unit: "oz" },
  salmon: { unit: "oz" },
};

function inferUnit(ingName: string): { unit?: string; piece?: string } {
  const key = Object.keys(UNIT_DEFAULTS).find(k => ingName.toLowerCase().includes(k));
  return key ? UNIT_DEFAULTS[key] : {};
}

function normalizeAmountAndUnit(amountRaw: any, nameRaw: any): { amount: string; name: string } {
  let name = String(nameRaw || "").trim();

  // Handle complex objects - extract amount if it's nested
  let amountValue = amountRaw;
  if (typeof amountRaw === 'object' && amountRaw !== null) {
    amountValue = amountRaw.amount || amountRaw.value || amountRaw.quantity || "";
  }

  let amt = String(amountValue || "").trim();

  // Handle ".25" -> "0.25"
  if (/^\.\d+/.test(amt)) amt = "0" + amt;

  // If amount contains only a bare number (or decimal), convert to fraction where helpful
  const numMatch = amt.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    const f = toKitchenFraction(n);
    // choose unit or piece
    const guess = inferUnit(name);
    if (guess.piece) {
      return { amount: `${f} ${guess.piece}`, name };
    }
    if (guess.unit) {
      return { amount: `${f} ${guess.unit}`, name };
    }
    // fallback generic "cup"
    return { amount: `${f} cup`, name };
  }

  // If amount contains a unit word, keep it but fix fractions
  if (/\b(tsp|tbsp|cup|cups|oz|lb|clove|cloves|slice|slices|can|cans|packet|packets|g|kg|ml|l)\b/i.test(amt)) {
    const d = amt.match(/(\d+(?:\.\d+)?)/)?.[1];
    if (d) {
      const n = parseFloat(d);
      if (n > 0 && n < 1) amt = amt.replace(d, toKitchenFraction(n));
    }
    return { amount: amt, name };
  }

  // If amount is words like "one", "two", convert to numeric piece with default piece size
  if (/^(one|two|three|four|five)\b/i.test(amt)) {
    const map: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5" };
    const guess = inferUnit(name);
    const num = map[amt.toLowerCase()] ?? amt;
    return { amount: `${num} ${guess.piece ?? ""}`.trim(), name };
  }

  // If amount is empty or nonsense, force "1 [piece|unit]"
  const guess = inferUnit(name);
  return { amount: `1 ${guess.piece ?? guess.unit ?? "unit"}`, name };
}

function enforceMeasuredIngredients(ings: Array<{ name: string; amount: any }>): Array<{ name: string; amount: string }> {
  return ings.map(i => normalizeAmountAndUnit(i.amount || "", i.name || ""));
}

function hasUnmeasured(ings: Array<{ name: string; amount: string }>): boolean {
  return ings.some(i => !i.amount || /^\d+(\.\d+)?$/.test(i.amount));
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("🔧 registerRoutes called - starting route registration");
  // Health endpoint for network testing
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now(), version: "1.0.0" });
  });

  // AI Health endpoint - Facebook-level stability monitoring
  // Reports: schema status, success/fallback/error rates, required table presence
  // NOTE: Release gates only apply to AI-REQUIRED routes, not deterministic routes
  app.get("/api/health/ai", async (_req, res) => {
    try {
      const { validateRequiredTables } = await import("./services/schemaValidator");
      const { getRecentMetrics } = await import("./services/aiHealthMetrics");
      
      const schemaStatus = await validateRequiredTables();
      const metrics = getRecentMetrics();
      
      // Determine overall status (based only on AI-required routes)
      let status: 'ok' | 'degraded' | 'down' = metrics.status;
      
      // If required tables are missing, override to 'down'
      if (!schemaStatus.allTablesExist) {
        status = 'down';
      }
      
      // Release gates only check AI-required routes, not deterministic routes
      const aiRoutesHaveTraffic = metrics.aiRoutes.totalRequests > 0;
      
      const response = {
        status,
        timestamp: Date.now(),
        schema: {
          allTablesExist: schemaStatus.allTablesExist,
          requiredTables: Object.fromEntries(
            schemaStatus.results.map(r => [r.tableName, r.exists])
          ),
          missingTables: schemaStatus.missingTables,
        },
        metrics: {
          windowMs: metrics.windowMs,
          aiRoutes: metrics.aiRoutes,
          routes: metrics.routes,
        },
        releaseGates: {
          schemaPassing: schemaStatus.allTablesExist,
          // noErrors: only check AI-required routes (deterministic routes excluded)
          noErrors: !metrics.aiRoutes.hasErrors,
          // fallbackRateOk: only check AI-required routes
          // If no AI traffic yet, gate passes (nothing to measure)
          fallbackRateOk: !aiRoutesHaveTraffic || metrics.aiRoutes.fallbackRate <= 0.05,
        },
        routeClassification: {
          note: "Deterministic routes (like Craving Creator) are intentionally excluded from AI health gate",
          aiRequiredRoutes: ['/api/meals/generate', '/api/meals/fridge-rescue'],
          deterministicRoutes: ['/api/meals/craving-creator', '/api/meals/craving-creator-enforced', '/api/meals/ai-creator', '/api/meals/kids'],
        }
      };
      
      // Return 503 if critical issues, 200 otherwise
      const httpStatus = status === 'down' ? 503 : 200;
      res.status(httpStatus).json(response);
    } catch (error: any) {
      console.error("Health check failed:", error);
      res.status(500).json({ 
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  });

  // Public Object Storage - Serves meal images for Hybrid Meal Engine
  app.get("/public-objects/*", async (req, res) => {
    const filePath = (req.params as Record<string, string>)[0] || "";
    try {
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error: any) {
      if (error.message?.includes("PUBLIC_OBJECT_SEARCH_PATHS not set")) {
        return res.status(503).json({ 
          error: "Object storage not configured",
          hint: "Create a bucket in Object Storage and set PUBLIC_OBJECT_SEARCH_PATHS env var"
        });
      }
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ⚡ PRIORITY ROUTE: Classic Builder - MUST BE FIRST before any middleware
  app.post("/api/meal-plan/generate", (req, res) => {
    console.log("🏗️ PRIORITY Classic Builder route hit - responding immediately!");

    res.json({ 
      plan: {
        id: `plan-${Date.now()}`,
        userId: "00000000-0000-0000-0000-000000000001",
        weeks: 1,
        mealsPerDay: 3,
        snacksPerDay: 1,
        targets: { calories: 2000, protein: 140 },
        scheduleTimes: { breakfast: "07:00", lunch: "12:00", dinner: "18:30" },
        planningMode: "CLASSIC",
        variant: "AUTO",
        meals: [
          { id: 1, name: "Avocado Toast with Eggs", type: "breakfast", calories: 380, protein: 18, day: 0, scheduledTime: "07:00" },
          { id: 2, name: "Grilled Chicken Salad", type: "lunch", calories: 450, protein: 35, day: 0, scheduledTime: "12:00" },
          { id: 3, name: "Salmon with Vegetables", type: "dinner", calories: 520, protein: 42, day: 0, scheduledTime: "18:30" },
          { id: 4, name: "Mixed Nuts", type: "snack", calories: 180, protein: 6, day: 0, scheduledTime: "15:30" }
        ]
      },
      meta: {
        generatedAt: new Date().toISOString(),
        planningMode: "CLASSIC",
        variant: "AUTO",
        totalMeals: 4
      }
    });
  });

  // Mount auth session and alcohol log
  app.use(authSessionRouter);
  app.use(alcoholLogRouter);
  app.use('/api/vitals/bp', vitalsBpRouter);
  app.use('/api', proteinTargetsRouter);
  app.use('/api', cookingRouter);
  app.use('/api', mealImagesRouter);
  // Deleted: diabeticHubRouter route
  app.use('/api', onboardingProgressRoutes);
  app.use('/api', mealFinderRouter);

  // Register admin SQL routes (one-time use)
  registerAdminSql(app);

  // ElevenLabs configuration endpoint
  app.get("/api/elevenlabs-config", async (req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "ErXwobaYiN019PkySvjV";
      console.log("ElevenLabs config requested - hasKey:", !!apiKey, "voiceId:", voiceId);
      res.json({ 
        hasKey: !!apiKey,
        apiKey: apiKey || null,
        voiceId: voiceId
      });
    } catch (error) {
      console.error("Error fetching ElevenLabs config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  // ElevenLabs TTS proxy endpoint - Coach Idrise Voice Clone
  app.post("/api/tts", async (req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.warn("⚠️ ElevenLabs API key not configured");
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      // Use custom voice ID from environment, fallback to default
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "ErXwobaYiN019PkySvjV";
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      console.log(`🎤 Generating TTS with Coach Idrise voice for: "${text.substring(0, 50)}..."`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.30,           // 30% - natural variation
            similarity_boost: 0.90,    // 90% - close to original voice
            style: 0.40,               // 40% - expressive delivery
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ElevenLabs API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ error: "ElevenLabs TTS generation failed" });
      }

      // Stream the audio response back to client
      res.setHeader('Content-Type', 'audio/mpeg');
      if (response.body) {
        const reader = response.body.getReader();
        const stream = new ReadableStream({
          async start(controller) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          }
        });
        // @ts-ignore - Node.js stream compatibility
        for await (const chunk of stream) {
          res.write(chunk);
        }
        res.end();
      }

    } catch (error) {
      console.error("TTS generation error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Holiday Feast Family Recipes endpoint
  app.post("/api/holiday-feast/family-recipes", async (req, res) => {
    try {
      const { holidayCode, name, servings, ingredients, instructions, photo_url } = req.body;

      if (!holidayCode || !name || !servings || !ingredients || !instructions) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // For now, just log the recipe and return success
      console.log("🍽️ Family Recipe Saved:", {
        holidayCode,
        name,
        servings,
        ingredients,
        instructions,
        photo_url
      });

      res.json({ 
        success: true, 
        message: "Family recipe saved successfully!",
        recipe: { holidayCode, name, servings, ingredients, instructions, photo_url }
      });
    } catch (error) {
      console.error("Error saving family recipe:", error);
      res.status(500).json({ error: "Failed to save family recipe" });
    }
  });

  // Simple inline middleware for backward compatibility
  const normalizeFridgeRescue = (req: any, _res: any, next: any) => {
    if (!req.body?.fridgeItems && Array.isArray(req.body?.ingredients)) {
      req.body.fridgeItems = req.body.ingredients;
      req.body._aliasUsed = "ingredients";
    }
    next();
  };

  // Simple inline feature protection for alpha testing (bypasses all restrictions)
  const requireFeature = (featureKey: string) => (req: any, _res: any, next: any) => {
    // During alpha testing, allow all users
    next();
  };

  // Non-middleware version for use inside route handlers
  const checkFeatureAccess = (_featureKey: string, _req: any): { allowed: boolean; reason?: string } => {
    // During alpha testing, allow all users
    return { allowed: true };
  };

  // 🔒 LOCKED: Deterministic Fridge Rescue Engine - DO NOT MODIFY
  // User confirmed this new system works perfectly - keep it locked!
  app.use("/api", fridgeRescueRouter);

  // REMOVED: Duplicate route moved to top priority position

  // Profile endpoint for alpha testing
  app.get("/api/profile", async (req, res) => {
    // Return demo profile for alpha testing
    res.json({
      id: "00000000-0000-0000-0000-000000000001",
      name: "Demo User",
      email: "demo@example.com",
      preferences: {},
      targets: { calories: 2000, protein: 140 }
    });
  });

  // Simplified users endpoint for Plan Builder
  app.get("/api/users/1", async (req, res) => {
    // Return demo user for alpha testing
    res.json({
      id: 1,
      name: "Demo User",
      email: "demo@example.com",
      preferences: {},
      targets: { calories: 2000, protein: 140 }
    });
  });

  /* 🗑️ OLD: Flaky AI-based generator - REPLACED with deterministic engine
  app.post("/api/fridge-rescue-generator", requireFeature("FRIDGE_RESCUE"), normalizeFridgeRescue, async (req, res) => {
    try {
      console.log("🥕 Fridge Rescue generator route hit - generating 3 meals");

      const { fridgeItems, userId = "demo-user", servings = 4, count = 3, _aliasUsed } = req.body;

      if (!fridgeItems || !Array.isArray(fridgeItems)) {
        return res.status(400).json({ 
          error: "fridgeItems is required and must be an array"
        });
      }

      console.log("[FridgeRescue] using generator, items:", fridgeItems.length, "count:", count);

      // Generate multiple meals with proper macros and amounts
      const meals = await generateFridgeRescueMeals({ fridgeItems, user: { healthConditions: [] } });

      console.log("🎉 Fridge rescue meals generated:", meals.length, "meals");
      res.json({ meals }); // Always return { meals: [...] }
    } catch (error: any) {
      console.error("❌ Fridge rescue error:", error);
      res.status(500).json({ error: error.message || "Failed to generate fridge rescue meals" });
    }
  });
  */

  /* 🗑️ REMOVED: Original fridge rescue generator - replaced by unified pipeline */

  // ============================================================================
  // UNIFIED MEAL GENERATION ENDPOINT
  // Single canonical endpoint for ALL meal generation (AI Meal Creator, AI Premades, Fridge Rescue)
  // Guarantees: consistent response format, fallback images, error handling
  // ============================================================================
  app.post("/api/meals/generate", async (req, res) => {
    console.log("🔄 Unified meal generation endpoint hit");
    const startTime = Date.now();
    
    try {
      const { 
        type = 'craving',           // 'craving' | 'fridge-rescue' | 'premade'
        mealType = 'lunch',         // 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'snacks'
        input,                      // string (craving) or string[] (ingredients)
        userId,
        macroTargets,
        count = 1
      } = req.body;

      // Feature gate for fridge-rescue and premade types
      if (type === 'fridge-rescue' || type === 'premade') {
        const featureCheck = checkFeatureAccess("FRIDGE_RESCUE", req);
        if (!featureCheck.allowed) {
          return res.status(403).json({
            success: false,
            error: featureCheck.reason || "Fridge Rescue feature requires a subscription",
            source: 'error'
          });
        }
      }

      // Validate input
      if (!input) {
        return res.status(400).json({ 
          success: false, 
          error: "input is required (craving text or ingredients array)" 
        });
      }

      // Validate input is array for fridge-rescue/premade
      if ((type === 'fridge-rescue' || type === 'premade') && typeof input === 'string') {
        // Convert comma-separated string to array
        const inputArray = input.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (inputArray.length === 0) {
          return res.status(400).json({
            success: false,
            error: "At least one ingredient is required",
            source: 'error'
          });
        }
      }

      // Import unified pipeline and metrics
      const { generateMealUnified } = await import("./services/unifiedMealPipeline");
      const { recordGeneration } = await import("./services/aiHealthMetrics");

      const result = await generateMealUnified({
        type,
        mealType,
        input,
        userId,
        macroTargets,
        count
      });

      // Record metrics for AI health tracking
      const durationMs = Date.now() - startTime;
      recordGeneration('/api/meals/generate', result.source as any, durationMs);

      console.log(`✅ Unified generation complete: source=${result.source}, success=${result.success}`);

      // Return consistent response format
      res.json(result);

    } catch (error: any) {
      console.error("❌ Unified generation error:", error);
      // Record error for metrics
      const { recordGeneration } = await import("./services/aiHealthMetrics");
      recordGeneration('/api/meals/generate', 'error', Date.now() - startTime, error.message);
      
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to generate meal",
        source: 'error'
      });
    }
  });


  // Fridge Rescue API Main Route - Generate 3 meals with macros and amounts
  app.post("/api/meals/fridge-rescue", requireFeature("FRIDGE_RESCUE"), normalizeFridgeRescue, async (req, res) => {
    console.log("[FRIDGE] hit", { body: req.body, headers: req.headers["content-type"] });
    const startTime = Date.now();
    
    try {
      console.log("🥕 Fridge Rescue route hit - generating 3 meals");

      const { fridgeItems, userId = "demo-user", servings = 4, count = 3, macroTargets, _aliasUsed } = req.body;

      if (!fridgeItems || !Array.isArray(fridgeItems) || fridgeItems.length === 0) {
        console.error("[FRIDGE] validation error: invalid fridgeItems", fridgeItems);
        return res.status(400).json({ 
          error: "fridgeItems is required and must be a non-empty array"
        });
      }

      // 🎯 Validate macro targets if provided (all fields optional)
      if (macroTargets) {
        const { protein_g, fibrous_carbs_g, starchy_carbs_g, fat_g } = macroTargets;
        
        // Validate each field only if it exists
        if (protein_g !== undefined && (typeof protein_g !== 'number' || protein_g < 0 || protein_g > 300)) {
          return res.status(400).json({ error: "protein_g must be a number between 0-300" });
        }
        if (fibrous_carbs_g !== undefined && (typeof fibrous_carbs_g !== 'number' || fibrous_carbs_g < 0 || fibrous_carbs_g > 150)) {
          return res.status(400).json({ error: "fibrous_carbs_g must be a number between 0-150" });
        }
        if (starchy_carbs_g !== undefined && (typeof starchy_carbs_g !== 'number' || starchy_carbs_g < 0 || starchy_carbs_g > 300)) {
          return res.status(400).json({ error: "starchy_carbs_g must be a number between 0-300" });
        }
        if (fat_g !== undefined && (typeof fat_g !== 'number' || fat_g < 0 || fat_g > 150)) {
          return res.status(400).json({ error: "fat_g must be a number between 0-150" });
        }
        
        console.log("🎯 Macro targets requested:", macroTargets);
      }

      console.log("[FRIDGE] valid request, items:", fridgeItems.length, "items:", fridgeItems);

      // Generate multiple meals with proper macros and amounts
      const meals = await generateFridgeRescueMeals({ 
        fridgeItems, 
        user: { healthConditions: [] },
        macroTargets 
      });

      // Record metrics - fridge rescue is AI-required
      const { recordGeneration } = await import("./services/aiHealthMetrics");
      const durationMs = Date.now() - startTime;
      // FridgeRescue returns AI meals if successful
      recordGeneration('/api/meals/fridge-rescue', 'ai', durationMs);

      console.log("[FRIDGE] ok returning", meals.length, "meals");
      res.json({ meals }); // Always return { meals: [...] }
    } catch (error: any) {
      console.error("[FRIDGE] handler error", error);
      // Record error for metrics
      const { recordGeneration } = await import("./services/aiHealthMetrics");
      recordGeneration('/api/meals/fridge-rescue', 'error', Date.now() - startTime, error.message);
      
      res.status(500).json({ error: error.message || "Failed to generate fridge rescue meals" });
    }
  });

  /* 🗑️ REMOVED: Original fridge rescue route
  app.post("/api/meals/fridge-rescue", requireFeature("FRIDGE_RESCUE"), normalizeFridgeRescue, async (req, res) => {
    try {
      console.log("🥕 Fridge Rescue route hit (legacy path) - generating meal");

      const { fridgeItems, userId, _aliasUsed } = req.body;

      if (!fridgeItems || !Array.isArray(fridgeItems)) {
        return res.status(400).json({ 
          error: "fridgeItems is required and must be an array"
        });
      }

      // Import the generator service
      const { generateFridgeRescueMeals } = await import("./services/fridgeRescueGenerator");

      // Generate the meal
      const generatedMeals = await generateFridgeRescueMeals({ fridgeItems });

      console.log("🎉 Fridge rescue meals generated:", generatedMeals.length, "meals");
      res.json({ meals: generatedMeals });
    } catch (error: any) {
      console.error("❌ Fridge rescue error:", error);
      res.status(500).json({ error: error.message || "Failed to generate fridge rescue meal" });
    }
  });
  */

  // CRITICAL: Register meal plan archive API FIRST to avoid Vite middleware interference
  app.post("/api/meal-plan-archive", async (req, res) => {
    try {
      console.log("🎯 PRIORITY MEAL PLAN ARCHIVE ROUTE HIT!");
      const userId = "test-user-123"; // Demo user ID

      // Import database connection
      const { db } = await import("./db");
      const { aiMealPlanArchive } = await import("../shared/schema");

      const mealPlanData = {
        userId,
        title: req.body.title || "AI Generated Meal Plan",
        dietOverride: req.body.dietOverride || null,
        durationDays: req.body.durationDays || 7,
        mealsPerDay: req.body.mealsPerDay || 3,
        snacksPerDay: req.body.snacksPerDay || 0,
        selectedIngredients: req.body.selectedIngredients || [],
        schedule: req.body.schedule || [],
        slots: req.body.slots || [],
        status: req.body.status || "accepted"
      };

      const [newPlan] = await db
        .insert(aiMealPlanArchive)
        .values(mealPlanData)
        .returning();

      console.log("✅ Successfully created meal plan:", newPlan.id);
      res.status(201).json(newPlan);
    } catch (error) {
      console.error("❌ Error creating meal plan:", error);
      res.status(400).json({ 
        error: "Failed to create meal plan",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // AI Meal Creator endpoints - Use absolute URLs for server-side fetch
  const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:5000";

  // WMC2 Adapter routes for ChatGPT-level meal generation
  app.post("/api/wmc2/generate", async (req, res) => {
    try {
      const { wmc2Generate } = await import("./services/wmc2Adapter");
      const result = await wmc2Generate(req.body);
      res.json(result);
    } catch (error) {
      console.error("WMC2 generation failed:", error);
      res.status(500).json({ error: "Meal generation failed" });
    }
  });

  app.post("/api/wmc2/:userId/regenerate", async (req, res) => {
    try {
      const { wmc2Regenerate } = await import("./services/wmc2Adapter");
      const result = await wmc2Regenerate(req.params.userId, req.body);
      res.json(result);
    } catch (error) {
      console.error("WMC2 regeneration failed:", error);
      res.status(500).json({ error: "Meal regeneration failed" });
    }
  });

  app.post("/api/ai/generate-meal-plan", async (req, res) => {
    try {
      const { userId, days, schedule, dietaryRestrictions, selectedIngredients, includeImages = true, mode = "ai_varied", constraints = {} } = req.body;

      console.log("🎯 AI Meal Creator generating meal plan:", { userId, days, scheduleCount: schedule?.length });

      if (!schedule || schedule.length === 0) {
        return res.status(400).json({ error: "Schedule is required" });
      }

      // Optimize by generating only first day, then duplicating with variations
      const items = [];
      const dayCount = parseInt(days) || 7;

      console.log(`🚀 Optimized generation: Creating templates for ${schedule.length} meal types`);

      // Defense: dedupe slots in case the client sent dupes
      const slots = [...schedule].sort((a, b) => a.order - b.order);
      const slotSeen = new Set<string>();
      const uniqueSlots = slots.filter(s => {
        const key = `${s.label}|${s.time}`;
        if (slotSeen.has(key)) return false;
        slotSeen.add(key);
        return true;
      });

      const expectedPerDay = uniqueSlots.length;
      const placed = new Set<string>(); // `${dayIndex}|${label}|${time}`

      console.log(`🚀 Generating ${expectedPerDay} unique slot types for ${dayCount} days`);

      // MEALGEN V2: Use centralized onboarding-aware generation if enabled
      if (process.env.MEALGEN_V2 === "true") {
        const { getOnboarding, generateDayV2, onboardingHash } = await import("./services/mealgenV2");

        try {
          const onboarding = await getOnboarding(userId || "1");
          const obHash = onboardingHash(onboarding);

          // Handle strict mode constraints
          if (constraints.allow?.length > 0) {
            onboarding.mustInclude = constraints.allow;
          }
          if (constraints.avoid?.length > 0) {
            onboarding.avoid = [...(onboarding.avoid || []), ...constraints.avoid];
          }
          if (constraints.dietFlags) {
            Object.assign(onboarding, constraints.dietFlags);
          }

          const slots = uniqueSlots.map(slot => ({
            courseStyle: slot.slot === "meal" ? (slot.label as any) : "Snack",
            label: slot.label,
            time: slot.time,
            order: slot.order
          }));

          if (mode === "repeat_one") {
            // Generate one meal and duplicate it
            const { generateMealV2 } = await import("./services/mealgenV2");
            const baseMeal = await generateMealV2({
              userId: userId || "1",
              courseStyle: slots[0].courseStyle,
              onboarding,
              includeImage: includeImages
            });

            const items: any[] = [];
            for (let d = 0; d < dayCount; d++) {
              for (const slot of uniqueSlots) {
                items.push({
                  ...baseMeal,
                  dayIndex: d,
                  slot: slot.slot,
                  label: slot.label,
                  time: slot.time,
                  order: slot.order
                });
              }
            }

            console.log(`🍽️ MEALGEN V2 (repeat_one): Generated ${items.length} items`);
            return res.json({ days: dayCount, items, meta: { onboardingHash: obHash, mode } });
          } else {
            // Generate variety with constraints
            const dayMeals = await generateDayV2({
              userId: userId || "1",
              onboarding,
              slots,
              includeImage: includeImages
            });

            const items: any[] = [];
            for (let d = 0; d < dayCount; d++) {
              dayMeals.forEach((meal, i) => {
                const slot = uniqueSlots[i];
                items.push({
                  ...meal,
                  dayIndex: d,
                  slot: slot.slot,
                  label: slot.label,
                  time: slot.time,
                  order: slot.order
                });
              });
            }

            console.log(`🍽️ MEALGEN V2: Generated ${items.length} items with onboarding compliance`);
            return res.json({ days: dayCount, items, meta: { onboardingHash: obHash, mode } });
          }
        } catch (error) {
          console.error("MEALGEN V2 failed, falling back to legacy:", error);
          // Fall through to legacy system
        }
      }

      // LEGACY SYSTEM: Get user profile data for personalized meal generation
      const [userProfile] = await db.select().from(users).where(eq(users.id, userId || "1")).limit(1);

      // Create variety-focused meal generation system
      const varietyPrompts = {
        breakfast: [
          "Traditional egg-based breakfast", "Yogurt and fruit parfait", "Oatmeal with toppings", 
          "Smoothie bowl", "Avocado toast variations", "Pancakes or waffles", "Breakfast burrito", 
          "Chia pudding", "French toast", "Breakfast quinoa bowl"
        ],
        lunch: [
          "Grilled protein with vegetables", "Fresh salad with protein", "Wrap or sandwich", 
          "Soup with bread", "Rice or grain bowl", "Pasta salad", "Stir-fry", 
          "Mediterranean mezze", "Sushi bowl", "Protein-packed soup"
        ],
        dinner: [
          "Roasted chicken with sides", "Fish with vegetables", "Beef stir-fry", 
          "Vegetarian pasta", "Curry with rice", "Grilled protein with quinoa", "Sheet pan meal", 
          "Stuffed vegetables", "Protein bowls", "International cuisine"
        ],
        snack: [
          "Nuts and fruit", "Vegetable sticks with dip", "Protein smoothie", 
          "Cheese and crackers", "Energy balls", "Yogurt with nuts", "Trail mix", 
          "Hummus with vegetables", "Protein bars", "Fresh fruit with nut butter"
        ]
      };

      // Generate template meals with true variety
      const templateMeals = [];
      const seen = new Set<string>();
      const usedPrompts = new Set<string>();

      for (const slot of uniqueSlots) {
        let mealGenerated = false;
        let tries = 0;

        while (!mealGenerated && tries < 6) {
          try {
            // Get variety prompts for this meal type
            const mealType = slot.slot === "meal" ? slot.label.toLowerCase() : "snack";
            const prompts = varietyPrompts[mealType as keyof typeof varietyPrompts] || [];

            // Select a unique prompt that hasn't been used
            let selectedPrompt = prompts[tries % prompts.length];
            let promptKey = `${mealType}-${selectedPrompt}`;

            // If we've used this prompt, modify it
            if (usedPrompts.has(promptKey)) {
              selectedPrompt = `${selectedPrompt} (alternative style)`;
              promptKey = `${mealType}-${selectedPrompt}-${tries}`;
            }
            usedPrompts.add(promptKey);

            // Create personalized prompt based on user profile
            let personalizedPrompt = selectedPrompt;
            if (selectedIngredients?.length > 0) {
              personalizedPrompt += ` featuring ${selectedIngredients.join(', ')}`;
            }
            if (userProfile?.dietaryRestrictions && userProfile.dietaryRestrictions.length > 0) {
              personalizedPrompt += `, ${userProfile.dietaryRestrictions.join(' and ')} friendly`;
            }
            if (userProfile?.allergies && userProfile.allergies.length > 0) {
              personalizedPrompt += `, avoiding ${userProfile.allergies.join(', ')}`;
            }
            if (userProfile?.dislikedFoods && userProfile.dislikedFoods.length > 0) {
              personalizedPrompt += `, without ${userProfile.dislikedFoods.join(', ')}`;
            }

            console.log(`🎯 Generating ${slot.label} with variety prompt: "${personalizedPrompt}"`);

            const mealResponse = await fetch(`${INTERNAL_API_BASE}/api/meals/craving-creator`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetMealType: mealType,
                cravingInput: personalizedPrompt,
                dietaryRestrictions: userProfile?.dietaryRestrictions || [],
                allergies: userProfile?.allergies || [],
                userId: userId || "1",
                variation: tries
              })
            });

            if (mealResponse.ok) {
              const { meal } = await mealResponse.json();
              if (meal) {
                // Normalize ingredients for proper measurements
                let normalizedIngredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
                normalizedIngredients = enforceMeasuredIngredients(normalizedIngredients);

                const normalizedMeal = {
                  ...meal,
                  ingredients: normalizedIngredients,
                  slot: slot.slot,
                  label: slot.label,
                  time: slot.time,
                  order: slot.order,
                  badges: meal.medicalBadges || []
                };

                // Check for duplicates using improved signature
                const sig = mealSig(normalizedMeal);
                if (!seen.has(sig)) {
                  seen.add(sig);

                  // Check if ingredients still need fixing
                  if (hasUnmeasured(normalizedMeal.ingredients)) {
                    console.warn(`⚠️ Meal "${normalizedMeal.name}" has unmeasured ingredients, retrying...`);
                    tries++;
                    continue;
                  }

                  templateMeals.push(normalizedMeal);
                  mealGenerated = true;
                  console.log(`✅ Generated unique meal: ${normalizedMeal.name} for ${slot.label}`);
                } else {
                  console.log(`🔄 Duplicate detected for ${slot.label}, trying different style`);
                  tries++;
                }
              }
            } else {
              console.warn(`Failed to generate meal for ${slot.label}, attempt ${tries + 1}`);
              tries++;
            }
          } catch (mealError) {
            console.error(`Error generating meal for ${slot.label}, attempt ${tries + 1}:`, mealError);
            tries++;
          }
        }

        if (!mealGenerated) {
          console.error(`❌ Failed to generate unique meal for ${slot.label} after ${tries} attempts`);
        }
      }

      // Duplicate templates across all days with proper duplicate prevention
      for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
        let countToday = 0;

        for (const template of templateMeals) {
          if (countToday >= expectedPerDay) break; // Cap per day

          const key = `${dayIndex}|${template.label}|${template.time}`;
          if (placed.has(key)) continue; // No dupes

          items.push({
            ...template,
            dayIndex,
            // Add slight variation to name for different days
            name: dayIndex === 0 ? template.name : `${template.name} (Day ${dayIndex + 1} Variation)`
          });

          placed.add(key);
          countToday++;
        }
      }

      console.log(`🍽️ WMC2 returning ${items.length} items (expected ${dayCount * expectedPerDay})`);
      res.json({ 
        days: dayCount, 
        items,
        totalMeals: items.length
      });

    } catch (error: any) {
      console.error("❌ AI meal plan generation error:", error);
      res.status(500).json({ error: "Failed to generate meal plan", details: error.message });
    }
  });

  app.post("/api/ai/regenerate-meal", async (req, res) => {
    try {
      const { userId, slot, label, time, dayIndex, dietaryRestrictions, selectedIngredients } = req.body;

      console.log("🔄 Regenerating meal:", { label, dayIndex });

      // Call existing Craving Creator endpoint with absolute URL for regeneration
      const cravingInput = selectedIngredients?.length > 0 ? 
        `Different ${label} with ${selectedIngredients.join(', ')}` : 
        `Different healthy ${label}`;

      const mealResponse = await fetch(`${INTERNAL_API_BASE}/api/meals/craving-creator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMealType: slot === "meal" ? label.toLowerCase() : "snack",
          cravingInput,
          dietaryRestrictions: [dietaryRestrictions].filter(Boolean),
          userId: userId || "1"
        })
      });

      if (mealResponse.ok) {
        const { meal } = await mealResponse.json();
        if (meal) {
          const updatedMeal = {
            ...meal,
            dayIndex,
            slot,
            label,
            time,
            badges: meal.medicalBadges || []
          };

          console.log(`✅ Regenerated meal: ${meal.name}`);
          res.json(updatedMeal);
        } else {
          throw new Error("No meal returned from craving creator");
        }
      } else {
        const errorText = await mealResponse.text();
        throw new Error(`Craving creator failed: ${mealResponse.status} ${errorText}`);
      }

    } catch (error: any) {
      console.error("❌ Meal regeneration error:", error);
      res.status(500).json({ error: "Failed to regenerate meal", details: error.message });
    }
  });

  // Weekly plan routes (maintained for compatibility)


  // Voice Processing API
  app.post("/api/voice/process", async (req, res) => {
    try {
      const { transcript } = req.body;

      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ 
          error: "Transcript is required and must be a string" 
        });
      }

      const parser = new VoiceCommandParser();
      const executor = new VoiceCommandExecutor();

      // Parse the voice command with OpenAI
      const parsedResponse = await parser.parseCommand(transcript, '1'); // TODO: Get real user ID

      // Execute any backend processing needed
      const finalResponse = await executor.executeCommand(parsedResponse, '1');

      console.log('🎤 Voice command processed:', { transcript, response: finalResponse });

      res.json(finalResponse);
    } catch (error) {
      console.error('Voice API error:', error);
      res.status(500).json({
        action: "error",
        speech: "I'm having trouble processing your request. Please try again."
      });
    }
  });
  // Avatar Chat Routes
  app.use("/api", avatarChatRouter);
  app.use("/api", conciergeRouter);
  app.use("/api", chefRouter);
  app.use("/api/cooking-challenges", cookingChallengesRouter);
  app.use("/api/cooking-classes", cookingClassesRouter);

  // Week Board routes (simplified meal board)
  weekBoardRoutes(app);

  // Enhanced Meal Logs API for macro tracking
  app.post("/api/meal-logs-enhanced", async (req, res) => {
    try {
      const { eq } = await import("drizzle-orm");
      const mealData = req.body;

      // Insert into enhanced meal logs table
      const [insertedLog] = await db
        .insert(mealLogsEnhanced)
        .values(mealData)
        .returning();

      console.log("✅ Enhanced meal logged successfully:", insertedLog.id);
      res.json(insertedLog);
    } catch (error: any) {
      console.error("❌ Failed to log enhanced meal:", error);
      res.status(500).json({ error: "Failed to log meal" });
    }
  });

  // Community Routes
  const communityRouter = (await import("./routes/community")).default;
  app.use("/api/community", communityRouter);

  // Recipe Gallery Routes
  const recipeGalleryRouter = (await import("./routes/recipeGallery")).default;
  app.use("/api/recipe-gallery", recipeGalleryRouter);

  // Biometrics Routes
  app.use("/api/biometrics", biometricsRouter);

  // Manual Macros Routes
  app.use("/api", manualMacrosRouter);

  // Alcohol Routes
  app.use("/api", alcoholRouter);

  // Meal plan replacement route
  app.use(mealPlanReplaceRouter);

  // Push Notification Routes
  app.use("/api/push", pushNotificationsRouter);

  // Enhanced Shopping List endpoint with scope support
  app.post("/api/shopping-list", async (req, res) => {
    try {
      const userId = req.session?.userId || req.headers["x-user-id"] as string;
      if (!userId) {
        console.log("❌ Shopping list: No userId in session or headers");
        return res.status(401).json({ 
          ok: false, 
          message: "Not authenticated. Please sign in." 
        });
      }

      const { 
        items = [], 
        scope = { type: "adhoc", key: "inbox" }, 
        strategy = "append", 
        multiplier = 1,
        sourceBuilder 
      } = req.body;

      console.log("🛒 Shopping list:", { userId, itemsCount: items.length, scope, strategy, multiplier, sourceBuilder });

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
          ok: false, 
          message: "No items provided" 
        });
      }

      // Handle strategy
      if (strategy === "replace_scope") {
        // Delete all existing items for this scope
        await db.delete(shoppingListItems)
          .where(and(
            eq(shoppingListItems.userId, userId),
            eq(shoppingListItems.scopeType, scope.type),
            eq(shoppingListItems.scopeKey, scope.key)
          ));
      }

      // Prepare items for insertion
      const itemsToInsert = items.map((item: any) => ({
        userId,
        name: item.name || item.item,
        quantity: String((item.quantity || item.qty || 1) * multiplier),
        unit: item.unit || "",
        category: item.category || "",
        scopeType: scope.type,
        scopeKey: scope.key,
        sourceBuilder,
        checked: false,
      }));

      // Insert items
      if (itemsToInsert.length > 0) {
        await db.insert(shoppingListItems).values(itemsToInsert);
      }

      res.status(201).json({ 
        ok: true,
        success: true, 
        itemsAdded: itemsToInsert.length,
        scope,
        strategy 
      });
    } catch (error) {
      console.error("❌ Shopping list error:", error);
      res.status(500).json({ 
        ok: false, 
        message: "Failed to add to shopping list",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Holiday Feast Routes
  app.use("/api/holiday-feast", holidayFamilyRecipeRouter);

  // Alcohol logs endpoint now handled by alcoholLogRouter

  // Family Recipe routes
  app.use("/api", familyRecipesRouter);

  // Upload routes
  app.use("/api", uploadsRouter);

  // Object Storage routes (presigned URL uploads)
  registerObjectStorageRoutes(app);

  // Profile photo update endpoint - supports both session and token auth
  app.put("/api/users/profile-photo", async (req, res) => {
    try {
      // Support both session-based auth (mobile) and token-based auth
      let userId = (req.session as any)?.userId as string | undefined;
      
      // Fall back to token auth if no session
      if (!userId) {
        const token = req.headers["x-auth-token"] as string;
        if (token) {
          const [user] = await db.select().from(users).where(eq(users.authToken, token)).limit(1);
          userId = user?.id;
        }
      }
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { profilePhotoUrl } = req.body;
      if (!profilePhotoUrl || typeof profilePhotoUrl !== "string") {
        return res.status(400).json({ error: "profilePhotoUrl is required" });
      }

      await db.update(users).set({ profilePhotoUrl }).where(eq(users.id, userId));

      res.json({ success: true, profilePhotoUrl });
    } catch (error) {
      console.error("Failed to update profile photo:", error);
      res.status(500).json({ error: "Failed to update profile photo" });
    }
  });

  // DIRECT Holiday Feast route for debugging
  app.post("/api/meals/holiday-feast", async (req, res) => {
    console.log("🎯 DIRECT Holiday Feast route HIT! Body:", req.body);
    try {
      const { generateHolidayFeast } = await import("./services/holidayFeastService");
      const result = await generateHolidayFeast({
        occasion: req.body.occasion || "Christmas",
        servings: req.body.servings || 6,
        counts: req.body.counts || { appetizers: 1, mainDishes: 1, sideDishes: 1, desserts: 1 },
        dietaryRestrictions: req.body.dietaryRestrictions || [],
        cuisineType: req.body.cuisineType,
        budgetLevel: req.body.budgetLevel || "moderate",
        familyRecipe: req.body.familyRecipe,
      });

      res.json({
        holiday: req.body.occasion,
        servings: req.body.servings,
        feast: result.feast || [],
        recipes: result.recipes || [],
        colorTheme: result.colorTheme,
      });
    } catch (error: any) {
      console.error("❌ Holiday feast error:", error);
      res.status(500).json({ error: "Generation failed" });
    }
  });

  // My Progress Routes
  const myProgressRouter = (await import("./routes/myProgress.js")).default;
  app.use("/api/progress", myProgressRouter);

  // Food Log API - Log meals as eaten
  app.post("/api/meal-logs", async (req, res) => {
    try {
      const parsed = insertMealLogSchema.parse(req.body);
      const mealLog = await storage.createMealLog(parsed);
      res.json(mealLog);
    } catch (error) {
      console.error("Failed to create meal log:", error);
      res.status(500).json({ error: "Failed to log meal" });
    }
  });

  // Get meal logs with infinite query support - used by MealJournalPage
  app.get("/api/meal-logs", async (req, res) => {
    try {
      const { userId, from, to, limit = "50", cursor } = req.query;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Convert date strings to Date objects if provided
      const startDate = from ? new Date(from as string) : undefined;
      const endDate = to ? new Date(to as string) : undefined;

      // Get meals with date filtering
      let meals = await storage.getMealLogs(userId as string, startDate, endDate);

      // Apply cursor-based pagination
      const pageSize = parseInt(limit as string);
      let startIndex = 0;

      if (cursor) {
        // Find the index of the item with this cursor
        startIndex = meals.findIndex(meal => meal.id === cursor);
        if (startIndex === -1) startIndex = 0;
        else startIndex++; // Start after the cursor item
      }

      const items = meals.slice(startIndex, startIndex + pageSize);
      const nextCursor = items.length === pageSize && startIndex + pageSize < meals.length 
        ? items[items.length - 1].id 
        : undefined;

      res.json({ items, nextCursor });
    } catch (error) {
      console.error("Failed to get meal logs:", error);
      res.status(500).json({ error: "Failed to get meal logs" });
    }
  });

  // Medical Personalization API - Get personalized meal plan based on user's medical profile
  app.post("/api/weekly-meal-plan/:userId/regenerate", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { mealsPerDay = 3, snacksPerDay = 1, duration = 7 } = req.body;

      // Get user's medical profile from onboarding data  
      // Get user data directly
      const [user] = await db.select().from(users).where(eq(users.id, userId.toString())).limit(1);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Mock medical profile based on common conditions (replace with real user data)
      const userMedicalProfile = {
        medicalConditions: user.healthConditions || ['diabetes_type2', 'hypertension'],
        foodAllergies: user.allergies || ['nuts'],
        dietaryRestrictions: user.dietaryRestrictions || ['gluten_free'],
        primaryGoal: user.fitnessGoal || 'weight_loss',
        activityLevel: user.activityLevel || 'moderate',
        customConditions: {}
      };

      // Generate medically personalized meal plan
      const { MedicalPersonalizationService } = await import("./medicalPersonalizationService.js");
      const personalizedMealPlan = MedicalPersonalizationService.generateWeeklyMealPlan(
        userMedicalProfile,
        mealsPerDay,
        snacksPerDay,
        duration
      );

      res.json({ 
        success: true, 
        mealPlan: personalizedMealPlan,
        message: "Meal plan regenerated with medical personalization"
      });
    } catch (error: any) {
      console.error("Error regenerating personalized meal plan:", error);
      res.status(500).json({ error: "Failed to regenerate meal plan", details: error.message });
    }
  });
  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      // Ensure mealPlanVariant is a valid enum value or undefined
      const validatedData = {
        ...userData,
        mealPlanVariant: userData.mealPlanVariant && ['A', 'B', 'AUTO'].includes(userData.mealPlanVariant as string) 
          ? (userData.mealPlanVariant as 'A' | 'B' | 'AUTO')
          : undefined
      };
      const [user] = await db.insert(users).values([validatedData]).returning();
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const [user] = await db.update(users).set(updates).where(eq(users.id, req.params.id)).returning();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User badges endpoint
  app.get("/api/users/:id/badges", async (req, res) => {
    res.json([]); // Return empty array for now
  });

  // User streak endpoint  
  app.get("/api/users/:id/streak", async (req, res) => {
    res.json({ current: 0, longest: 0 }); // Return zero streak for now
  });

  // User subscription routes
  app.get("/api/users/:id/subscription", async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const subscription = {
        plan: user.subscriptionPlan || "basic",
        status: user.subscriptionStatus || "active",
        expiresAt: user.subscriptionExpiresAt,
        features: getFeaturesByPlan(user.subscriptionPlan || "basic")
      };

      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id/subscription", async (req, res) => {
    try {
      const { plan, status, expiresAt } = req.body;
      const updates = {
        subscriptionPlan: plan,
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt
      };

      const [user] = await db.update(users).set(updates).where(eq(users.id, req.params.id)).returning();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        expiresAt: user.subscriptionExpiresAt,
        features: getFeaturesByPlan(user.subscriptionPlan || "basic")
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User preferences routes
  app.get("/api/users/:id/preferences", async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id/preferences", async (req, res) => {
    try {
      const preferences = req.body;
      const [user] = await db.update(users).set(preferences).where(eq(users.id, req.params.id)).returning();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User profile endpoint for AuthContext refresh
  // Uses x-auth-token header for secure authentication
  app.get("/api/user/profile", requireAuth, async (req: any, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser.id;
      
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        entitlements: user.entitlements || [],
        planLookupKey: user.planLookupKey,
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt,
        selectedMealBuilder: user.selectedMealBuilder,
        isTester: user.isTester || false,
        profilePhotoUrl: user.profilePhotoUrl || null,
      });
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // Meal builder selection endpoint - starts trial (one-time only)
  // Uses x-auth-token header for secure authentication
  app.post("/api/user/select-meal-builder", requireAuth, async (req: any, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser.id;
      const { selectedMealBuilder } = req.body;
      
      if (!selectedMealBuilder) {
        return res.status(400).json({ error: "selectedMealBuilder is required" });
      }
      
      const validBuilders = ["weekly", "diabetic", "glp1", "anti_inflammatory"];
      if (!validBuilders.includes(selectedMealBuilder)) {
        return res.status(400).json({ error: "Invalid meal builder selection" });
      }
      
      // First check if user exists and if trial already started
      const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // If trial already started, only update the builder selection (not trial dates)
      if (existingUser.trialStartedAt) {
        const [user] = await db.update(users)
          .set({ selectedMealBuilder })
          .where(eq(users.id, userId))
          .returning();
        
        return res.json({
          success: true,
          selectedMealBuilder: user.selectedMealBuilder,
          trialStartedAt: user.trialStartedAt?.toISOString(),
          trialEndsAt: user.trialEndsAt?.toISOString(),
          message: "Builder updated (trial already active)"
        });
      }
      
      // New trial: set trial dates and builder
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const [user] = await db.update(users)
        .set({
          selectedMealBuilder,
          trialStartedAt: now,
          trialEndsAt: trialEndsAt,
        })
        .where(eq(users.id, userId))
        .returning();
      
      res.json({
        success: true,
        selectedMealBuilder: user.selectedMealBuilder,
        trialStartedAt: user.trialStartedAt?.toISOString(),
        trialEndsAt: user.trialEndsAt?.toISOString(),
      });
    } catch (error: any) {
      console.error("Error selecting meal builder:", error);
      res.status(500).json({ error: "Failed to save meal builder selection" });
    }
  });

  // Update meal builder selection (for settings)
  // Uses x-auth-token header for secure authentication
  app.patch("/api/user/meal-builder", requireAuth, async (req: any, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser.id;
      const { selectedMealBuilder } = req.body;
      
      if (!selectedMealBuilder) {
        return res.status(400).json({ error: "selectedMealBuilder is required" });
      }
      
      const validBuilders = ["weekly", "diabetic", "glp1", "anti_inflammatory"];
      if (!validBuilders.includes(selectedMealBuilder)) {
        return res.status(400).json({ error: "Invalid meal builder selection" });
      }
      
      const [user] = await db.update(users)
        .set({ selectedMealBuilder })
        .where(eq(users.id, userId))
        .returning();
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        success: true,
        selectedMealBuilder: user.selectedMealBuilder,
      });
    } catch (error: any) {
      console.error("Error updating meal builder:", error);
      res.status(500).json({ error: "Failed to update meal builder" });
    }
  });

  // Recipe routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const { dietaryRestrictions, mealType, tags } = req.query;
      const filters: any = {};

      if (dietaryRestrictions) {
        filters.dietaryRestrictions = (dietaryRestrictions as string).split(',');
      }
      if (mealType) {
        filters.mealType = mealType as string;
      }
      if (tags) {
        filters.tags = (tags as string).split(',');
      }

      const recipes = await storage.getRecipes(filters);
      res.json(recipes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const recipe = await storage.getRecipe(req.params.id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recipes/search/:query", async (req, res) => {
    try {
      const recipes = await storage.searchRecipes(req.params.query);
      res.json(recipes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Meal plan routes
  app.get("/api/meal-plans/:userId", async (req, res) => {
    try {
      const plans = await db.select().from(mealPlans).where(eq(mealPlans.userId, req.params.userId));
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/meal-plans route moved to mealPlanArchive.routes.ts to handle AI meal plan acceptance

  app.post("/api/meal-plans/generate", async (req, res) => {
    try {
      const { userId } = req.body;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const generatedPlan = await generateMealPlan(user);
      const [mealPlan] = await db.insert(mealPlans).values({
        userId,
        name: `AI Generated Plan - Week of ${new Date().toLocaleDateString()}`,
        weekOf: new Date(),
        meals: generatedPlan.meals as any,
        totalCalories: generatedPlan.totalCalories,
        totalProtein: generatedPlan.totalProtein,
        totalCarbs: generatedPlan.totalCarbs,
        totalFat: generatedPlan.totalFat,
        isActive: true
      }).returning();

      res.json(mealPlan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/meal-plans/:id", async (req, res) => {
    try {
      const updates = req.body;
      const [mealPlan] = await db.update(mealPlans).set(updates).where(eq(mealPlans.id, req.params.id)).returning();
      if (!mealPlan) {
        return res.status(404).json({ message: "Meal plan not found" });
      }
      res.json(mealPlan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Meal log routes
  app.get("/api/meal-logs/:userId", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const mealLogs = await storage.getMealLogs(req.params.userId, start, end);
      res.json(mealLogs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DEBUG ENDPOINTS - Remove after troubleshooting
  app.get("/api/debug/db", async (_req, res) => {
    try {
      const result = await db.execute(sql`select current_database() as db, version() as version`);
      res.json({ 
        database: result.rows[0],
        env: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/debug/tables", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        select table_name 
        from information_schema.tables
        where table_schema='public'
          and table_name in ('food_logs','meal_logs','users','biometrics','vitals_bp')
        order by table_name
      `);
      res.json({ tables: result.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/meal-logs", async (req, res) => {
    try {
      const mealLogData = insertMealLogSchema.parse(req.body);
      const mealLog = await storage.createMealLog(mealLogData);
      res.json(mealLog);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Glycemic settings routes
  app.get("/api/glycemic-settings", async (req, res) => {
    try {
      const userId = req.query.userId as string || "1"; // Default to demo user
      const settings = await storage.getUserGlycemicSettings(userId);
      res.json(settings || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/glycemic-settings", async (req, res) => {
    try {
      const userId = req.body.userId || "1"; // Default to demo user
      const settingsData = insertUserGlycemicSettingsSchema.parse({
        ...req.body,
        userId
      });
      const settings = await storage.createOrUpdateGlycemicSettings(settingsData);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Barcode API routes
  app.get("/api/barcode/:code", async (req, res) => {
    try {
      const { code } = req.params;
      console.log(`🔍 Barcode lookup request: ${code}`);

      const { lookupBarcode } = await import("./services/barcodeService");
      const food = await lookupBarcode(code);

      if (!food) {
        console.log(`❌ Product not found: ${code}`);
        return res.status(404).json({ 
          error: "Product not found",
          message: `No product found for barcode: ${code}`,
          suggestions: [
            "Verify the barcode is correct",
            "Try scanning again", 
            "Add this product manually"
          ]
        });
      }

      // Transform to expected format for frontend
      const response = {
        food_id: food.id,
        barcode: food.barcode,
        name: food.name,
        brand: food.brand,
        serving_sizes: food.servingSizes,
        nutr_per_serving: food.nutrPerServing,
        verified: food.verified,
        source: food.source
      };

      console.log(`✅ Product found: ${food.name} from ${food.source}`);
      res.json(response);
    } catch (error: any) {
      console.error(`❌ Barcode lookup error:`, error);
      res.status(500).json({ 
        error: "Lookup failed",
        message: error.message 
      });
    }
  });

  // Shopping list add route removed

  // Food diary routes for barcode scanning
  app.post("/api/diary/log", async (req, res) => {
    try {
      const { 
        user_id = "1", 
        date_local, 
        meal_slot, 
        food_id, 
        barcode, 
        serving_label, 
        servings = 1 
      } = req.body;

      console.log(`📝 Diary log request:`, { user_id, date_local, meal_slot, food_id, servings });

      if (!date_local || !meal_slot || !food_id || !barcode) {
        return res.status(400).json({ 
          error: "Missing required fields",
          required: ["date_local", "meal_slot", "food_id", "barcode"]
        });
      }

      const { logFood } = await import("./services/barcodeService");
      const result = await logFood({
        userId: user_id,
        dateLocal: date_local,
        mealSlot: meal_slot,
        foodId: food_id,
        barcode,
        servingLabel: serving_label,
        servings: parseFloat(servings)
      });

      console.log(`✅ Food logged successfully for ${user_id}`);
      res.json(result);
    } catch (error: any) {
      console.error(`❌ Diary log error:`, error);
      res.status(500).json({ 
        error: "Failed to log food",
        message: error.message 
      });
    }
  });

  app.get("/api/diary/:user_id/:date_local", async (req, res) => {
    try {
      const { user_id, date_local } = req.params;
      console.log(`📊 Getting diary for ${user_id} on ${date_local}`);

      // TODO: Query database when schema is available
      // For now, return empty structure
      const entries: any[] = [];

      // Group by meal slot
      const grouped = entries.reduce((acc: any, entry: any) => {
        if (!acc[entry.mealSlot]) acc[entry.mealSlot] = [];
        acc[entry.mealSlot].push(entry);
        return acc;
      }, {} as Record<string, any[]>);

      // Calculate totals
      const { getDayTotals } = await import("./services/barcodeService");
      const totals = await getDayTotals(user_id, date_local);

      res.json({
        entries: grouped,
        totals
      });
    } catch (error: any) {
      console.error("Get diary error:", error);
      res.status(500).json({ error: "Failed to get diary entries" });
    }
  });

  // Food search route for manual entry
  app.get("/api/foods/search", async (req, res) => {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          error: "Query parameter required",
          message: "Provide ?q=search_term" 
        });
      }

      console.log(`🔍 Food search: "${query}"`);

      const { searchFoods } = await import("./services/barcodeService");
      const foods = await searchFoods(query, parseInt(limit as string));

      console.log(`✅ Found ${foods.length} foods for "${query}"`);
      res.json({ 
        query,
        results: foods,
        count: foods.length
      });
    } catch (error: any) {
      console.error(`❌ Food search error:`, error);
      res.status(500).json({ 
        error: "Search failed",
        message: error.message 
      });
    }
  });

  // Add new food route for unknown barcodes
  app.post("/api/foods/add", async (req, res) => {
    try {
      const { 
        barcode, 
        name, 
        brand, 
        serving_label, 
        serving_grams, 
        nutrition 
      } = req.body;

      console.log(`➕ Adding new food: ${name}`);

      if (!barcode || !name || !serving_label || !serving_grams || !nutrition) {
        return res.status(400).json({ 
          error: "Missing required fields",
          required: ["barcode", "name", "serving_label", "serving_grams", "nutrition"]
        });
      }

      const { addNewFood } = await import("./services/barcodeService");
      const food = await addNewFood({
        barcode,
        name,
        brand,
        servingLabel: serving_label,
        servingGrams: serving_grams,
        nutrition
      });

      console.log(`✅ New food added: ${food.name}`);
      res.json(food);
    } catch (error: any) {
      console.error(`❌ Add food error:`, error);
      res.status(500).json({ 
        error: "Failed to add food",
        message: error.message 
      });
    }
  });

  // Shopping List CRUD Routes - all removed

  // Shopping list bulk operations removed

  // Shopping list generation from meal plan removed

  // Weekly meal plan generation route for Step 5
  app.post("/api/users/:userId/meal-plan/generate", async (req, res) => {
    const userId = req.params.userId;
    const {
      diet,
      planDuration,
      mealsPerDay,
      snacksPerDay,
      selectedIngredients,
    } = req.body;

    try {
      const plan = await generateWeeklyMeals({
        userId,
        days: planDuration,
        mealTypes: ["breakfast", "lunch", "dinner", ...(snacksPerDay > 0 ? ["snack"] : [])] as any[],
        dietaryRestrictions: diet ? [diet] : [],
        allergies: [],
        medicalFlags: [],
        selectedIngredients: selectedIngredients || [],
      });

      res.status(200).json({ success: true, plan });
    } catch (error) {
      console.error("Error generating plan:", error);
      res.status(500).json({ success: false, error: "Failed to generate plan" });
    }
  });

  // Meal Planning Feature Routes
  // Craving Creator endpoints for WMC2 adapter
  app.post("/api/craving-creator/generate", async (req, res) => {
    try {
      const { userId, courseStyle, includeImage = false, variation = 0 } = req.body;

      console.log(`🎯 Craving Creator Generate: ${courseStyle} for user ${userId}`);

      const meal = await generateCravingMeal(
        courseStyle as any, // MealType
        `${courseStyle} meal${variation ? ` variation ${variation}` : ''}`,
        { userId: userId || "1" }
      );

      res.json(meal);
    } catch (error) {
      console.error("Craving Creator generation failed:", error);
      res.status(500).json({ error: "Failed to generate meal" });
    }
  });

  app.post("/api/craving-creator/regenerate", async (req, res) => {
    try {
      const { userId, courseStyle, includeImage = true } = req.body;

      console.log(`🔄 Craving Creator Regenerate: ${courseStyle} for user ${userId}`);

      const meal = await generateCravingMeal(
        courseStyle as any, // MealType
        `regenerate ${courseStyle} meal`,
        { userId: userId || "1" }
      );

      res.json(meal);
    } catch (error) {
      console.error("Craving Creator regeneration failed:", error);
      res.status(500).json({ error: "Failed to regenerate meal" });
    }
  });

  // 🔒🔒🔒 CRAVING CREATOR API LOCKDOWN - DO NOT MODIFY
  // Add the missing endpoint that the frontend expects
  app.post("/api/generate-craving-meal", async (req, res) => {
    try {
      const { craving, userId, medicalProfile, userCategories, generateImages, maxMeals } = req.body;

      console.log(`🎯 Generate Craving Meal: ${craving} for user ${userId}`);

      // Use the medical-aware craving creator service
      const { generateCravingMealWithProfile } = await import("./services/generators/cravingCreatorWrapped");

      const result = await generateCravingMealWithProfile(
        userId || "00000000-0000-0000-0000-000000000001",
        craving,
        {
          medicalProfile,
          generateImages: generateImages !== false,
          maxMeals: maxMeals || 3
        }
      );

      res.json(result);
    } catch (error) {
      console.error("Generate craving meal failed:", error);
      res.status(500).json({ error: "Failed to generate meal" });
    }
  });

  app.post("/api/meals/craving-creator", async (req, res) => {
    try {
      const { targetMealType, cravingInput, dietaryRestrictions, userId, servings = 1 } = req.body;

      // Validate servings (1-10)
      const validatedServings = Math.max(1, Math.min(10, parseInt(servings) || 1));

      const startTime = Date.now();
      console.log("🎯 Craving creator request:", { targetMealType, cravingInput, userId, servings: validatedServings });

      // Get user data for medical personalization
      let user = null;
      if (userId) {
        try {
          const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = dbUser || null;
        } catch (error) {
          console.log("Could not fetch user for meal personalization:", error);
        }
      }

      // Use unified meal pipeline (deterministic: cache → templates → fallback)
      const { generateCravingMealUnified } = await import("./services/unifiedMealPipeline");
      
      const result = await generateCravingMealUnified(
        cravingInput || "something delicious",
        targetMealType || "lunch",
        userId
      );
      
      if (!result.success || !result.meal) {
        throw new Error("Failed to generate meal");
      }
      
      const generatedMeal = {
        id: result.meal.id,
        name: result.meal.name,
        description: result.meal.description,
        ingredients: result.meal.ingredients,
        instructions: result.meal.instructions,
        nutrition: {
          calories: result.meal.calories,
          protein: result.meal.protein,
          carbs: result.meal.carbs,
          fat: result.meal.fat
        },
        medicalBadges: result.meal.medicalBadges || [],
        imageUrl: result.meal.imageUrl,
        servingSize: "1 serving"
      };

      // Scale ingredients and macros by serving size if > 1
      if (validatedServings > 1) {
        const meal = generatedMeal as any; // Type assertion for dynamic properties

        // Scale ingredient quantities
        if (meal.ingredients && Array.isArray(meal.ingredients)) {
          meal.ingredients = meal.ingredients.map((ing: any) => {
            const scaledIng = { ...ing };
            if (ing.quantity && !isNaN(parseFloat(ing.quantity))) {
              const originalQty = parseFloat(ing.quantity);
              scaledIng.quantity = originalQty * validatedServings;
            }
            return scaledIng;
          });
        }

        // Scale macros (top-level properties)
        if (meal.calories) meal.calories = meal.calories * validatedServings;
        if (meal.protein) meal.protein = meal.protein * validatedServings;
        if (meal.carbs) meal.carbs = meal.carbs * validatedServings;
        if (meal.fat) meal.fat = meal.fat * validatedServings;

        // Also scale nutrition object if it exists
        if (meal.nutrition) {
          if (meal.nutrition.calories) meal.nutrition.calories = meal.nutrition.calories * validatedServings;
          if (meal.nutrition.protein) meal.nutrition.protein = meal.nutrition.protein * validatedServings;
          if (meal.nutrition.carbs) meal.nutrition.carbs = meal.nutrition.carbs * validatedServings;
          if (meal.nutrition.fat) meal.nutrition.fat = meal.nutrition.fat * validatedServings;
        }

        // Update serving size description
        meal.servingSize = `${validatedServings} servings`;
        console.log(`📏 Scaled meal for ${validatedServings} servings`);
      }

      // Generate image for the meal
      try {
        const { generateImage } = await import("./services/imageService");
        const imageUrl = await generateImage({
          name: generatedMeal.name,
          description: generatedMeal.description,
          type: 'meal',
          style: 'homemade'
        });

        if (imageUrl) {
          generatedMeal.imageUrl = imageUrl;
          console.log("🖼️ Image generated for meal:", generatedMeal.name);
        }
      } catch (error) {
        console.error(`Failed to generate image for ${generatedMeal.name}:`, error);
      }

      // Add ingredients to shopping list
      if (generatedMeal.ingredients) {
        // TODO: Implement shopping list service integration
        console.log("Would add ingredients to shopping list:", generatedMeal.ingredients);
      }

      console.log("🍽️ Stable craving creator generated meal:", generatedMeal.name);
      console.log("🏥 Medical badges:", generatedMeal.medicalBadges.length);
      console.log("📊 Generation source:", result.source);

      // Record metrics for health endpoint
      const { recordGeneration } = await import("./services/aiHealthMetrics");
      recordGeneration('/api/meals/craving-creator', result.source as any, Date.now() - startTime);

      res.json({ 
        meal: generatedMeal,
        generationSource: result.source
      });
    } catch (error: any) {
      console.error("❌ Craving creator error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // NEW: Onboarding-enforced meal generation routes
  app.post("/api/meals/craving-creator-enforced", async (req, res) => {
    try {
      const { userId, cravingInput, overrides } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId required for onboarding enforcement" });
      }

      console.log("🛡️ Generating craving meal with medical validation for:", userId);

      const result = await generateCravingMealWithProfile(userId, cravingInput, overrides);

      console.log("✅ Medical badges applied:", result.meals[0]?.badges);
      res.json({ 
        meal: result.meals[0],
        constraints: result.constraints,
        medicalBadges: result.meals[0]?.badges || []
      });
    } catch (error: any) {
      console.error("❌ Enforced craving creator error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/meal-plans/generate-enforced", async (req, res) => {
    try {
      const { userId, overrides } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId required for onboarding enforcement" });
      }

      console.log("🛡️ Generating weekly meal plan with medical validation for:", userId);

      const meals = await generateWeeklyMeals(userId);

      console.log("✅ Generated", meals.length, "meals with medical badges");
      res.json({ 
        meals: meals,
        totalMedicalBadges: meals.reduce((total: number, meal: any) => total + (meal.badges?.length || 0), 0)
      });
    } catch (error: any) {
      console.error("❌ Enforced weekly meal plan error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🗑️ REMOVED: Duplicate fridge-rescue route (conflicts with line 253)
  // This old route was returning {meal: firstMeal} instead of {meals: allMeals}

  // Testosterone support meal plan generation
  app.post("/api/users/:userId/testosterone-meal-plan", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { testosteroneLevel, activityLevel } = req.body;

      // Get user data for medical personalization
      let user = null;
      if (userId) {
        try {
          const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = dbUser || null;
        } catch (error) {
          console.log("Could not fetch user for testosterone meal personalization:", error);
        }
      }

      const { generateTestosteroneSupportMeals } = await import("./services/testosteroneNutritionGenerator");
      const mealPlan = await generateTestosteroneSupportMeals({
        testosteroneLevel: parseInt(testosteroneLevel) || 500,
        activityLevel: activityLevel || "moderate",
        user: user || undefined
      });

      // Add ingredients from all generated meals to shopping list
      for (const meal of mealPlan.meals) {
        if (meal.ingredients) {
          const convertedIngredients = meal.ingredients.map(ing => ({
            name: ing.name,
            amount: parseFloat(ing.amount) || 1,
            unit: ing.unit,
            notes: ""
          }));
          // TODO: Implement shopping list service integration
          console.log("Would add testosterone support ingredients to shopping list:", convertedIngredients);
        }
      }

      console.log("💪 Testosterone support meal plan generated:", mealPlan.meals.length, "meals");
      console.log("🏥 Medical badges:", mealPlan.meals.reduce((total, meal) => total + meal.medicalBadges.length, 0));

      res.json(mealPlan);
    } catch (error: any) {
      console.error("❌ Testosterone meal plan error:", error);
      res.status(500).json({ error: "Failed to generate testosterone support meal plan" });
    }
  });

  // Pregnancy meal plan generation
  app.post("/api/users/:userId/pregnancy-meal-plan", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { trimester, weekOfPregnancy, symptoms } = req.body;

      // Get user data for medical personalization
      let user = null;
      if (userId) {
        try {
          const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = dbUser || null;
        } catch (error) {
          console.log("Could not fetch user for pregnancy meal personalization:", error);
        }
      }

      const { generatePregnancyMealPlan } = await import("./services/pregnancyNutritionGenerator");
      const mealPlan = await generatePregnancyMealPlan({
        trimester: parseInt(trimester) || 2,
        weekOfPregnancy: parseInt(weekOfPregnancy) || 20,
        symptoms: symptoms || [],
        user: user || undefined
      });

      // Add ingredients from all generated meals to shopping list
      for (const meal of mealPlan.meals) {
        if (meal.ingredients) {
          const convertedIngredients = meal.ingredients.map(ing => ({
            name: ing.name,
            amount: parseFloat(ing.amount) || 1,
            unit: ing.unit,
            notes: ""
          }));
          // TODO: Implement shopping list service integration
          console.log("Would add pregnancy nutrition ingredients to shopping list:", convertedIngredients);
        }
      }

      console.log("🤱 Pregnancy meal plan generated:", mealPlan.meals.length, "meals for trimester", trimester);
      console.log("🏥 Medical badges:", mealPlan.meals.reduce((total, meal) => total + meal.medicalBadges.length, 0));

      res.json(mealPlan);
    } catch (error: any) {
      console.error("❌ Pregnancy meal plan error:", error);
      res.status(500).json({ error: "Failed to generate pregnancy meal plan" });
    }
  });

  // Holiday Feast route removed - handled by dedicated router

  // Legacy route removed - using dedicated router

  // Family recipe parsing endpoint
  app.post("/api/holiday-family-recipe", async (req, res) => {
    try {
      const { name, description, userId } = req.body;

      if (!name || !description) {
        return res.status(400).json({ 
          message: "Recipe name and description are required" 
        });
      }

      const { parseFamilyRecipe } = await import("./services/familyRecipeParser");
      const parsedRecipe = await parseFamilyRecipe({ name, description });

      console.log("👨‍👩‍👧‍👦 Family recipe parsed:", parsedRecipe.name);
      console.log("🛒 Ingredients for shopping list:", parsedRecipe.ingredients.length);

      res.json(parsedRecipe);
    } catch (error: any) {
      console.error("❌ Family recipe parsing error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Image generation endpoint
  app.post("/api/generate-image", async (req, res) => {
    const { handleImageGeneration } = await import("./services/imageService");
    await handleImageGeneration(req, res);
  });

  // Weekly meal calendar endpoint
  app.post("/api/meals/weekly", async (req, res) => {
    try {
      const { userId, generateAll = true } = req.body;

      // Get user data for medical personalization
      let user = null;
      if (userId) {
        try {
          const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = dbUser || null;
        } catch (error) {
          console.log("Could not fetch user for weekly meals:", error);
        }
      }

      const generatedMeals = await generateWeeklyMeals({
        userId: userId || "1", 
        days: 7,
        mealTypes: ["breakfast", "lunch", "dinner"],
        dietaryRestrictions: user?.dietaryRestrictions || [],
        allergies: user?.allergies || [],
        medicalFlags: user?.healthConditions || []
      });

      console.log(`📅 Weekly meal plan generated: ${generatedMeals.length} meals`);
      res.json({ meals: generatedMeals });
    } catch (error: any) {
      console.error("❌ Weekly meals error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Kids meal generation endpoint - uses kidsLunchboxV1 for kid-friendly meals
  // NOTE: This route is also defined in index.ts (takes precedence before Vite middleware)
  app.post("/api/meals/kids", async (req, res) => {
    try {
      const { preferences, userId, servings = 1, allergies = [] } = req.body;
      const startTime = Date.now();

      console.log("🧒 KIDS ROUTE (routes.ts): Generating kid-friendly meal for:", preferences);

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

  // Hey AI Meal Creator endpoint - uses unifiedMealPipeline for stability
  app.post("/api/meals/ai-creator", async (req, res) => {
    try {
      const { cravingInput, userId } = req.body;
      const startTime = Date.now();

      console.log("🤖 AI meal creator request:", { cravingInput, userId });

      // Use unified pipeline (deterministic: cache → templates → fallback)
      const { generateCravingMealUnified } = await import("./services/unifiedMealPipeline");
      
      const result = await generateCravingMealUnified(
        cravingInput || "something delicious",
        "lunch",
        userId
      );
      
      if (!result.success || !result.meal) {
        throw new Error("Failed to generate meal");
      }
      
      const generatedMeal = {
        id: result.meal.id,
        name: result.meal.name,
        description: result.meal.description,
        ingredients: result.meal.ingredients,
        instructions: result.meal.instructions,
        nutrition: {
          calories: result.meal.calories,
          protein: result.meal.protein,
          carbs: result.meal.carbs,
          fat: result.meal.fat
        },
        medicalBadges: result.meal.medicalBadges || [],
        imageUrl: result.meal.imageUrl,
        servingSize: "1 serving"
      };

      console.log("🤖 AI meal creator generated:", generatedMeal.name);
      console.log("📊 Generation source:", result.source);

      // Record metrics for health endpoint
      const { recordGeneration } = await import("./services/aiHealthMetrics");
      recordGeneration('/api/meals/ai-creator', result.source as any, Date.now() - startTime);

      res.json({ meal: generatedMeal });
    } catch (error: any) {
      console.error("❌ AI meal creator error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Single meal regeneration endpoint - uses unifiedMealPipeline for stability
  app.post("/api/meals/one/regenerate", async (req, res) => {
    try {
      const { userId, targetMealType, dietaryRestrictions = [], allergies = [], medicalFlags = [], avoidNames = [] } = req.body;
      const startTime = Date.now();

      console.log("🔄 Single meal regeneration request:", { targetMealType, userId });

      // Use unified pipeline (deterministic: cache → templates → fallback)
      const { generateCravingMealUnified } = await import("./services/unifiedMealPipeline");
      
      const result = await generateCravingMealUnified(
        "something delicious", // Generic craving for regeneration
        targetMealType || "lunch",
        userId
      );
      
      if (!result.success || !result.meal) {
        throw new Error("Failed to regenerate meal");
      }
      
      const generatedMeal = {
        id: result.meal.id,
        name: result.meal.name,
        description: result.meal.description,
        ingredients: result.meal.ingredients,
        instructions: result.meal.instructions,
        nutrition: {
          calories: result.meal.calories,
          protein: result.meal.protein,
          carbs: result.meal.carbs,
          fat: result.meal.fat
        },
        medicalBadges: result.meal.medicalBadges || [],
        imageUrl: result.meal.imageUrl,
        servingSize: "1 serving"
      };

      console.log("🔄 Single meal regenerated:", generatedMeal.name);
      console.log("📊 Generation source:", result.source);

      // Record metrics for health endpoint
      const { recordGeneration } = await import("./services/aiHealthMetrics");
      recordGeneration('/api/meals/one/regenerate', result.source as any, Date.now() - startTime);

      res.json({ ok: true, data: generatedMeal });
    } catch (error: any) {
      console.error("❌ Single meal regeneration error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });



  app.post("/api/meals/potluck", async (req, res) => {
    try {
      const { userId, servingsNeeded, eventType, selectedDishName } = req.body;

      // Get user data for medical personalization
      let user = null;
      if (userId) {
        try {
          const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = dbUser || null;
        } catch (error) {
          console.log("Could not fetch user for potluck personalization:", error);
        }
      }

      // Use stable meal generator for potluck meals
      const generatedMeal = await generateCravingMeal(
        "dinner",
        `potluck ${selectedDishName} for ${servingsNeeded} servings at ${eventType}`,
        {
          userId: userId || "1",
          mealTypes: ["dinner"],
          dietaryRestrictions: user?.dietaryRestrictions || [],
          allergies: user?.allergies || [],
          medicalFlags: user?.healthConditions || []
        }
      );

      // Add ingredients to shopping list
      if (generatedMeal.ingredients) {
        // TODO: Implement shopping list service integration
        console.log("Would add potluck meal ingredients to shopping list:", generatedMeal.ingredients);
      }

      console.log("🥘 Potluck generated meal:", generatedMeal.name);
      console.log("🏥 Medical badges:", generatedMeal.medicalBadges.length);

      res.json({ meal: generatedMeal });
    } catch (error: any) {
      console.error("❌ Potluck error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // NOTE: Restaurant routes (/api/restaurants/guide, /api/restaurants/analyze-menu) 
  // are now handled by the dedicated router in server/routes/restaurants.ts
  // mounted at app.use("/api/restaurants", ...) in server/index.ts
  // Duplicate handlers removed to fix production 404 errors

  // Meal Reminder API Routes
  app.post("/api/users/:userId/reminders", async (req, res) => {
    try {
      const reminderData = insertMealReminderSchema.parse({
        ...req.body,
        userId: req.params.userId
      });

      const reminder = await storage.createMealReminder(reminderData);

      // Schedule the reminder
      await reminderService.scheduleReminder(reminder.id);

      res.json(reminder);
    } catch (error: any) {
      console.error("Failed to create meal reminder:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:userId/reminders", async (req, res) => {
    try {
      const reminders = await storage.getMealReminders(req.params.userId);
      res.json(reminders);
    } catch (error: any) {
      console.error("Failed to get meal reminders:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:userId/reminders/:reminderId", async (req, res) => {
    try {
      const { userId, reminderId } = req.params;

      // Verify the reminder belongs to the user
      const reminders = await storage.getMealReminders(userId);
      const reminder = reminders.find(r => r.id === reminderId);

      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      // Cancel the scheduled reminder
      reminderService.cancelReminder(reminderId);

      // Delete from storage
      const deleted = await storage.deleteMealReminder(reminderId);

      if (deleted) {
        res.json({ message: "Reminder cancelled successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete reminder" });
      }
    } catch (error: any) {
      console.error("Failed to delete meal reminder:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:userId/reminders/:reminderId", async (req, res) => {
    try {
      const { userId, reminderId } = req.params;

      // Verify the reminder belongs to the user
      const reminders = await storage.getMealReminders(userId);
      const reminder = reminders.find(r => r.id === reminderId);

      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      const updatedReminder = await storage.updateMealReminder(reminderId, req.body);

      if (updatedReminder) {
        // Cancel old reminder and schedule new one
        reminderService.cancelReminder(reminderId);
        if (updatedReminder.reminderEnabled && updatedReminder.isActive) {
          await reminderService.scheduleReminder(reminderId);
        }

        res.json(updatedReminder);
      } else {
        res.status(500).json({ message: "Failed to update reminder" });
      }
    } catch (error: any) {
      console.error("Failed to update meal reminder:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Debug endpoint to list all scheduled reminders
  app.get("/api/debug/reminders", async (req, res) => {
    try {
      const scheduledReminders = reminderService.getScheduledReminders();
      res.json({
        totalScheduled: scheduledReminders.length,
        reminders: scheduledReminders
      });
    } catch (error: any) {
      console.error("Failed to get debug reminders:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Meal notifications endpoint
  app.put("/api/meals/:mealId/notifications", async (req, res) => {
    try {
      const { mealId } = req.params;
      const { enabled, leadTimeMinutes } = req.body || {};
      const update: any = {};

      if (typeof enabled === "boolean") {
        update.notificationsEnabled = enabled;
      }
      if (leadTimeMinutes === null || typeof leadTimeMinutes === "number") {
        update.notificationLeadTimeMin = leadTimeMinutes;
      }

      await db.update(meals).set(update).where(eq(meals.id, mealId));
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Failed to update meal notifications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Alcohol recommendations endpoint (handles both old format and new beer pairing format)
  app.post("/api/recommendations/alcohol", async (req, res) => {
    try {
      // Check if this is the new beer pairing format
      const { type, mealType, cuisine, mainIngredient, occasion, priceRange, preferences, abvRange } = req.body;

      if (type === "beer" && mealType) {
        // New beer pairing format - use OpenAI
        if (!process.env.OPENAI_API_KEY) {
          return res.status(500).json({ ok: false, error: "OpenAI API key not configured" });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build the prompt for beer pairing
        const flavorBias = preferences?.flavorBias || "balanced";
        const calorieConscious = preferences?.calorieConscious || false;
        const abvMin = abvRange?.min || 4.0;
        const abvMax = abvRange?.max || 8.0;

        const prompt = `You are an expert beer sommelier and cicerone. Provide 3 beer pairing recommendations for the following meal:

Meal Type: ${mealType}
${cuisine ? `Cuisine: ${cuisine}` : ''}
${mainIngredient ? `Main Ingredient: ${mainIngredient}` : ''}
${occasion ? `Occasion: ${occasion}` : ''}
${priceRange ? `Price Range: ${priceRange}` : ''}
Flavor Preference: ${flavorBias}
${calorieConscious ? 'Prefer lower calorie options' : ''}
ABV Range: ${abvMin}% - ${abvMax}%

Provide recommendations in JSON format with the following structure:
{
  "recommendations": [
    {
      "name": "Beer name",
      "style": "Beer style (e.g., IPA, Stout, Lager)",
      "abv": 5.5,
      "ibu": 35,
      "brewery": "Example Brewery (optional)",
      "region": "Region (optional)",
      "glassware": "Recommended glass type",
      "servingTemp": "Serving temperature (e.g., 45-50°F)",
      "calories": 150,
      "pairingReason": "Why this beer pairs well with the meal",
      "notes": ["Flavor note 1", "Flavor note 2", "Flavor note 3"],
      "alternatives": [
        {"name": "Alternative beer 1", "style": "Style"},
        {"name": "Alternative beer 2", "style": "Style"}
      ]
    }
  ]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert beer sommelier and cicerone providing beer pairing recommendations. Always respond with valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        });

        const result = JSON.parse(completion.choices[0].message.content || '{"recommendations": []}');

        return res.json({
          ok: true,
          recommendations: result.recommendations
        });
      }

      // Old format - use existing services
      const { category, goal, pairing, taste, userProfile } = req.body;

      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      const {
        generateWineRecommendation,
        generateLiquorRecommendation,
        generateBeerRecommendation,
        generateMocktailRecommendation,
        generateMixerRecommendation,
        generateCigarRecommendation,
        generateWeaningRecommendation
      } = await import("./services/alcoholRecommendations");

      let recommendation;

      switch (category.toLowerCase()) {
        case 'wine':
          recommendation = await generateWineRecommendation(goal, pairing, taste, userProfile);
          break;
        case 'liquor':
          recommendation = await generateLiquorRecommendation(goal, pairing, taste, userProfile);
          break;
        case 'beer':
          recommendation = await generateBeerRecommendation(goal, pairing, taste, userProfile);
          break;
        case 'mocktail':
          recommendation = await generateMocktailRecommendation(goal, pairing, taste, userProfile);
          break;
        case 'mixer':
          recommendation = await generateMixerRecommendation(goal, pairing, taste, userProfile);
          break;
        case 'cigar':
          recommendation = await generateCigarRecommendation(goal, pairing, taste, userProfile);
          break;
        case 'weaning':
          recommendation = await generateWeaningRecommendation(goal, pairing, taste, userProfile);
          break;
        default:
          return res.status(400).json({ error: "Invalid category" });
      }

      // Generate image for the recommendation
      try {
        const { generateImage } = await import("./services/imageService");
        const imageUrl = await generateImage({
          name: recommendation.name,
          description: recommendation.description || recommendation.name,
          type: 'beverage'
        });

        if (imageUrl) {
          recommendation.imageUrl = imageUrl;
        }
      } catch (error) {
        console.error(`Failed to generate image for ${recommendation.name}:`, error);
      }

      res.json(recommendation);
    } catch (error) {
      console.error("Alcohol recommendation error:", error);
      res.status(500).json({ error: "Failed to generate recommendation" });
    }
  });

  // Kids Veggie Explorer API routes
  app.get("/api/kids/veggie-explorer/veggies", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { kidsVegetablesCatalog } = await import("@shared/schema");

      // Check if catalog is empty and seed it
      const existingVeggies = await db.select().from(kidsVegetablesCatalog);
      if (existingVeggies.length === 0) {
        const veggieData = [
          {
            id: "broccoli",
            name: "Broccoli",
            kidFriendlyName: "Green Power Trees",
            colorCategory: "green",
            funFact: "Broccoli has more vitamin C than an orange!",
            recommendedIntro: "Try with melted cheese or ranch dip.",
            imageUrl: "🥦"
          },
          {
            id: "carrots",
            name: "Carrots",
            kidFriendlyName: "X-Ray Vision Carrots",
            colorCategory: "orange",
            funFact: "Carrots were originally purple! Orange ones were created in the 1600s.",
            recommendedIntro: "Start with baby carrots and hummus.",
            imageUrl: "🥕"
          },
          {
            id: "bell-peppers",
            name: "Bell Peppers",
            kidFriendlyName: "Rainbow Rings",
            colorCategory: "multi",
            funFact: "Red peppers are just green peppers that stayed on the plant longer!",
            recommendedIntro: "Try sweet red peppers cut into strips.",
            imageUrl: "🫑"
          },
          {
            id: "sweet-potato",
            name: "Sweet Potato",
            kidFriendlyName: "Orange Treasure",
            colorCategory: "orange",
            funFact: "Sweet potatoes are packed with vitamin A for healthy eyes!",
            recommendedIntro: "Bake into crispy fries with a pinch of cinnamon.",
            imageUrl: "🍠"
          },
          {
            id: "cucumber",
            name: "Cucumber",
            kidFriendlyName: "Cool Crunchers",
            colorCategory: "green",
            funFact: "Cucumbers are 96% water - like eating a healthy drink!",
            recommendedIntro: "Slice into rounds with a sprinkle of salt.",
            imageUrl: "🥒"
          },
          {
            id: "cherry-tomatoes",
            name: "Cherry Tomatoes",
            kidFriendlyName: "Pop Berries",
            colorCategory: "red",
            funFact: "Tomatoes are actually fruits, not vegetables!",
            recommendedIntro: "Start with sweet cherry varieties.",
            imageUrl: "🍅"
          }
        ];

        await db.insert(kidsVegetablesCatalog).values(veggieData);
      }

      const veggies = await db.select().from(kidsVegetablesCatalog);
      res.json({ data: veggies });
    } catch (error) {
      console.error("Error loading veggie catalog:", error);
      res.status(500).json({ error: "Failed to load vegetables" });
    }
  });

  app.post("/api/kids/veggie-explorer/log", async (req, res) => {
    try {
      const { userId, vegetableId, portionStage, tryMethod } = req.body;

      if (!userId || !vegetableId || !portionStage || !tryMethod) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { db } = await import("./db");
      const { kidsVeggieExplorer } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // Check if user has already tried this vegetable
      const [existingEntry] = await db
        .select()
        .from(kidsVeggieExplorer)
        .where(and(
          eq(kidsVeggieExplorer.userId, userId),
          eq(kidsVeggieExplorer.vegetableId, vegetableId)
        ));

      if (existingEntry) {
        // Update existing entry
        await db
          .update(kidsVeggieExplorer)
          .set({
            tries: existingEntry.tries + 1,
            lastPortionStage: portionStage,
            lastTryMethod: tryMethod,
            updatedAt: new Date()
          })
          .where(eq(kidsVeggieExplorer.id, existingEntry.id));
      } else {
        // Create new entry
        await db.insert(kidsVeggieExplorer).values({
          userId,
          vegetableId,
          tries: 1,
          lastPortionStage: portionStage,
          lastTryMethod: tryMethod
        });
      }

      // Calculate XP points (more points for bigger portions)
      const pointsMap: Record<string, number> = {
        "Tiny Taste": 5,
        "Half Bite": 10,
        "Full Bite": 15,
        "Small Serving": 25,
        "Grown-Up Serving": 50
      };
      const points = pointsMap[portionStage] || 10;

      res.json({ ok: true, points });
    } catch (error) {
      console.error("Error logging veggie try:", error);
      res.status(500).json({ error: "Failed to log try" });
    }
  });

  app.get("/api/kids/veggie-explorer/:userId/progress", async (req, res) => {
    try {
      const { userId } = req.params;
      const { db } = await import("./db");
      const { kidsVeggieExplorer, kidsVegetablesCatalog } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const progress = await db
        .select({
          vegetableId: kidsVeggieExplorer.vegetableId,
          tries: kidsVeggieExplorer.tries,
          lastPortionStage: kidsVeggieExplorer.lastPortionStage,
          lastTryMethod: kidsVeggieExplorer.lastTryMethod,
          veggieName: kidsVegetablesCatalog.kidFriendlyName,
          colorCategory: kidsVegetablesCatalog.colorCategory
        })
        .from(kidsVeggieExplorer)
        .leftJoin(kidsVegetablesCatalog, eq(kidsVeggieExplorer.vegetableId, kidsVegetablesCatalog.id))
        .where(eq(kidsVeggieExplorer.userId, userId));

      res.json({ data: progress });
    } catch (error) {
      console.error("Error loading veggie progress:", error);
      res.status(500).json({ error: "Failed to load progress" });
    }
  });

  // Meal Logging API Routes
  app.post("/api/meal-logs", async (req, res) => {
    try {
      // Transform date if it's a string
      const transformedBody = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date()
      };

      const mealLogData = insertMealLogSchema.parse(transformedBody);
      const mealLog = await storage.createMealLog(mealLogData);
      console.log("✅ Meal logged successfully:", mealLog.id);
      res.json(mealLog);
    } catch (error: any) {
      console.error("❌ Failed to log meal:", error);
      res.status(400).json({ error: "Failed to log meal", details: error.message });
    }
  });

  app.get("/api/meal-logs/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      const mealLogs = await storage.getMealLogs(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(mealLogs);
    } catch (error: any) {
      console.error("❌ Failed to get meal logs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shopping List API Routes - all removed

  // Shopping list by userId route removed - all shopping functionality eliminated

  // All shopping list routes removed - complete elimination

  // Shopping list clear-all and consolidate routes removed

  // Add ingredients from meal plan to shopping list

  // AI-powered shopping list analysis endpoint

  // Export shopping list as CSV

  // Helper function to get meal ingredients database
function getMealIngredientsDatabase() {
  return {
    "Grilled Chicken & Quinoa Bowl": [
      { item: "Chicken breast", amount: 6, unit: "oz" },
      { item: "Quinoa", amount: 1, unit: "cup" },
      { item: "Mixed vegetables", amount: 2, unit: "cups" },
      { item: "Olive oil", amount: 2, unit: "tbsp" }
    ],
    "Salmon Avocado Salad": [
      { item: "Salmon fillet", amount: 5, unit: "oz" },
      { item: "Avocado", amount: 1, unit: "whole" },
      { item: "Mixed greens", amount: 3, unit: "cups" },
      { item: "Cherry tomatoes", amount: 1, unit: "cup" },
      { item: "Cucumber", amount: 0.5, unit: "cup" }
    ],
    "Turkey Meatballs with Sweet Potato": [
      { item: "Ground turkey", amount: 5, unit: "oz" },
      { item: "Sweet potato", amount: 1, unit: "large" },
      { item: "Onion", amount: 0.5, unit: "whole" },
      { item: "Garlic", amount: 2, unit: "cloves" },
      { item: "Breadcrumbs", amount: 0.25, unit: "cup" }
    ],
    "Greek Yogurt Parfait": [
      { item: "Greek yogurt", amount: 1, unit: "cup" },
      { item: "Berries", amount: 0.5, unit: "cup" },
      { item: "Granola", amount: 0.25, unit: "cup" },
      { item: "Honey", amount: 1, unit: "tbsp" }
    ],
    "Lemon Herb Cod": [
      { item: "Cod fillet", amount: 6, unit: "oz" },
      { item: "Lemon", amount: 1, unit: "whole" },
      { item: "Fresh herbs", amount: 2, unit: "tbsp" },
      { item: "Brown rice", amount: 0.5, unit: "cup" }
    ],
    "Beef Stir Fry": [
      { item: "Beef strips", amount: 5, unit: "oz" },
      { item: "Broccoli", amount: 1, unit: "cup" },
      { item: "Bell peppers", amount: 1, unit: "cup" },
      { item: "Soy sauce", amount: 2, unit: "tbsp" },
      { item: "Sesame oil", amount: 1, unit: "tsp" }
    ]
  };
}


  // Daily Motivation API endpoint  
  app.get("/api/ai/daily-motivation", async (req, res) => {
    try {
      const { userId = "1", name = "friend", seed = "default" } = req.query;
      const today = new Date().toDateString();

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `Generate a personalized, uplifting daily motivation quote for ${name}. Make it encouraging about their health and wellness journey. Keep it under 50 words and make it inspiring.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.7,
        seed: (seed as string).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0) // Convert seed to number
      });

      const personalizedQuote = response.choices[0].message.content?.trim();

      res.json({ 
        quote: personalizedQuote || "Every healthy choice you make today builds the strong, vibrant future you deserve.",
        date: today,
        personalized: true
      });

    } catch (error) {
      console.error("Error generating daily motivation:", error);
      // Fallback to a generic motivational quote if OpenAI fails
      const fallbackQuotes = [
        "Every healthy choice you make today builds the strong, vibrant future you deserve.",
        "Your wellness journey is unique and beautiful - celebrate every small victory.",
        "Nourish your body with intention, fuel your dreams with determination.",
        "Progress over perfection - every step forward counts in your health journey.",
        "You have the power to transform your health one meal, one choice at a time."
      ];

      const today = new Date().toDateString();
      const dailyIndex = Math.abs(today.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % fallbackQuotes.length;

      res.json({ 
        quote: fallbackQuotes[dailyIndex],
        date: today,
        personalized: false
      });
    }
  });

  // Intelligent Mental Health Support AI endpoint
  app.post("/api/ai/mental-health-support", async (req, res) => {
    try {
      const { message, context, userId = "1" } = req.body;

      // Mental health support - simplified response for now
      // TODO: Implement full mental health service
      const supportResponse = `Thank you for sharing. I'm here to support you. Remember that taking care of your mental health is just as important as your physical health.`;

      const result = {
        response: supportResponse,
        conversation: {
          id: `conv-${Date.now()}`
        }
      };

      console.log(`🧠 Intelligent mental health support provided for user: ${userId}`);

      res.json({
        response: result.response,
        timestamp: new Date().toISOString(),
        context: context,
        conversationId: result.conversation.id
      });
    } catch (error: any) {
      console.error("❌ Mental health support error:", error);
      res.status(500).json({ 
        message: "I'm experiencing some technical difficulties right now, but I want you to know that reaching out shows real strength. Please try again in a moment, or consider speaking with a trusted friend or professional if you need immediate support."
      });
    }
  });

  // Get conversation history endpoint
  app.get("/api/mental-health/history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      // TODO: Implement conversation history
      const conversations: any[] = [];
      res.json({ conversations });
    } catch (error: any) {
      console.error("❌ Error fetching conversation history:", error);
      res.status(500).json({ message: "Failed to fetch conversation history" });
    }
  });

  // Rate conversation endpoint
  app.post("/api/mental-health/rate/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { rating } = req.body;
      // TODO: Implement conversation rating
      console.log(`Rating conversation ${conversationId}: ${rating}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("❌ Error rating conversation:", error);
      res.status(500).json({ message: "Failed to rate conversation" });
    }
  });

  // Voice transcription endpoint using OpenAI Whisper
  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/voice/transcribe', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: 'OpenAI API key not configured' });
      }

      console.log('🎤 Transcribing audio file...');

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Convert buffer to file-like object for OpenAI
      const audioFile = new File([req.file.buffer], 'audio.wav', { type: 'audio/wav' });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });

      console.log('✅ Transcription result:', transcription.text);
      res.json({ transcript: transcription.text });
    } catch (error) {
      console.error('❌ Transcription error:', error);
      res.status(500).json({ error: 'Failed to transcribe audio' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Test SMS endpoint for verification
  // ──────────────────────────────────────────────────────────────────────────────
  app.post("/api/test-sms", async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Phone number and message required" });
      }

      // Import SMS service
      const { sendSMS } = await import("./smsService");

      console.log(`🧪 Testing SMS to ${phoneNumber}: ${message}`);
      const success = await sendSMS(phoneNumber, message);

      if (success) {
        res.json({ success: true, message: "SMS sent successfully" });
      } else {
        res.status(500).json({ success: false, error: "Failed to send SMS" });
      }
    } catch (error: any) {
      console.error("❌ Test SMS error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Voice command parsing endpoint
  app.post('/api/voice/parse', async (req, res) => {
    try {
      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: 'Transcript required' });
      }

      console.log('🎯 Parsing voice command:', transcript);

      // Import and use the voice command parser
      const { VoiceCommandParser } = await import('./voiceCommandParser.js');
      const parser = new VoiceCommandParser();

      const result = await parser.parseCommand(transcript, '1'); // TODO: Get actual user ID from session
      console.log('✅ Voice command parsed:', result);

      res.json(result);
    } catch (error) {
      console.error('❌ Voice parsing error:', error);
      res.status(500).json({ 
        action: 'error',
        speech: "I'm sorry, I didn't understand that. Could you try again?",
        error: 'Failed to parse voice command' 
      });
    }
  });

  // Voice meal logging endpoint - directly logs meals with time parsing
  app.post('/api/voice/log-meal', async (req, res) => {
    try {
      const { transcript, userId = '1' } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: 'Transcript required' });
      }

      console.log('🍽️ Voice meal logging:', transcript);

      // Use the same time parsing logic as in meal logs
      const parseTimeFromTextToToday = (text: string, today = new Date()): Date | null => {
        const twelve = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([AaPp][Mm])\b/);
        if (twelve) {
          let hour = parseInt(twelve[1], 10);
          const minute = twelve[2] ? parseInt(twelve[2], 10) : 0;
          const ampm = twelve[3].toLowerCase();
          if (ampm === "pm" && hour !== 12) hour += 12;
          if (ampm === "am" && hour === 12) hour = 0;
          const d = new Date(today);
          d.setHours(hour, minute, 0, 0);
          return d;
        }
        const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (twentyFour) {
          const hour = parseInt(twentyFour[1], 10);
          const minute = parseInt(twentyFour[2], 10);
          const d = new Date(today);
          d.setHours(hour, minute, 0, 0);
          return d;
        }
        const loose = text.match(/\bat\s*(1[0-2]|0?[1-9])\s*([AaPp][Mm])\b/);
        if (loose) {
          let hour = parseInt(loose[1], 10);
          const ampm = loose[2].toLowerCase();
          if (ampm === "pm" && hour !== 12) hour += 12;
          if (ampm === "am" && hour === 12) hour = 0;
          const d = new Date(today);
          d.setHours(hour, 0, 0, 0);
          return d;
        }
        return null;
      }

      // Parse time from the transcript
      const parsedTime = parseTimeFromTextToToday(transcript);
      const mealTime = parsedTime || new Date();

      // Extract meal description from transcript
      let description = transcript.trim();

      // If description is too short, use the original transcript
      if (description.length < 10) {
        description = transcript;
      }

      // Save to database using the same logic as regular meal logs
      const dateString = mealTime.toISOString().split('T')[0];
      const hour = mealTime.getHours();
      let mealSlot = "snack";
      if (hour >= 6 && hour < 11) mealSlot = "breakfast";
      else if (hour >= 11 && hour < 16) mealSlot = "lunch";
      else if (hour >= 16 && hour < 22) mealSlot = "dinner";

      const [newMealLog] = await db
        .insert(mealLogsEnhanced)
        .values({
          userId,
          customName: description,
          date: dateString,
          mealSlot,
          source: "manual"
        })
        .returning();

      console.log('✅ Voice meal logged:', newMealLog);

      // Format response time for speech
      const timeStr = mealTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });

      const speechResponse = parsedTime 
        ? `Perfect! I've logged your meal at ${timeStr}. ${description}`
        : `Got it! I've logged your meal for right now: ${description}`;

      res.json({
        action: 'mealLogged',
        speech: speechResponse,
        data: {
          mealLog: newMealLog,
          parsedTime: parsedTime ? timeStr : null
        }
      });

    } catch (error) {
      console.error('❌ Voice meal logging error:', error);
      res.status(500).json({ 
        action: 'error',
        speech: "Sorry, I couldn't log your meal right now. Please try again.",
        error: 'Failed to log meal from voice command' 
      });
    }
  });

  // Glycemic settings routes
  app.post("/api/glycemic-settings", async (req, res) => {
    try {
      const { bloodGlucose, preferredCarbs, defaultPortion } = req.body;
      const userId = "1"; // TODO: Get from session/auth

      await saveGlycemicSettings({
        userId,
        bloodGlucose,
        preferredCarbs: preferredCarbs || [],
        defaultPortion: defaultPortion || 1.0
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save glycemic settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.get("/api/glycemic-settings", async (req, res) => {
    try {
      const userId = "1"; // TODO: Get from session/auth
      const settings = await getGlycemicSettings(userId);
      res.json(settings || { bloodGlucose: null, preferredCarbs: [], defaultPortion: 1.0 });
    } catch (error) {
      console.error("Failed to load glycemic settings:", error);
      res.status(500).json({ error: "Failed to load settings" });
    }
  });

  // Mount water logs routes
  const waterLogsRouter = (await import("./routes/waterLogs")).default;
  app.use("/api", waterLogsRouter);

  // POST /api/meal-plan-archive - Direct route to avoid Vite middleware interference
  app.post("/api/meal-plan-archive", async (req, res) => {
    try {
      console.log("🎯 MEAL PLAN ARCHIVE ROUTE HIT DIRECTLY!");
      const userId = "test-user-123"; // Demo user ID - in real app would come from auth

      console.log("Received meal plan data:", JSON.stringify(req.body, null, 2));

      // Create archive entry with correct aiMealPlanArchive schema structure
      const mealPlanData = {
        userId,
        title: req.body.title || "AI Generated Meal Plan",
        dietOverride: req.body.dietOverride || null,
        durationDays: req.body.durationDays || 7,
        mealsPerDay: req.body.mealsPerDay || 3,
        snacksPerDay: req.body.snacksPerDay || 0,
        selectedIngredients: req.body.selectedIngredients || [],
        schedule: req.body.schedule || [],
        slots: req.body.slots || [],
        status: req.body.status || "accepted"
      };

      console.log("Mapped meal plan data:", JSON.stringify(mealPlanData, null, 2));

      const [newPlan] = await db
        .insert(aiMealPlanArchive)
        .values(mealPlanData)
        .returning();

      console.log("Successfully created meal plan:", newPlan.id);
      res.status(201).json(newPlan);
    } catch (error) {
      console.error("Error creating meal plan:", error);
      console.error("Request body:", req.body);

      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      res.status(400).json({ 
        error: "Failed to create meal plan",
        details: error instanceof Error ? error.message : String(error),
        requestBody: req.body
      });
    }
  });

  // Import and mount meal plan archive routes (keeping original as backup)
  const mealPlanArchiveRoutes = (await import("./routes/mealPlanArchive.routes")).default;
  app.use("/api", mealPlanArchiveRoutes);

  // Import and mount phone verification routes
  const phoneRouter = (await import("./routes/phone")).default;
  const twilioInboundRouter = (await import("./routes/twilioInbound")).default;
  app.use("/api", phoneRouter);
  app.use("/api", twilioInboundRouter);

  // Barcode Scanner API - Open Food Facts integration
  app.get("/api/barcode/:code", async (req, res) => {
    try {
      const { code } = req.params;
      console.log(`🔍 Looking up barcode: ${code}`);

      // Validate barcode format (basic check)
      if (!code || code.length < 8) {
        return res.status(400).json({ error: "Invalid barcode format" });
      }

      // Call Open Food Facts API
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await response.json();

      if (!data || data.status === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      const product = data.product;

      // Extract nutrition data (per 100g by default)
      const nutriments = product.nutriments || {};
      const serving = product.serving_size || "100g";

      // Calculate serving size multiplier
      let servingMultiplier = 1;
      const servingMatch = serving.match(/(\d+(?:\.\d+)?)/);
      if (servingMatch && product.serving_size) {
        servingMultiplier = parseFloat(servingMatch[1]) / 100;
      }

      const foodData = {
        name: product.product_name || product.generic_name || "Unknown Product",
        brand: product.brands || undefined,
        servingDesc: serving,
        calories: nutriments["energy-kcal_100g"] ? Math.round(nutriments["energy-kcal_100g"] * servingMultiplier) : null,
        protein: nutriments["proteins_100g"] ? Math.round(nutriments["proteins_100g"] * servingMultiplier * 10) / 10 : null,
        carbs: nutriments["carbohydrates_100g"] ? Math.round(nutriments["carbohydrates_100g"] * servingMultiplier * 10) / 10 : null,
        fat: nutriments["fat_100g"] ? Math.round(nutriments["fat_100g"] * servingMultiplier * 10) / 10 : null
      };

      console.log(`✅ Found product: ${foodData.name} - ${foodData.calories || 'N/A'} kcal`);
      res.json(foodData);

    } catch (error: any) {
      console.error("❌ Barcode lookup error:", error);
      res.status(500).json({ error: "Failed to lookup product", details: error.message });
    }
  });

  // Meal Log API - Enhanced version with barcode support
  app.post("/api/meal-log", async (req, res) => {
    try {
      const { userId, localDate, mealSlot, barcode, servings, customName } = req.body;

      if (!userId || !localDate || !mealSlot) {
        return res.status(400).json({ error: "Missing required fields: userId, localDate, mealSlot" });
      }

      console.log(`🍽️ Adding meal log entry: ${userId} | ${localDate} | ${mealSlot} | barcode: ${barcode}`);

      let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, sodium = 0, sugar = 0;
      let source = "manual";
      let name = customName || "Manual Entry";

      // If barcode provided, fetch nutrition data
      if (barcode) {
        try {
          const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
          const data = await response.json();

          if (data && data.status === 1) {
            const product = data.product;
            const servingSize = servings || 1;

            name = product.product_name || product.generic_name || `Product ${barcode}`;
            source = "barcode";

            // Calculate nutrition values per serving
            const nutriments = product.nutriments || {};
            calories = (nutriments["energy-kcal_100g"] || 0) * servingSize;
            protein = (nutriments["proteins_100g"] || 0) * servingSize;
            carbs = (nutriments["carbohydrates_100g"] || 0) * servingSize;
            fat = (nutriments["fat_100g"] || 0) * servingSize;
            fiber = (nutriments["fiber_100g"] || 0) * servingSize;
            sodium = (nutriments["sodium_100g"] || 0) * servingSize * 1000; // Convert g to mg
            sugar = (nutriments["sugars_100g"] || 0) * servingSize;

            console.log(`✅ Found nutrition data: ${name} - ${Math.round(calories)} kcal`);
          }
        } catch (barcodeError) {
          console.error("Barcode lookup failed, using manual entry:", barcodeError);
        }
      }

      // Insert meal log entry
      const [mealLog] = await db
        .insert(mealLogsEnhanced)
        .values({
          userId,
          date: localDate,
          mealSlot,
          source,
          barcode: barcode || null,
          customName: customName || null,
          servings: String(servings || 1),
          calories: String(Math.round(calories)),
          protein: String(Math.round(protein * 10) / 10),
          carbs: String(Math.round(carbs * 10) / 10),
          fat: String(Math.round(fat * 10) / 10),
          fiber: String(Math.round(fiber * 10) / 10),
          sodium: String(Math.round(sodium)),
          sugar: String(Math.round(sugar * 10) / 10),
        })
        .returning();

      console.log(`✅ Meal log entry created: ${mealLog.id}`);
      res.status(201).json(mealLog);

    } catch (error: any) {
      console.error("❌ Meal log creation error:", error);
      res.status(500).json({ error: "Failed to create meal log entry", details: error.message });
    }
  });

  // GLP-1 Meal Log API - accepts pre-calculated nutrition data
  app.post("/api/meal-log/glp1", async (req, res) => {
    try {
      const { userId, localDate, mealSlot, mealName, servings, nutrition } = req.body;

      if (!userId || !localDate || !mealSlot || !mealName || !nutrition) {
        return res.status(400).json({ error: "Missing required fields: userId, localDate, mealSlot, mealName, nutrition" });
      }

      console.log(`🍽️ Adding GLP-1 meal log: ${userId} | ${localDate} | ${mealSlot} | ${mealName}`);

      // Use pre-calculated nutrition data from GLP-1 meals
      const calories = Math.round(nutrition.calories * servings);
      const protein = Math.round(nutrition.protein * servings * 10) / 10;
      const carbs = Math.round(nutrition.carbs * servings * 10) / 10;
      const fat = Math.round(nutrition.fat * servings * 10) / 10;

      // Insert meal log entry
      const [mealLog] = await db
        .insert(mealLogsEnhanced)
        .values({
          userId,
          date: localDate,
          mealSlot,
          source: "glp1_meals",
          barcode: null,
          customName: mealName,
          servings: String(servings),
          calories: String(calories),
          protein: String(protein),
          carbs: String(carbs),
          fat: String(fat),
          fiber: String(0),
          sodium: String(0),
          sugar: String(0),
        })
        .returning();

      console.log(`✅ GLP-1 meal log entry created: ${mealLog.id}`);
      res.status(201).json(mealLog);

    } catch (error: any) {
      console.error("❌ GLP-1 meal log creation error:", error);
      res.status(500).json({ error: "Failed to create GLP-1 meal log entry", details: error.message });
    }
  });

  // ==== BARCODE SCANNING API ENDPOINTS (MyFitnessPal-Style) ====

  // 1. Lookup barcode - main scanning endpoint
  app.get("/api/barcode/:code", async (req, res) => {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).json({ error: "Barcode is required" });
      }

      const { lookupBarcode } = await import("./services/barcodeService");
      const food = await lookupBarcode(code);

      if (!food) {
        return res.status(404).json({ 
          notFound: true,
          message: "Product not found",
          barcode: code 
        });
      }

      // Return normalized food data
      res.json({
        food_id: food.id,
        barcode: food.barcode,
        name: food.name,
        brand: food.brand,
        serving_sizes: food.servingSizes,
        nutr_per_serving: food.nutrPerServing,
        verified: food.verified,
        source: food.source
      });
    } catch (error) {
      console.error("Barcode lookup error:", error);
      res.status(500).json({ error: "Failed to lookup barcode" });
    }
  });

  // 2. Log food entry to diary
  app.post("/api/diary/log", async (req, res) => {
    try {
      const { user_id, date_local, meal_slot, food_id, barcode, serving_label, servings } = req.body;

      // Validation
      if (!user_id || !date_local || !meal_slot || !food_id || !serving_label || servings === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!["breakfast", "lunch", "dinner", "snack"].includes(meal_slot)) {
        return res.status(400).json({ error: "Invalid meal slot" });
      }

      if (servings < 0.1 || servings > 10) {
        return res.status(400).json({ error: "Invalid servings amount" });
      }

      const { logFood } = await import("./services/barcodeService");
      const result = await logFood({
        userId: user_id,
        dateLocal: date_local,
        mealSlot: meal_slot,
        foodId: food_id,
        barcode,
        servingLabel: serving_label,
        servings: Number(servings)
      });

      res.json({
        entry: result.entry,
        totals: result.totals,
        message: `Added to ${meal_slot} · ${result.totals.kcal} kcal`
      });
    } catch (error: any) {
      console.error("Food logging error:", error);
      res.status(500).json({ error: error.message || "Failed to log food" });
    }
  });

  // 3. Add new food (when barcode not found)
  app.post("/api/foods", async (req, res) => {
    try {
      const { barcode, name, brand, serving_label, serving_grams, nutrition } = req.body;

      if (!barcode || !name || !serving_label || !serving_grams || !nutrition) {
        return res.status(400).json({ error: "Missing required fields for food creation" });
      }

      if (!nutrition.kcal || !nutrition.protein_g || !nutrition.carbs_g || !nutrition.fat_g) {
        return res.status(400).json({ error: "Basic nutrition information required" });
      }

      const { addNewFood } = await import("./services/barcodeService");
      const food = await addNewFood({
        barcode,
        name,
        brand,
        servingLabel: serving_label,
        servingGrams: Number(serving_grams),
        nutrition
      });

      res.json({
        food_id: food.id,
        barcode: food.barcode,
        name: food.name,
        brand: food.brand,
        serving_sizes: food.servingSizes,
        nutr_per_serving: food.nutrPerServing,
        verified: food.verified,
        source: food.source
      });
    } catch (error) {
      console.error("Add food error:", error);
      res.status(500).json({ error: "Failed to add new food" });
    }
  });

  // 4. Get day totals for nutrition dashboard
  app.get("/api/diary/totals", async (req, res) => {
    try {
      const { user_id, date_local } = req.query;

      if (!user_id || !date_local) {
        return res.status(400).json({ error: "user_id and date_local are required" });
      }

      const { getDayTotals } = await import("./services/barcodeService");
      const totals = await getDayTotals(String(user_id), String(date_local));

      res.json(totals);
    } catch (error) {
      console.error("Day totals error:", error);
      res.status(500).json({ error: "Failed to get day totals" });
    }
  });

  // 5. Delete diary entry (for undo functionality)
  app.delete("/api/diary/:entry_id", async (req, res) => {
    try {
      const { entry_id } = req.params;
      const { user_id, date_local } = req.body;

      if (!entry_id) {
        return res.status(400).json({ error: "Entry ID is required" });
      }

      const { db } = await import("./db");
      const { foodDiary } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Delete the entry
      await db.delete(foodDiary).where(eq(foodDiary.id, entry_id));

      // Return updated totals if user info provided
      if (user_id && date_local) {
        const { getDayTotals } = await import("./services/barcodeService");
        const totals = await getDayTotals(user_id, date_local);
        res.json({ success: true, totals });
      } else {
        res.json({ success: true });
      }
    } catch (error) {
      console.error("Delete diary entry error:", error);
      res.status(500).json({ error: "Failed to delete diary entry" });
    }
  });

  // 6. Get user's food diary for a specific date
  app.get("/api/diary/:user_id/:date_local", async (req, res) => {
    try {
      const { user_id, date_local } = req.params;

      const { db } = await import("./db");
      const { foodDiary } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const entries = await db
        .select()
        .from(foodDiary)
        .where(
          and(
            eq(foodDiary.userId, user_id),
            eq(foodDiary.dateLocal, date_local)
          )
        )
        .orderBy(foodDiary.createdAt);

      // Group by meal slot
      const grouped = entries.reduce((acc, entry) => {
        if (!acc[entry.mealSlot]) {
          acc[entry.mealSlot] = [];
        }
        acc[entry.mealSlot].push(entry);
        return acc;
      }, {} as Record<string, any[]>);

      // Calculate totals
      const { getDayTotals } = await import("./services/barcodeService");
      const totals = await getDayTotals(user_id, date_local);

      res.json({
        entries: grouped,
        totals
      });
    } catch (error) {
      console.error("Get diary error:", error);
      res.status(500).json({ error: "Failed to get diary entries" });
    }
  });

  const httpServer = createServer(app);
  // Recipe action routes
  app.post("/api/recipes/:id/save", async (req, res) => {
    try {
      const userId = "00000000-0000-0000-0000-000000000001"; // Default user ID
      const recipeId = req.params.id;

      // For now, just return success - in production this would save to a favorites table
      console.log(`Saving recipe ${recipeId} for user ${userId}`);

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving recipe:", error);
      res.status(500).json({ error: "Failed to save recipe" });
    }
  });

  app.post("/api/recipes/:id/add-to-week", async (req, res) => {
    try {
      const userId = "00000000-0000-0000-0000-000000000001"; // Default user ID
      const recipeId = req.params.id;
      const { day, slot } = req.body;

      if (!day || !slot) {
        return res.status(400).json({ error: "day and slot required" });
      }

      console.log(`Adding recipe ${recipeId} to weekly plan for user ${userId} on day ${day} in slot ${slot}`);

      // Import the weekly plan repository functions
      const { getWeeklyPlan, upsertWeeklyPlan } = require("./db/repo.weeklyPlan");

      // Get current weekly plan or create a new one
      let currentPlan = await getWeeklyPlan(userId);
      let planData = currentPlan?.plan || {
        meals: Array(7).fill(null).map((_, i) => ({
          day: i + 1,
          breakfast: null,
          lunch: null,
          dinner: null,
          snack: null
        }))
      };

      // Find the recipe in our data sources to get full details
      const { breakfastMeals } = require("../client/src/data/breakfastMealsData");

      let recipeData = null;
      let templateData = null;

      // Look for the recipe in breakfast meals
      for (const meal of breakfastMeals) {
        if (meal.id === recipeId || meal.slug === recipeId) {
          recipeData = meal;
          // Default to classic template, but could be extended to handle specific template selection
          templateData = meal.templates.classic;
          break;
        }
      }

      if (!recipeData) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      // Create the meal entry for the weekly plan
      const mealEntry = {
        id: recipeData.id,
        slug: recipeData.slug,
        name: templateData.name,
        description: templateData.description,
        image: recipeData.image,
        type: slot,
        servings: recipeData.baseServings,
        ingredients: templateData.ingredients,
        instructions: templateData.instructions,
        healthBadges: templateData.healthBadges,
        addedAt: new Date().toISOString()
      };

      // Update the specific day and slot
      const dayIndex = day - 1;
      if (dayIndex >= 0 && dayIndex < 7) {
        planData.meals[dayIndex][slot] = mealEntry;
      }

      // Calculate basic nutrition totals (simplified)
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      planData.meals.forEach((dayMeals: any) => {
        Object.values(dayMeals).forEach((meal: any) => {
          if (meal && typeof meal === 'object' && meal.id) {
            // Basic estimation - in production this would use proper nutrition data
            totalCalories += 400; // rough estimate per meal
            totalProtein += 20;
            totalCarbs += 50;
            totalFat += 15;
          }
        });
      });

      const planParams = {
        lastUpdated: new Date().toISOString(),
        version: "1.0",
        source: "manual_add"
      };

      // Save the updated plan to database
      await upsertWeeklyPlan(userId, planData, planParams);

      const updatedPlan = {
        weeks: [{
          days: planData.meals.map((dayMeals: any) => ({
            day: dayMeals.day,
            meals: {
              breakfast: dayMeals.breakfast,
              lunch: dayMeals.lunch,
              dinner: dayMeals.dinner,
              snack: dayMeals.snack
            }
          }))
        }]
      };

      const planMeta = {
        source: "TEMPLATE_PICKER",
        service: "user_selection",
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat
      };

      console.log(`✅ Successfully added ${recipeData.name} to ${slot} on day ${day}`);

      res.json({ 
        success: true, 
        plan: updatedPlan, 
        meta: planMeta,
        message: `${recipeData.name} added to weekly plan successfully` 
      });
    } catch (error) {
      console.error("Error adding recipe to week:", error);
      res.status(500).json({ error: "Failed to add recipe to weekly plan" });
    }
  });

  // Send current weekly plan to macros
  app.post("/api/macros/from-current", async (req, res) => {
    try {
      const userId = "00000000-0000-0000-0000-000000000001"; // Default user ID

      console.log(`Computing macros from current plan for user ${userId}`);

      // For now, return mock totals - in production this would:
      // 1. Load meal_plans_current for user
      // 2. Compute totals from all meals in the plan
      // 3. Return daily and weekly totals

      const mockTotals = {
        daily: Array(7).fill(null).map((_, i) => ({
          day: i + 1,
          calories: 1800 + Math.floor(Math.random() * 400),
          protein: 120 + Math.floor(Math.random() * 40),
          carbs: 180 + Math.floor(Math.random() * 60),
          fat: 60 + Math.floor(Math.random() * 20),
          fiber: 25 + Math.floor(Math.random() * 10)
        })),
        weekly: {
          calories: 14000,
          protein: 980,
          carbs: 1400,
          fat: 490,
          fiber: 210
        }
      };

      res.json({ 
        success: true, 
        totals: mockTotals
      });
    } catch (error) {
      console.error("Error computing macros from current plan:", error);
      res.status(500).json({ error: "Failed to compute macros" });
    }
  });

  // Cultural Cuisines recipes
  app.post('/api/cultural-cuisines/recipes', async (req, res) => {
    try {
      const { cuisineCode, menuSlug, name, servings, ingredients, instructions, photo_url } = req.body;

      if (!name || !ingredients || !instructions) {
        return res.status(400).json({ error: 'Missing required fields: name, ingredients, or instructions' });
      }

      const recipe = {
        id: `cultural_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        cuisineCode: cuisineCode || 'general',
        menuSlug: menuSlug || null,
        name,
        servings: Number(servings) || 4,
        ingredients,
        instructions,
        photo_url: photo_url || null,
        createdAt: new Date().toISOString()
      };

      console.log('✅ Cultural recipe created:', recipe);
      res.status(201).json(recipe);
    } catch (error) {
      console.error('❌ Error creating cultural recipe:', error);
      res.status(500).json({ error: 'Failed to create recipe' });
    }
  });

  // User Meal Preferences API endpoints for Cafeteria Setup
  app.get("/api/user-meal-prefs/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const [prefs] = await db
        .select()
        .from(userMealPrefs)
        .where(eq(userMealPrefs.userId, userId));

      if (!prefs) {
        // Return default preferences if none exist
        return res.json({
          userId,
          goal: "maint",
          likes: [],
          avoid: [],
          vegOptOut: false,
          updatedAt: new Date().toISOString()
        });
      }

      res.json(prefs);
    } catch (error) {
      console.error("Error fetching user meal preferences:", error);
      res.status(500).json({ error: "Failed to fetch user preferences" });
    }
  });

  app.put("/api/user-meal-prefs/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const validatedData = insertUserMealPrefsSchema.parse({
        ...req.body,
        userId,
        updatedAt: new Date(),
      });

      const [updatedPrefs] = await db
        .insert(userMealPrefs)
        .values(validatedData)
        .onConflictDoUpdate({
          target: userMealPrefs.userId,
          set: {
            goal: validatedData.goal,
            likes: validatedData.likes,
            avoid: validatedData.avoid,
            vegOptOut: validatedData.vegOptOut,
            updatedAt: validatedData.updatedAt,
          },
        })
        .returning();

      res.json(updatedPrefs);
    } catch (error) {
      console.error("Error updating user meal preferences:", error);
      res.status(500).json({ error: "Failed to update user preferences" });
    }
  });

  app.post("/api/generate-weekly-plan", async (req, res) => {
    try {
      const { userId, weeks = 1, mealsPerDay = 3, snacksPerDay = 1 } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Fetch user preferences
      const [userPrefs] = await db
        .select()
        .from(userMealPrefs)
        .where(eq(userMealPrefs.userId, userId));

      // Generate a simple meal plan using existing logic
      const generatedPlan = generateQuickMeals(weeks, mealsPerDay, snacksPerDay);

      // Apply user preferences if available
      let filteredPlan = generatedPlan;
      const avoid = userPrefs?.avoid ?? [];
      if (avoid.length > 0) {
        filteredPlan = generatedPlan.filter(meal => 
          !avoid.some(avoidItem => 
            meal.name.toLowerCase().includes(avoidItem.toLowerCase())
          )
        );
      }

      res.json({
        success: true,
        plan: filteredPlan,
        preferences: userPrefs || null,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating weekly meal plan:", error);
      res.status(500).json({ error: "Failed to generate meal plan" });
    }
  });

  // Helper function to generate quick meals for Plan Builder (fast, no complex logic)
  function generateQuickMeals(weeks: number, mealsPerDay: number, snacksPerDay: number) {
    const quickMeals = [
      { name: "Avocado Toast with Eggs", type: "breakfast", calories: 380, protein: 18, time: "07:00" },
      { name: "Greek Yogurt Parfait", type: "breakfast", calories: 320, protein: 20, time: "07:00" },
      { name: "Oatmeal with Berries", type: "breakfast", calories: 290, protein: 12, time: "07:00" },
      { name: "Grilled Chicken Salad", type: "lunch", calories: 450, protein: 35, time: "12:00" },
      { name: "Turkey Sandwich", type: "lunch", calories: 420, protein: 28, time: "12:00" },
      { name: "Quinoa Bowl", type: "lunch", calories: 380, protein: 22, time: "12:00" },
      { name: "Salmon with Vegetables", type: "dinner", calories: 520, protein: 42, time: "18:30" },
      { name: "Chicken Stir Fry", type: "dinner", calories: 480, protein: 38, time: "18:30" },
      { name: "Beef and Broccoli", type: "dinner", calories: 460, protein: 35, time: "18:30" },
      { name: "Mixed Nuts", type: "snack", calories: 180, protein: 6, time: "15:30" },
      { name: "Protein Smoothie", type: "snack", calories: 220, protein: 25, time: "15:30" },
      { name: "Apple with Peanut Butter", type: "snack", calories: 190, protein: 8, time: "15:30" }
    ];

    const meals = [];
    const totalDays = weeks * 7;

    for (let day = 0; day < totalDays; day++) {
      let mealId = 1;

      // Add main meals
      const breakfast = quickMeals.filter(m => m.type === 'breakfast')[day % 3];
      const lunch = quickMeals.filter(m => m.type === 'lunch')[day % 3];
      const dinner = quickMeals.filter(m => m.type === 'dinner')[day % 3];

      meals.push(
        { ...breakfast, id: mealId++, day, scheduledTime: breakfast.time },
        { ...lunch, id: mealId++, day, scheduledTime: lunch.time },
        { ...dinner, id: mealId++, day, scheduledTime: dinner.time }
      );

      // Add snacks
      for (let snack = 0; snack < snacksPerDay; snack++) {
        const snackMeal = quickMeals.filter(m => m.type === 'snack')[snack % 3];
        meals.push({ ...snackMeal, id: mealId++, day, scheduledTime: snackMeal.time });
      }
    }

    return meals;
  }

  // Helper function to generate sample meals for Plan Builder (backup function)
  function generateSampleMeals(weeks: number, mealsPerDay: number, snacksPerDay: number) {
    const sampleMeals = [
      { id: 1, name: "Avocado Toast with Eggs", type: "breakfast", calories: 380, protein: 18 },
      { id: 2, name: "Greek Yogurt Parfait", type: "breakfast", calories: 320, protein: 20 },
      { id: 3, name: "Oatmeal with Berries", type: "breakfast", calories: 290, protein: 12 },
      { id: 4, name: "Grilled Chicken Salad", type: "lunch", calories: 450, protein: 35 },
      { id: 5, name: "Turkey Sandwich", type: "lunch", calories: 420, protein: 28 },
      { id: 6, name: "Quinoa Bowl", type: "lunch", calories: 380, protein: 22 },
      { id: 7, name: "Salmon with Vegetables", type: "dinner", calories: 520, protein: 42 },
      { id: 8, name: "Chicken Stir Fry", type: "dinner", calories: 480, protein: 38 },
      { id: 9, name: "Beef and Broccoli", type: "dinner", calories: 460, protein: 35 },
      { id: 10, name: "Mixed Nuts", type: "snack", calories: 180, protein: 6 },
      { id: 11, name: "Protein Smoothie", type: "snack", calories: 220, protein: 25 },
      { id: 12, name: "Apple with Peanut Butter", type: "snack", calories: 190, protein: 8 }
    ];

    const meals = [];
    const totalDays = weeks * 7;

    for (let day = 0; day < totalDays; day++) {
      // Add breakfast, lunch, dinner
      const breakfast = sampleMeals.filter(m => m.type === 'breakfast')[day % 3];
      const lunch = sampleMeals.filter(m => m.type === 'lunch')[day % 3];
      const dinner = sampleMeals.filter(m => m.type === 'dinner')[day % 3];

      meals.push(
        { ...breakfast, day, scheduledTime: "07:00" },
        { ...lunch, day, scheduledTime: "12:00" },
        { ...dinner, day, scheduledTime: "18:30" }
      );

      // Add snacks
      for (let snack = 0; snack < snacksPerDay; snack++) {
        const snackMeal = sampleMeals.filter(m => m.type === 'snack')[snack % 3];
        meals.push({ ...snackMeal, day, scheduledTime: "15:30" });
      }
    }

    return meals;
  }

  // Helper function to categorize ingredients
  function categorizeIngredient(ingredient: string): string {
    const produce = ['berries', 'avocado', 'vegetables', 'bell peppers', 'broccoli', 'sweet potato'];
    const protein = ['chicken', 'salmon', 'yogurt', 'eggs'];
    const dairy = ['yogurt', 'milk', 'cheese'];
    const pantry = ['quinoa', 'granola', 'olive oil', 'honey'];

    const lowerIngredient = ingredient.toLowerCase();

    if (produce.some(item => lowerIngredient.includes(item))) return 'Produce';
    if (protein.some(item => lowerIngredient.includes(item))) return 'Protein';
    if (dairy.some(item => lowerIngredient.includes(item))) return 'Dairy';
    if (pantry.some(item => lowerIngredient.includes(item))) return 'Pantry';

    return 'Other';
  }

  // Helper function to consolidate duplicate ingredients
  function consolidateIngredients(items: Array<{name: string, amount: string, unit: string, category: string, checked: boolean}>) {
    const consolidated = new Map();

    items.forEach(item => {
      const key = `${item.name}-${item.unit}`;
      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        // Simple consolidation - just add amounts if they're numbers
        const existingAmount = parseFloat(existing.amount) || 0;
        const newAmount = parseFloat(item.amount) || 0;
        if (existingAmount && newAmount) {
          existing.amount = (existingAmount + newAmount).toString();
        }
      } else {
        consolidated.set(key, { ...item });
      }
    });

    return Array.from(consolidated.values());
  }

  // Diabetic meal board persistence (simple localStorage-like API)
  const diabeticMealBoards = new Map<string, any>();

  app.get("/api/diabetic-meal-board", (req, res) => {
    const userId = "default"; // In real app, get from session
    const saved = diabeticMealBoards.get(userId);
    res.json(saved || { plan: {} });
  });

  app.post("/api/diabetic-meal-board", (req, res) => {
    const userId = "default"; // In real app, get from session
    const { plan } = req.body;
    diabeticMealBoards.set(userId, { plan });
    res.json({ success: true });
  });

  // Wine Pairing AI endpoint
  app.post("/api/ai/wine-pairing", async (req, res) => {
    try {
      const { userId, mealType, cuisine, mainIngredient, occasion, priceRange, preferences } = req.body;

      if (!mealType) {
        return res.status(400).json({ error: "Meal type is required" });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Build the prompt for wine pairing
      const prompt = `You are an expert sommelier. Provide 3 wine pairing recommendations for the following meal:

Meal Type: ${mealType}
${cuisine ? `Cuisine: ${cuisine}` : ''}
${mainIngredient ? `Main Ingredient: ${mainIngredient}` : ''}
${occasion ? `Occasion: ${occasion}` : ''}
${priceRange ? `Price Range: ${priceRange}` : ''}
${preferences ? `Additional Preferences: ${preferences}` : ''}

Provide recommendations in JSON format with the following structure:
{
  "recommendations": [
    {
      "wineName": "Suggested wine name",
      "wineType": "Red/White/Rosé/Sparkling",
      "varietal": "Grape varietal (e.g., Cabernet Sauvignon, Chardonnay)",
      "region": "Wine region",
      "vintageRange": "Recommended vintage years",
      "priceRange": "Price range",
      "flavorProfile": "Description of flavor notes",
      "pairingReason": "Why this wine pairs well with the meal",
      "servingTemp": "Recommended serving temperature",
      "glassType": "Recommended glass type",
      "alternatives": ["Alternative wine 1", "Alternative wine 2"]
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert sommelier providing wine pairing recommendations. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const result = JSON.parse(completion.choices[0].message.content || '{"recommendations": []}');

      res.json({
        id: `wine-pairing-${Date.now()}`,
        userId,
        mealType,
        cuisine,
        mainIngredient,
        occasion,
        priceRange,
        preferences,
        recommendations: result.recommendations,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Wine pairing error:", error);
      res.status(500).json({ error: "Failed to generate wine pairing recommendations" });
    }
  });

  // Bourbon & Spirits Pairing AI endpoint
  app.post("/api/ai/bourbon-spirits-pairing", async (req, res) => {
    try {
      const { userId, mealType, cuisine, mainIngredient, occasion, priceRange, preferences } = req.body;

      if (!mealType) {
        return res.status(400).json({ error: "Meal type is required" });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Build the prompt for bourbon/spirits pairing
      const prompt = `You are an expert master distiller and spirits connoisseur. Provide a premium bourbon or spirits pairing recommendation for the following meal:

Meal Type: ${mealType}
${cuisine ? `Cuisine: ${cuisine}` : ''}
${mainIngredient ? `Main Ingredient: ${mainIngredient}` : ''}
${occasion ? `Occasion: ${occasion}` : ''}
${priceRange ? `Price Range: ${priceRange}` : ''}
${preferences ? `Additional Preferences: ${preferences}` : ''}

Provide a single BEST recommendation in JSON format with the following structure:
{
  "spiritName": "Specific bourbon or spirit name",
  "spiritType": "Bourbon/Rye Whiskey/Scotch/Irish Whiskey",
  "ageStatement": "Age or maturation info",
  "distilleryRegion": "Distillery location",
  "proofABV": "Proof and ABV",
  "priceRange": "Price range",
  "flavorProfile": "Detailed flavor notes and tasting profile",
  "pairingReason": "Why this spirit pairs perfectly with this specific meal",
  "servingSuggestion": "How to serve (neat, rocks, etc.)",
  "glassType": "Recommended glass type",
  "alternatives": ["Alternative spirit 1", "Alternative spirit 2", "Alternative spirit 3"]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert master distiller and spirits connoisseur providing bourbon and spirits pairing recommendations. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      res.json({
        id: `bourbon-pairing-${Date.now()}`,
        userId,
        mealType,
        cuisine,
        mainIngredient,
        occasion,
        priceRange,
        preferences,
        recommendation: result,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Bourbon/spirits pairing error:", error);
      res.status(500).json({ error: "Failed to generate bourbon/spirits pairing recommendation" });
    }
  });

  // Meal Pairing AI endpoint (reverse pairing: drink → meal)
  app.post("/api/ai/meal-pairing", async (req, res) => {
    try {
      const { userId, drinkType, specificDrink, mealPreference, cookingTime, servings } = req.body;

      if (!drinkType || !specificDrink) {
        return res.status(400).json({ error: "Drink type and specific drink are required" });
      }

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Build the prompt for meal pairing
      const prompt = `You are an expert chef and sommelier. Create the PERFECT meal recipe that pairs beautifully with this drink:

Drink Category: ${drinkType}
Specific Drink: ${specificDrink}
${mealPreference ? `Meal Style: ${mealPreference}` : ''}
${cookingTime ? `Cooking Time: ${cookingTime}` : ''}
${servings ? `Servings: ${servings}` : 'Servings: 2'}

Provide a single exceptional meal recommendation in JSON format with the following structure:
{
  "mealName": "Creative, appealing meal name",
  "mealType": "Appetizer/Main Course/Dessert",
  "cookingTime": "Total time to prepare",
  "servings": ${servings || 2},
  "ingredients": [
    "Ingredient 1 with quantity",
    "Ingredient 2 with quantity"
  ],
  "instructions": [
    "Step 1",
    "Step 2"
  ],
  "nutritionHighlights": "Brief nutrition summary",
  "pairingReason": "Why this meal pairs perfectly with ${specificDrink}",
  "servingSuggestion": "Plating and serving recommendations",
  "alternatives": ["Alternative meal 1", "Alternative meal 2", "Alternative meal 3"]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert chef and sommelier providing meal pairing recommendations for specific drinks. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      res.json({
        id: `meal-pairing-${Date.now()}`,
        userId,
        drinkType,
        specificDrink,
        mealPreference,
        cookingTime,
        servings,
        recommendation: result,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Meal pairing error:", error);
      res.status(500).json({ error: "Failed to generate meal pairing recommendation" });
    }
  });


  // Affiliate program - secure email verification endpoint
  app.post("/api/affiliates/verify-email", (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ eligible: false, error: "Invalid email" });
    }

    // Server-side allowlist (NEVER expose this to the client)
    const AFFILIATE_ALLOWLIST = (process.env.AFFILIATE_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const isEligible = AFFILIATE_ALLOWLIST.includes(email.toLowerCase());

    res.json({ eligible: isEligible });
  });

  // Mount routes
  app.use("/api", mealPlansRoutes);
  app.use("/api", mealLogsRoutes);
  app.use("/api", macroLogsRoutes);
  // --- Logs & biometrics routes (no styling changes, just mounts) ---
  app.use("/api", alcoholLogRoutes);              // alcohol routes expect "/api/..." internally
  app.use("/api/glucose-logs", glucoseLogRoutes); // <-- FIX: mount glucose router at explicit path
  app.use("/api", biometricsRoutes);
  app.use("/api/locked-days", lockedDaysRouter);
  // Deleted: glp1ShotsRoutes route

  // Mount glp1Shots routes
  app.use("/api", glp1ShotsRoutes); // Mounted glp1ShotsRoutes here
  
  // Mount GLP-1 profile routes
  app.use("/api/glp1", glp1Routes);

  // Add meal boards routes
  const mealBoardsRoutes = (await import("./routes/mealBoards")).default;
  app.use("/api", mealBoardsRoutes);

  app.use("/api/care-team", careTeamRoutes);
  app.use("/api/pro", procareRoutes);
  app.use("/api/founders", foundersRoutes);
  app.use("/api/physician-reports", physicianReportsRoutes);

  // Mount builder plans routes
  app.use(builderPlansRoutes);

  // Mount Stripe webhook BEFORE express.json() with raw body
  app.use(stripeWebhookRouter);
  
  // Mount Stripe checkout router with correct prefix
  app.use("/api/stripe", stripeCheckoutRouter);

  return httpServer;
}