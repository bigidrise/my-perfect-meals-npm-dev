import { Router } from "express";
import OpenAI from "openai";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";

const router = Router();

router.post("/coach", async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    let user: any = null;
    let nutritionContext: any = null;
    if (userId) {
      try {
        const [found] = await db.select().from(users).where(eq(users.id, userId));
        if (found) user = found;
        nutritionContext = await getActiveNutritionContext(userId);
      } catch (e) {
        console.warn("[Getaway] Could not load user profile:", e);
      }
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
    if (nutritionContext?.protocolLabel) {
      profileLines.push(`Active nutrition protocol: ${nutritionContext.protocolLabel}`);
    }
    if (nutritionContext?.activeBuilder) {
      profileLines.push(`Active meal builder: ${nutritionContext.activeBuilder}`);
    }

    const profileBlock = profileLines.length > 0
      ? `USER PROFILE:\n${profileLines.join("\n")}`
      : "USER PROFILE: General healthy eating, no specific restrictions provided.";

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
  "bestChoices": [
    {
      "name": "Specific menu item name",
      "where": "Restaurant or stand name at the venue",
      "why": "One sentence — why this fits their profile"
    }
  ],
  "whyTheyFit": ["Bullet reason fitting their goals or protocol", "Another reason"],
  "avoid": [
    { "item": "Item or category name", "reason": "Brief reason related to their profile" }
  ],
  "coachNote": "1-2 sentences. Warm and practical. Remind them vacation is about living, just smarter."
}

Keep bestChoices to 2-3 items. The avoid array should be [] if nothing is specifically problematic for this user.`;

    const userPrompt = `${profileBlock}

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

    res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[Getaway] Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate getaway guidance" });
  }
});

export default router;
