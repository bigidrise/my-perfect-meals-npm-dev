import { Router } from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import {
  assembleLocationContext,
  buildVenueContextBlock,
  getVenuesPublicPayload,
} from "../services/locationContext/engine";
import { discoverVenue } from "../services/locationContext/venueDiscovery";
import { resolveDailyNutritionState } from "../services/nutritionStateService";
import { buildCravingInstructions, buildRemainingMacrosBlock } from "../services/restaurantMealGeneratorAI";
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "../services/glp1/resolveGLP1GlobalContext";

const router = Router();

router.get("/venues", (_req, res) => {
  res.json({ venues: getVenuesPublicPayload() });
});

router.get("/venues/discover", async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) {
    return res.status(400).json({ error: "q is required" });
  }
  try {
    const result = await discoverVenue(q);
    res.json(result);
  } catch (err: any) {
    console.error("[Getaway] Venue discover error:", err);
    res.status(500).json({ error: "Failed to discover venue" });
  }
});

router.post("/coach", async (req, res) => {
  try {
    const { message, venueId, zoneId, discoveredVenue } = req.body;
    const userId = (req as AuthenticatedRequest).authUser.id;

    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    let user: any = null;
    let nutritionContext: any = null;
    try {
      const [found] = await db.select().from(users).where(eq(users.id, userId));
      if (found) user = found;
      nutritionContext = await getActiveNutritionContext(userId);
    } catch (e) {
      console.warn("[Getaway] Could not load user profile:", e);
    }

    const profileLines: string[] = [];
    if (user) {
      const dietRestrictions = Array.isArray(user.dietaryRestrictions)
        ? user.dietaryRestrictions
        : user.dietaryRestrictions ? [user.dietaryRestrictions] : [];
      if (dietRestrictions.length > 0) {
        profileLines.push(`Diet: ${dietRestrictions.join(", ")}`);
      }
      const allergies = Array.isArray(user.allergies)
        ? user.allergies
        : user.allergies ? [user.allergies] : [];
      if (allergies.length > 0) {
        profileLines.push(`ALLERGIES — NEVER RECOMMEND THESE: ${allergies.join(", ")}`);
      }
      const conditions = Array.isArray(user.healthConditions)
        ? user.healthConditions
        : user.healthConditions ? [user.healthConditions] : [];
      if (conditions.length > 0) {
        profileLines.push(`Health conditions: ${conditions.join(", ")}`);
      }
      if (user.goalType) {
        profileLines.push(`Goal: ${user.goalType}`);
      }
    }
    const profileBlock = profileLines.length > 0
      ? `USER PROFILE:\n${profileLines.join("\n")}`
      : "USER PROFILE: General healthy eating, no specific restrictions provided.";

    let locationBlock = "";
    let locationZoneLabel = "";

    if (venueId) {
      const ctx = assembleLocationContext(venueId, zoneId);
      if (ctx) {
        locationBlock = buildVenueContextBlock(ctx);
        if (ctx.zone) {
          const zoneTypeLabel = ctx.zone.type.charAt(0).toUpperCase() + ctx.zone.type.slice(1);
          locationZoneLabel = `${zoneTypeLabel}: ${ctx.zone.name}`;
        }
      }
    } else if (discoveredVenue?.name) {
      const lines: string[] = [];
      lines.push(`LOCATION CONTEXT (confidence: medium — identified via Google Places):`);
      lines.push(`Venue: ${discoveredVenue.name}`);
      if (discoveredVenue.type) {
        lines.push(`Type: ${String(discoveredVenue.type).replace("_", " ")}`);
      }
      if (discoveredVenue.address) {
        lines.push(`Address: ${discoveredVenue.address}`);
      }
      if (discoveredVenue.zoneName) {
        const zoneTypeLabel = discoveredVenue.zoneType
          ? String(discoveredVenue.zoneType).charAt(0).toUpperCase() + String(discoveredVenue.zoneType).slice(1)
          : "Zone";
        lines.push(`${zoneTypeLabel}: ${discoveredVenue.zoneName}`);
        lines.push(`Search precision: Zone-level — restrict recommendations to food options in ${discoveredVenue.zoneName} specifically.`);
        locationZoneLabel = `${zoneTypeLabel}: ${discoveredVenue.zoneName}`;
      } else {
        lines.push(`Zone: Not specified — give general venue recommendations.`);
      }
      locationBlock = lines.join("\n");
    }

    const systemPrompt = `You are a personal nutrition coach in the My Perfect Meals app called the Getaway Coach. Your specialty: helping users find the BEST food options wherever life takes them — Disney, Universal, airports, cruise ships, resorts, arenas, state fairs, and more.

When a user tells you where they are, you:
1. Draw on your detailed knowledge of that venue's actual food outlets, restaurants, and stands
2. Cross-reference against the user's dietary profile, allergies, and medical protocols
3. Recommend 2-3 specific, named options that actually exist at that venue
4. Explain briefly why each fits their goals
5. Flag 1-2 items to avoid ONLY if there is a meaningful medical/dietary reason
6. End with a warm 1-2 sentence coach note — supportive, never preachy

TONE: Coach voice. Acknowledge they're somewhere fun. Vacation doesn't mean derailing — it means choosing wisely. Keep every section concise.

ALLERGY RULE: If the user has listed allergies, do NOT recommend anything that contains or may contain those allergens. Non-negotiable.

PROTOCOL RULE: If the user has an anti-inflammatory, diabetic, cardiac, GLP-1, or other active protocol, filter all recommendations accordingly.

FAMILY AWARENESS RULE: Many users visiting theme parks, resorts, cruise ships, airports, and vacation destinations are traveling with spouses, children, or extended family. When appropriate, briefly note whether a recommended location or item is family-friendly — for example: "Good option for families", "Children often enjoy the available menu choices", "Easy choice if adults and children are eating together", or "Family-friendly location with multiple food options". Do not create separate child meal plans. Do not override the user's medical conditions, dietary preferences, or protocols. Family awareness is additive guidance only — it should feel natural, not forced. Omit it if the venue or context clearly does not apply (e.g. a solo business traveler at an airport lounge).

LOCATION CONTEXT RULE: When a specific terminal, land, deck, section, or zone is provided, restrict recommendations to food outlets specifically located in that zone. Do not recommend outlets in other zones unless the user has not specified a zone. When zone is provided, the "where" field in bestChoices must include the zone name.

DISCOVERED VENUE RULE: If the LOCATION CONTEXT says "identified via Google Places", the venue is real but may not be in your training data for specific food outlets. In this case: use your general knowledge of that venue type and location, clearly note which specific restaurants/stands you are recommending, and if you are uncertain about a specific outlet's presence at this location, say so briefly. Always give your best guidance rather than refusing to help.

VENUE KNOWLEDGE: You know real menus at:
- Disney World / Disneyland: Flame Tree Barbecue, Satu'li Canteen, Be Our Guest, Pecos Bill, Columbia Harbour House, Skipper Canteen, Sunshine Seasons, Whispering Canyon Cafe, and more
- Universal Studios: Leaky Cauldron, Mythos Restaurant, Louie's Italian, Three Broomsticks, Fast Food Boulevard, Today Cafe
- Six Flags: Panda Express, Johnny Rockets, Subway, Fresh Market Square
- Major Airports (LAX, DFW, ORD, ATL, JFK): Hudson News, Chick-fil-A, Shake Shack, Dunkin, various sit-down options by terminal
- Cruise ships (Carnival, Royal Caribbean, NCL, Disney Cruise): main dining rooms, buffet options, specialty restaurants, casual pool deck food
- General advice for venues you are less certain about

RESPONSE FORMAT — return valid JSON only, no markdown, no code fences:
{
  "venue": "inferred venue name (e.g. Disney World Magic Kingdom)",
  "venueType": "theme park | airport | cruise | resort | arena | fair | other",
  "zone": "terminal/land/deck name if applicable, or null",
  "bestChoices": [
    {
      "name": "Specific menu item name",
      "where": "Restaurant or stand name at the venue, including zone if known",
      "why": "One sentence — why this fits their profile",
      "estimatedCalories": 0,
      "estimatedProteinGrams": 0,
      "estimatedFatGrams": 0
    }
  ],
  "whyTheyFit": ["Bullet reason fitting their goals or protocol", "Another reason"],
  "avoid": [
    { "item": "Item or category name", "reason": "Brief reason related to their profile" }
  ],
  "familyNote": ["One practical tip about eating here with kids or family", "Another tip if applicable — e.g. which location has kid-friendly choices, what the kids menu typically includes, or how the family can eat together without splitting up"],
  "coachNote": "1-2 sentences. Warm and practical. Remind them vacation is about living, just smarter."
}

Keep bestChoices to 2-3 items. The avoid array should be [] if nothing is specifically problematic for this user. The familyNote array should have 1-2 practical tips about eating at this venue with family or children. For venues like theme parks, cruises, and resorts this is almost always relevant. For a solo business airport context it can be []. The zone field should be null when no zone was specified.`;

    // ── Craving intent: extract the user's food request from the message ─────
    const cravingInstructions = buildCravingInstructions(message.trim(), nutritionContext?.envelope?.hasDiabetes ?? false);

    // ── GLP-1 canonical context — fail closed ─────────────────────────────────
    // Resolve before any other context so a resolver failure returns 503 rather
    // than silently serving an unguarded recommendation to a GLP-1 patient.
    const todayISO = new Date().toISOString().slice(0, 10);
    const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
    if (glp1Ctx === null) {
      return res.status(503).json({ error: "Clinical guidance temporarily unavailable. Please try again.", retryable: true });
    }
    if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
      return res.status(503).json({ error: "GLP-1 clinical targets temporarily unavailable. Please try again.", retryable: true });
    }

    let remainingMacrosBlock = "";
    let glp1Block = "";
    const [dailyState] = await Promise.all([
      resolveDailyNutritionState(userId, todayISO).catch(() => null),
    ]);
    if (dailyState) remainingMacrosBlock = buildRemainingMacrosBlock(dailyState.remaining);
    if (glp1Ctx) glp1Block = buildGLP1RecommendationBlock(glp1Ctx);

    const contextParts: string[] = [profileBlock];
    if (nutritionContext?.combinedBlock) contextParts.push(nutritionContext.combinedBlock);
    if (glp1Block) contextParts.push(glp1Block);
    if (cravingInstructions) contextParts.push(cravingInstructions);
    if (remainingMacrosBlock) contextParts.push(remainingMacrosBlock);
    if (locationBlock) contextParts.push(locationBlock);
    const userPrompt = `${contextParts.join("\n\n")}

USER MESSAGE: "${message.trim()}"

Based on where this person is right now, give them their best food guidance.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 900,
      response_format: { type: "json_object" }
    });

    const raw = completion.choices[0].message.content || "{}";
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      console.error("[Getaway] Failed to parse AI JSON:", raw);
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    if (locationZoneLabel && !result.zone) {
      result.zone = locationZoneLabel;
    }

    // ── GLP-1 post-gen bestChoice filtering ───────────────────────────────────
    // Each bestChoice now includes estimatedFatGrams from the AI response schema.
    // Filter any choice whose estimated fat exceeds the patient-specific ceiling
    // so non-compliant items never reach a GLP-1 patient.
    if (glp1Ctx.isActive && glp1Ctx.resolvedTargets && Array.isArray(result.bestChoices)) {
      const t = glp1Ctx.resolvedTargets;
      const before = result.bestChoices.length;
      result.bestChoices = result.bestChoices.filter((choice: any) => {
        const fat = Number(choice.estimatedFatGrams);
        if (Number.isFinite(fat) && fat > t.maximumToleratedFatGrams) {
          console.warn(`[GETAWAY/GLP-1] Filtered "${choice.name}" — fat ${fat}g > ceiling ${t.maximumToleratedFatGrams}g`);
          return false;
        }
        return true;
      });
      if (result.bestChoices.length < before) {
        console.log(`[GETAWAY/GLP-1] Filtered ${before - result.bestChoices.length} non-compliant choices`);
      }
    }

    res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[Getaway] Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate getaway guidance" });
  }
});

export default router;
