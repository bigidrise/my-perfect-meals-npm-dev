/**
 * Persistent Meal Cache Service
 * 
 * Stores generated meals in the database for long-term caching.
 * This ensures meals don't need to be regenerated after server restarts.
 * 
 * Strategy:
 * 1. Check memory cache first (fast)
 * 2. Check database cache second (persisted)
 * 3. Generate if neither has a hit
 * 4. Store in both caches on generation
 */

import { db } from '../db';
import { generatedMealsCache } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashSignature } from './ingredientSignature';
import { MealgenCache } from './mealgenCache';
import type { UnifiedMeal } from './unifiedMealPipeline';

const memoryCache = new MealgenCache<UnifiedMeal[]>(10 * 60 * 1000, 500);

export interface CachedMealResult {
  meals: UnifiedMeal[];
  source: 'memory' | 'database' | 'generated';
  signature: string;
}

export async function getCachedMeals(signature: string): Promise<CachedMealResult | null> {
  const hash = hashSignature(signature);
  
  const memoryCached = memoryCache.get(hash);
  if (memoryCached) {
    console.log(`🚀 Memory cache hit for: ${hash}`);
    return { meals: memoryCached, source: 'memory', signature };
  }
  
  try {
    const dbResult = await db
      .select()
      .from(generatedMealsCache)
      .where(eq(generatedMealsCache.signatureHash, hash))
      .limit(1);
    
    if (dbResult.length > 0) {
      const cached = dbResult[0];
      const meals = cached.mealData as UnifiedMeal[];
      
      memoryCache.set(hash, meals);
      
      await db
        .update(generatedMealsCache)
        .set({
          hitCount: sql`${generatedMealsCache.hitCount} + 1`,
          lastAccessedAt: new Date()
        })
        .where(eq(generatedMealsCache.id, cached.id));
      
      console.log(`💾 Database cache hit for: ${hash} (hits: ${cached.hitCount + 1})`);
      return { meals, source: 'database', signature };
    }
  } catch (error) {
    console.warn('⚠️ Database cache lookup failed:', error);
  }
  
  return null;
}

export async function cacheMeals(
  signature: string,
  meals: UnifiedMeal[],
  mealType: string,
  source: 'ai' | 'catalog' | 'template' = 'ai'
): Promise<void> {
  const hash = hashSignature(signature);
  
  memoryCache.set(hash, meals);
  
  try {
    const firstMeal = meals[0];
    
    await db.insert(generatedMealsCache).values({
      signatureHash: hash,
      signature: signature,
      mealType: mealType,
      source: source,
      mealData: meals as any,
      calories: firstMeal?.calories || 0,
      protein: firstMeal?.protein || 0,
      carbs: firstMeal?.carbs || 0,
      fat: firstMeal?.fat || 0,
      hitCount: 1,
    }).onConflictDoNothing();
    
    console.log(`💾 Cached ${meals.length} meals with signature: ${hash}`);
  } catch (error) {
    console.warn('⚠️ Failed to persist meals to database:', error);
  }
}

export function clearMemoryCache(): void {
  memoryCache.clear();
  console.log('🗑️ Memory cache cleared');
}

export function getMemoryCacheStats(): { size: number } {
  return { size: memoryCache.size() };
}
