// Meal Finder Service v2.1 — Smart Restaurant Selection System
// Finds nearby restaurants for a given meal craving + ZIP code
// Uses shared Restaurant Resolver + AI Restaurant Meal Generator
//
// Selection pipeline:
//   0. Cuisine preference pass (if user has a cuisine preference, runs first)
//   1. Diet-aware 3-tier query (strict → fallback → general)
//   2. Price filtering (hard filter when active; strict: unknown price excluded)
//   3. Rating DESC + distance ASC ranking
//   4. AI meal generation on filtered/ranked results

import { resolveRestaurantsByZip, ResolvedRestaurant } from './restaurantResolver';
import { generateRestaurantMealsAI } from './restaurantMealGeneratorAI';
import type { User } from '@shared/schema';
import { violatesDietaryConstraints, getPrimaryDiet } from './allergyGuardrails';
import type { UserProtocolEnvelope } from './protocolEnvelope';

const MIN_RESULTS_TARGET = 6;

const IDENTITY_DIETS = new Set(['vegan', 'kosher', 'halal', 'vegetarian', 'pescatarian']);

interface MealFinderRequest {
  mealQuery: string;
  zipCode: string;
  user?: User;
  dietaryRestrictions?: string[];
  priceRange?: number[];
  protocolBlock?: string;
  builderBlock?: string;
  cuisinePreference?: string | null;
  /** Full protocol envelope — carries hasDiabetes, diabeticGlucoseState, and
   *  all medical condition guidance needed for post-generation validation.
   *  Without this, the diabetic validator and protocol post-scan are silently skipped. */
  protocolEnvelope?: UserProtocolEnvelope;
}

interface RestaurantResult {
  restaurantName: string;
  cuisine: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  matchLabel?: 'Exact match' | 'Matches your diet' | 'Limited match';
  meal: {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    reason: string;
    modifications: string;
    ingredients: string[];
    imageUrl?: string;
    medicalWaiterScript?: string;
  };
  medicalBadges?: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
}

// ─── Cuisine preference query helper ─────────────────────────────────────────

function buildCuisineQuery(cuisine: string, diet: string | null, craving: string): string {
  const label = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
  if (diet && IDENTITY_DIETS.has(diet)) {
    return `${label} ${diet} restaurants serving ${craving}`;
  }
  return `${label} restaurants serving ${craving}`;
}

// ─── Diet-aware query helpers ───────────────────────────────────────────────

function getStrictDietQuery(diet: string, craving: string): string {
  const prefix: Record<string, string> = {
    vegan: 'vegan restaurants',
    kosher: 'kosher restaurants',
    halal: 'halal restaurants',
    vegetarian: 'vegetarian restaurants',
    pescatarian: 'seafood or pescatarian restaurants',
  };
  return `${prefix[diet] ?? `${diet} restaurants`} serving ${craving}`;
}

function getFallbackDietQuery(diet: string, craving: string): string {
  const prefix: Record<string, string> = {
    vegan: 'restaurants with vegan options',
    kosher: 'restaurants with kosher options',
    halal: 'restaurants with halal options',
    vegetarian: 'restaurants with vegetarian options',
    pescatarian: 'restaurants with seafood options',
  };
  return `${prefix[diet] ?? `restaurants with ${diet} options`} near ${craving}`;
}

// ─── Price filtering ─────────────────────────────────────────────────────────

function priceMatches(priceLevel: number | undefined, priceRange: number[]): boolean {
  // When filter is active, exclude restaurants with unknown price_level
  if (priceLevel === undefined || priceLevel === null) return false;
  return priceRange.some((p) => priceLevel >= p && priceLevel <= p) ||
    priceRange.includes(priceLevel);
}

// ─── Distance (Haversine) ────────────────────────────────────────────────────

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a2 =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

// ─── Resolve restaurants with 3-tier fallback ────────────────────────────────

interface ResolvedWithLabel {
  restaurant: ResolvedRestaurant;
  matchLabel: 'Exact match' | 'Matches your diet' | 'Limited match';
}

