/**
 * Schema Validator - Startup Table Validation
 * 
 * Facebook-level stability rule: If a required table is missing,
 * the app starts but AI routes return 503 with explicit error.
 * 
 * This prevents silent degradation where the app "works" but
 * returns fallback data without anyone knowing.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface TableValidationResult {
  tableName: string;
  exists: boolean;
}

export interface SchemaValidationResult {
  allTablesExist: boolean;
  results: TableValidationResult[];
  missingTables: string[];
}

const REQUIRED_TABLES = [
  'generated_meals_cache',
] as const;

let cachedValidation: SchemaValidationResult | null = null;
let lastValidationTime = 0;
const VALIDATION_CACHE_TTL = 60000; // 1 minute

export async function validateRequiredTables(): Promise<SchemaValidationResult> {
  const now = Date.now();
  if (cachedValidation && (now - lastValidationTime) < VALIDATION_CACHE_TTL) {
    return cachedValidation;
  }

  const results: TableValidationResult[] = [];
  
  for (const tableName of REQUIRED_TABLES) {
    try {
      const result = await db.execute(
        sql`SELECT to_regclass(${`public.${tableName}`}) as exists`
      );
      const exists = result.rows[0]?.exists !== null;
      results.push({ tableName, exists });
    } catch (error) {
      console.error(`Failed to check table ${tableName}:`, error);
      results.push({ tableName, exists: false });
    }
  }

  const missingTables = results
    .filter(r => !r.exists)
    .map(r => r.tableName);

  cachedValidation = {
    allTablesExist: missingTables.length === 0,
    results,
    missingTables,
  };
  lastValidationTime = now;

  if (missingTables.length > 0) {
    console.error('❌ SCHEMA VALIDATION FAILED - Missing required tables:', missingTables);
  } else {
    console.log('✅ Schema validation passed - All required tables exist');
  }

  return cachedValidation;
}

export function getSchemaStatus(): SchemaValidationResult | null {
  return cachedValidation;
}

export function clearSchemaCache(): void {
  cachedValidation = null;
  lastValidationTime = 0;
}
