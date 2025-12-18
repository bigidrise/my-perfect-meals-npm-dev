import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import * as mybestlifeSchema from "./db/schema/mybestlife";
import { glp1Shots } from "./db/schema/glp1Shots";
import { mealBoards, mealBoardItems } from "./db/schema/mealBoards";
import { builderPlans } from "./db/schema/builderPlans";

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

// Use connection pool with keepalive to prevent idle disconnections
export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 10,
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
    glp1Shots, 
    mealBoards, 
    mealBoardItems, 
    builderPlans 
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