async function resolveWithFallback(
  mealQuery: string,
  zipCode: string,
  primaryDiet: string | null,
  cuisinePreference?: string | null,
): Promise<{ labeled: ResolvedWithLabel[]; coords?: { lat: number; lng: number } }> {
  const CERT_REQUIRED_DIETS = new Set(['kosher', 'halal']);
  const isCertDiet = primaryDiet && CERT_REQUIRED_DIETS.has(primaryDiet);
  const isIdentity = primaryDiet && IDENTITY_DIETS.has(primaryDiet);
  let labeled: ResolvedWithLabel[] = [];
  let coords: { lat: number; lng: number } | undefined;
  const seen = new Set<string>();

  // ── Pass 0: Cuisine preference (runs first, in parallel with diet passes) ──
  // If the user set a cuisine preference (e.g. Korean, Russian, Thai), bias the
  // Google Places search toward that cuisine type before falling back to diet passes.
  if (cuisinePreference && !isCertDiet) {
    const cuisineQuery = buildCuisineQuery(cuisinePreference, primaryDiet, mealQuery);
    console.log(`🍜 Cuisine pass 0: "${cuisineQuery}"`);
    const cuisinePass = await resolveRestaurantsByZip({
      query: mealQuery,
      zipCode,
      radiusMiles: 10,
      limit: 15,
      overrideQuery: cuisineQuery,
    });
    coords = cuisinePass.coordinates;
    if (cuisinePass.success) {
      for (const r of cuisinePass.restaurants) {
        const key = r.placeId ?? r.name;
        if (!seen.has(key)) {
          labeled.push({ restaurant: r, matchLabel: 'Exact match' });
          seen.add(key);
        }
      }
    }
    console.log(`📍 Cuisine pass: ${labeled.length} results for "${cuisinePreference}" preference`);
  }

  if (isCertDiet && primaryDiet) {
    // Certification-required diets (kosher, halal): strict pass only — no fallback, no mixing
    // Cuisine preference combined query for cert diets (e.g. "Korean kosher restaurants")
    if (cuisinePreference) {
      const certCuisineQuery = `${cuisinePreference.charAt(0).toUpperCase() + cuisinePreference.slice(1)} ${primaryDiet} restaurants`;
      console.log(`🔒 Cert+cuisine pass: "${certCuisineQuery}"`);
      const certCuisine = await resolveRestaurantsByZip({
        query: mealQuery,
        zipCode,
        radiusMiles: 12,
        limit: 15,
        overrideQuery: certCuisineQuery,
      });
      coords = coords ?? certCuisine.coordinates;
      if (certCuisine.success) {
        for (const r of certCuisine.restaurants) {
          const key = r.placeId ?? r.name;
          if (!seen.has(key)) {
            labeled.push({ restaurant: r, matchLabel: 'Exact match' });
            seen.add(key);
          }
        }
      }
    }
    console.log(`🔒 Certification diet "${primaryDiet}" — strict pass only, no fallback`);
    const pass1 = await resolveRestaurantsByZip({
      query: mealQuery,
      zipCode,
      radiusMiles: 8,
      limit: 15,
      overrideQuery: getStrictDietQuery(primaryDiet, mealQuery),
    });
    coords = coords ?? pass1.coordinates;
    if (pass1.success) {
      for (const r of pass1.restaurants) {
        const key = r.placeId ?? r.name;
        if (!seen.has(key)) {
          labeled.push({ restaurant: r, matchLabel: 'Exact match' });
          seen.add(key);
        }
      }
    }
    console.log(`📍 Certification pass: ${labeled.length} results (no fallback applied)`);
  } else if (isIdentity && primaryDiet) {
    // Pass 1 (strict) + Pass 2 (flexible) fire simultaneously — saves 0.5–2s
    console.log(`⚡ Running passes 1+2 in parallel for diet: ${primaryDiet}`);
    const [pass1, pass2] = await Promise.all([
      resolveRestaurantsByZip({
        query: mealQuery,
        zipCode,
        radiusMiles: 5,
        limit: 15,
        overrideQuery: getStrictDietQuery(primaryDiet, mealQuery),
      }),
      resolveRestaurantsByZip({
        query: mealQuery,
        zipCode,
        radiusMiles: 8,
        limit: 15,
        overrideQuery: getFallbackDietQuery(primaryDiet, mealQuery),
      }),
    ]);

    coords = coords ?? pass1.coordinates ?? pass2.coordinates;

    if (pass1.success) {
      for (const r of pass1.restaurants) {
        const key = r.placeId ?? r.name;
        if (!seen.has(key)) {
          labeled.push({ restaurant: r, matchLabel: 'Exact match' });
          seen.add(key);
        }
      }
    }
    if (pass2.success) {
      for (const r of pass2.restaurants) {
        const key = r.placeId ?? r.name;
        if (!seen.has(key)) {
          labeled.push({ restaurant: r, matchLabel: 'Matches your diet' });
          seen.add(key);
        }
      }
    }

    console.log(`📍 Passes 1+2 combined: ${labeled.length} unique restaurants`);

    if (labeled.length < MIN_RESULTS_TARGET) {
      console.log(`⚠️ Passes 1+2 returned ${labeled.length} total — running general fallback (Pass 3)`);
      const pass3 = await resolveRestaurantsByZip({
        query: mealQuery,
        zipCode,
        radiusMiles: 10,
        limit: 15,
        searchMode: 'craving',
      });
      coords = coords ?? pass3.coordinates;

      if (pass3.success) {
        for (const r of pass3.restaurants) {
          const key = r.placeId ?? r.name;
          if (!seen.has(key)) {
            labeled.push({ restaurant: r, matchLabel: 'Limited match' });
            seen.add(key);
          }
        }
      }
    } else {
      console.log(`✅ Early return — skipping pass 3 (${labeled.length} results sufficient)`);
    }
  } else {
    // No identity diet — generic query (cuisine pass 0 already ran above if applicable)
    if (labeled.length < MIN_RESULTS_TARGET) {
      const result = await resolveRestaurantsByZip({
        query: mealQuery,
        zipCode,
        radiusMiles: 5,
        limit: 15,
        searchMode: 'craving',
      });
      coords = coords ?? result.coordinates;
      if (result.success) {
        for (const r of result.restaurants) {
          const key = r.placeId ?? r.name;
          if (!seen.has(key)) {
            labeled.push({ restaurant: r, matchLabel: 'Exact match' });
            seen.add(key);
          }
        }
      }
    }
  }

  return { labeled, coords };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function findMealsNearby(request: MealFinderRequest): Promise<RestaurantResult[]> {
  const { mealQuery, zipCode, user, dietaryRestrictions: bodyDiet, priceRange, protocolBlock, builderBlock, cuisinePreference, protocolEnvelope } = request;

  // Merge body-supplied dietary restrictions with user's DB restrictions
  const effectiveDiet: string[] = Array.from(new Set([
    ...((user?.dietaryRestrictions as string[]) || []),
    ...(bodyDiet || []),
  ]));
  const aiUser = effectiveDiet.length > 0
    ? { ...(user || {}), dietaryRestrictions: effectiveDiet } as typeof user
    : user;

  const primaryDiet = getPrimaryDiet(effectiveDiet) ?? null;
  const effectiveCuisine = cuisinePreference ?? (user?.cuisinePreference as string | null | undefined) ?? null;

  console.log(`🔍 Finding meals for "${mealQuery}" near ZIP ${zipCode} | diet: ${primaryDiet ?? 'none'} | cuisine: ${effectiveCuisine ?? 'any'} | price: ${priceRange ? JSON.stringify(priceRange) : 'any'}`);

  // ── Step 1: Resolve restaurants with diet+cuisine-aware fallback ─────────
  const { labeled, coords } = await resolveWithFallback(mealQuery, zipCode, primaryDiet, effectiveCuisine);

  if (labeled.length === 0) {
    console.warn('⚠️ No restaurants found via Places API — falling back to AI suggestions');
    const fallbackRestaurants = inferRestaurantsFromCraving(mealQuery, zipCode);
    const fallbackPromises = fallbackRestaurants.map(async (restaurant) => {
      try {
        let resolvedAddress = `Near ${zipCode}`;
        try {
          const addrResult = await resolveRestaurantsByZip({
            query: restaurant.name,
            zipCode,
            radiusMiles: 15,
            limit: 1,
            searchMode: 'restaurant',
          });
          if (addrResult.success && addrResult.restaurants.length > 0) {
            resolvedAddress = addrResult.restaurants[0].address;
          }
        } catch {}

        const aiMeals = await generateRestaurantMealsAI({
          restaurantName: restaurant.name,
          cuisine: restaurant.cuisine,
          user: aiUser,
          cravingContext: mealQuery,
          protocolBlock: protocolBlock || undefined,
          builderBlock: builderBlock || undefined,
          protocolEnvelope,
        });
        if (aiMeals && aiMeals.length > 0) {
          return aiMeals.slice(0, 2).map((meal) => ({
            restaurantName: restaurant.name,
            cuisine: restaurant.cuisine,
            address: resolvedAddress,
            meal: {
              name: meal.name,
              description: meal.description,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fat: meal.fat,
              reason: meal.reason,
              modifications: meal.modifications,
              ingredients: meal.ingredients,
              imageUrl: meal.imageUrl,
              medicalWaiterScript: meal.medicalWaiterScript,
            },
            medicalBadges: meal.medicalBadges,
          }));
        }
        return [];
      } catch {
        return [];
      }
    });
    const fallbackResults = (await Promise.all(fallbackPromises)).flat();
    console.log(`✅ Fallback generated ${fallbackResults.length} AI suggestions`);
    return fallbackResults;
  }

  // ── Step 2: Price filtering ───────────────────────────────────────────────
  let filtered = labeled;
  if (priceRange && priceRange.length > 0) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(({ restaurant }) => priceMatches(restaurant.priceLevel, priceRange));
    console.log(`💰 Price filter [${priceRange}]: ${beforeCount} → ${filtered.length} restaurants`);
  }

  // ── Step 3: Sort by rating DESC, distance ASC ─────────────────────────────
  if (coords) {
    filtered.sort((a, b) => {
      const rA = a.restaurant.rating ?? 0;
      const rB = b.restaurant.rating ?? 0;
      if (rB !== rA) return rB - rA;
      const dA = a.restaurant.location ? haversineKm(coords, a.restaurant.location) : 999;
      const dB = b.restaurant.location ? haversineKm(coords, b.restaurant.location) : 999;
      return dA - dB;
    });
  }

  // Take top candidates for meal generation
  const candidates = filtered.slice(0, 6);
  console.log(`🚀 Generating meals for ${candidates.length} ranked restaurants in parallel…`);

  // ── Step 4: AI meal generation ───────────────────────────────────────────
  const restaurantPromises = candidates.map(async ({ restaurant, matchLabel }) => {
    try {
      const aiMeals = await generateRestaurantMealsAI({
        restaurantName: restaurant.name,
        cuisine: restaurant.cuisine,
        user: aiUser,
        cravingContext: mealQuery,
        protocolBlock: protocolBlock || undefined,
        builderBlock: builderBlock || undefined,
        protocolEnvelope,
      });

      if (aiMeals && aiMeals.length > 0) {
        return aiMeals.slice(0, 2).map((meal) => ({
          restaurantName: restaurant.name,
          cuisine: restaurant.cuisine,
          address: restaurant.address,
          rating: restaurant.rating,
          priceLevel: restaurant.priceLevel,
          photoUrl: restaurant.photoUrl,
          matchLabel,
          meal: {
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            reason: meal.reason,
            modifications: meal.modifications,
            ingredients: meal.ingredients,
            imageUrl: meal.imageUrl,
            medicalWaiterScript: meal.medicalWaiterScript,
          },
          medicalBadges: meal.medicalBadges,
        }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const restaurantResults = await Promise.all(restaurantPromises);
  let results: RestaurantResult[] = restaurantResults.flat();

  // ── Defensive final dietary filter ───────────────────────────────────────
  if (effectiveDiet.length > 0 && primaryDiet) {
    const beforeCount = results.length;
    results = results.filter((r) => {
      const fullText = `${r.meal.name} ${r.meal.description} ${r.meal.ingredients.join(' ')}`;
      const { violates } = violatesDietaryConstraints(fullText, effectiveDiet);
      if (violates) console.log(`🚫 Removed "${r.meal.name}" — violates ${primaryDiet} diet`);
      return !violates;
    });
    if (results.length < beforeCount) {
      console.log(`🥗 Diet filter removed ${beforeCount - results.length} meal(s), ${results.length} remaining`);
    }
  }

  console.log(`✅ ${results.length} meal recommendations ready`);
  return results;
}

// ─── Fallback restaurant inference (when Places API returns nothing) ─────────

function inferRestaurantsFromCraving(
  craving: string,
  _zipCode: string,
): Array<{ name: string; cuisine: string }> {
  const q = craving.toLowerCase();

  if (q.includes('burger') || q.includes('beef') || q.includes('smash'))
    return [{ name: 'Five Guys', cuisine: 'American' }, { name: 'Shake Shack', cuisine: 'American' }, { name: "In-N-Out Burger", cuisine: 'American' }];
  if (q.includes('sushi') || q.includes('japanese') || q.includes('ramen') || q.includes('poke'))
    return [{ name: 'Nobu', cuisine: 'Japanese' }, { name: 'Sushi Bar', cuisine: 'Japanese' }, { name: 'Ramen Noodle House', cuisine: 'Japanese' }];
  if (q.includes('taco') || q.includes('mexican') || q.includes('burrito') || q.includes('enchilada'))
    return [{ name: 'Chipotle Mexican Grill', cuisine: 'Mexican' }, { name: 'Taco Bell', cuisine: 'Mexican' }, { name: 'Qdoba Mexican Eats', cuisine: 'Mexican' }];
  if (q.includes('pizza') || q.includes('italian') || q.includes('pasta'))
    return [{ name: 'Olive Garden', cuisine: 'Italian' }, { name: 'Pizza Hut', cuisine: 'Italian' }, { name: "Domino's", cuisine: 'Italian' }];
  if (q.includes('steak') || q.includes('grilled') || q.includes('bbq') || q.includes('barbecue') || q.includes('ribs'))
    return [{ name: 'Texas Roadhouse', cuisine: 'American' }, { name: 'Outback Steakhouse', cuisine: 'American' }, { name: 'LongHorn Steakhouse', cuisine: 'American' }];
  if (q.includes('chinese') || q.includes('dim sum') || q.includes('lo mein') || q.includes('fried rice'))
    return [{ name: "PF Chang's", cuisine: 'Chinese' }, { name: 'Panda Express', cuisine: 'Chinese' }, { name: 'Mandarin House', cuisine: 'Chinese' }];
  if (q.includes('indian') || q.includes('curry') || q.includes('tandoori') || q.includes('naan'))
    return [{ name: 'Bombay Palace', cuisine: 'Indian' }, { name: 'India Palace', cuisine: 'Indian' }, { name: 'Spice Garden', cuisine: 'Indian' }];
  if (q.includes('mediterranean') || q.includes('greek') || q.includes('gyro') || q.includes('hummus') || q.includes('falafel'))
    return [{ name: 'The Great Greek Mediterranean Grill', cuisine: 'Mediterranean' }, { name: 'Cosi', cuisine: 'Mediterranean' }, { name: 'Zoes Kitchen', cuisine: 'Mediterranean' }];
  if (q.includes('thai') || q.includes('pad thai') || q.includes('tom yum'))
    return [{ name: 'Thai Orchid', cuisine: 'Thai' }, { name: 'Lotus of Siam', cuisine: 'Thai' }, { name: 'Bangkok Garden', cuisine: 'Thai' }];
  if (q.includes('chicken') || q.includes('wings') || q.includes('nuggets') || q.includes('fried'))
    return [{ name: "Chick-fil-A", cuisine: 'American' }, { name: "Raising Cane's", cuisine: 'American' }, { name: 'Wingstop', cuisine: 'American' }];
  if (q.includes('salad') || q.includes('healthy') || q.includes('bowl') || q.includes('wrap') || q.includes('vegan') || q.includes('vegetarian'))
    return [{ name: 'Sweetgreen', cuisine: 'American' }, { name: 'Panera Bread', cuisine: 'American' }, { name: 'Freshii', cuisine: 'American' }];
  if (q.includes('seafood') || q.includes('fish') || q.includes('shrimp') || q.includes('lobster') || q.includes('salmon'))
    return [{ name: 'Red Lobster', cuisine: 'Seafood' }, { name: 'Bonefish Grill', cuisine: 'Seafood' }, { name: 'The Boiling Crab', cuisine: 'Seafood' }];
  if (q.includes('breakfast') || q.includes('brunch') || q.includes('eggs') || q.includes('pancake') || q.includes('waffle'))
    return [{ name: 'IHOP', cuisine: 'American' }, { name: 'First Watch', cuisine: 'American' }, { name: 'Cracker Barrel', cuisine: 'American' }];

  return [{ name: "Applebee's", cuisine: 'American' }, { name: "Chili's Grill & Bar", cuisine: 'American' }, { name: 'TGI Fridays', cuisine: 'American' }];
}
