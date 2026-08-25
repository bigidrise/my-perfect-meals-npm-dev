import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import * as mybestlifeSchema from "./db/schema/mybestlife";
import * as hydrationSchema from "./db/schema/hydration";
import * as aiObservabilitySchema from "./db/schema/aiObservability";
import { glp1Shots } from "./db/schema/glp1Shots";
import { mealBoards, mealBoardItems } from "./db/schema/mealBoards";
import { builderPlans } from "./db/schema/builderPlans";
import { organizations } from "./db/schema/organizations";
import { studioVideoMedia, studioVideoMessages } from "./db/schema/studio";
import {
  coachConversations,
  coachMessages,
  coachInvestigations,
  coachActionPlans,
  coachActionItems,
  coachFollowups,
  coachingMemories,
  nutritionMemories,
  knowledgePatterns,
} from "./db/schema/coaching";

// Construct database connection URL, preferring Neon credentials over Railway
function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  
  // Log environment info for debugging
  const env = process.env.REPLIT_DEPLOYMENT ? 'PRODUCTION' : 'DEVELOPMENT';
  console.log(`[DB] Environment: ${env}`);
  console.log(`[DB] DATABASE_URL is ${databaseUrl ? 'SET' : 'NOT SET'}`);
  
  // If DATABASE_URL points to Railway (which may be unavailable), use Neon credentials instead
  if (databaseUrl?.includes('railway.app') || databaseUrl?.includes('rlwy.net')) {
    const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = process.env;
    if (PGUSER && PGPASSWORD && PGHOST && PGPORT && PGDATABASE) {
      console.log('[DB] Using Neon credentials instead of Railway DATABASE_URL');
      console.log(`[DB] Connecting to: ${PGHOST}`);
      return `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
    }
  }
  
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  
  return databaseUrl;
}

// Use connection pool with keepalive to prevent idle disconnections.
// min: 3  — pre-warm 3 connections at startup so the first burst of requests
//            (dashboard + Favorites loading simultaneously) doesn't queue behind
//            cold SSL handshakes (~65ms each).
// max: 20 — the dashboard fires 10+ concurrent DB-touching endpoints on load;
//            10 slots was regularly exhausted, causing saved_meals to queue for
//            1700ms while waiting for a free connection.
export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  min: 3,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: getDatabaseUrl().includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

// Handle pool errors without crashing
pool.on("error", (err) => {
  console.error("❌ Database pool error (will reconnect):", err.message);
});

// Export drizzle instance with all schemas
export const db = drizzle(pool, { 
  schema: { 
    ...schema, 
    ...mybestlifeSchema, 
    ...hydrationSchema,
    ...aiObservabilitySchema,
    glp1Shots, 
    mealBoards, 
    mealBoardItems, 
    builderPlans,
    organizations,
    studioVideoMedia,
    studioVideoMessages,
    coachConversations,
    coachMessages,
    coachInvestigations,
    coachActionPlans,
    coachActionItems,
    coachFollowups,
    coachingMemories,
    nutritionMemories,
    knowledgePatterns,
  } 
});

// Keepalive ping to prevent connection drops during idle
setInterval(async () => {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("❌ Keepalive ping failed (pool will reconnect)");
  }
}, 120000); // Every 2 minutes
