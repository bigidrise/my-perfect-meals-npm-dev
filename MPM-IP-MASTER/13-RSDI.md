# System 13: Restaurant & Social Dining Intelligence (RSDI)

**Classification:** Lifestyle Intelligence — Real-World Dining Support
**Status:** Active, Production

---

## Purpose

The Restaurant & Social Dining Intelligence system helps users navigate eating outside their home — at restaurants, social gatherings, holidays, parties, and bars — while staying within their nutritional and dietary constraints.

This addresses a gap in virtually every nutrition platform:

> **Plans break at restaurants. Protocols break at dinner parties. No existing nutrition app meaningfully helps users navigate real social dining situations.**

RSDI bridges the gap between the controlled environment of meal planning and the uncontrolled environment of real life.

---

## Components

### 1. Restaurant Guidance AI
When a user is going to a restaurant, the system:
- Accepts the restaurant name or cuisine type
- Queries restaurant data (via restaurant API integration)
- Applies the user's UP-FEM protocol to the menu context
- Generates specific ordering guidance: what to order, what to avoid, how to modify

The AI doesn't generate a meal — it generates **decision support for a real menu.**

**Key route**: `server/routes/` (restaurant-related routes)
**Key component**: `client/src/pages/SocialRestaurantGuide.tsx`

### 2. Social Meal Navigation
For social events (dinner parties, gatherings, holidays), the system provides:
- Situation-aware guidance ("You're at a holiday party buffet")
- Specific decision frameworks based on the user's protocol
- Portion guidance for common social food scenarios
- "Safe bets" — foods likely to be available that meet the user's constraints

**Key page**: `client/src/pages/lifestyle/GatheringsPage.tsx`
**Key hub**: `client/src/pages/SocializingHub.tsx`

### 3. Fast Food Guide
Protocol-aware fast food ordering guidance for the major chains. When a user is at McDonald's, Chipotle, or a similar chain, the system provides:
- Which menu items are closest to compliant
- How to modify orders
- What to avoid for their specific protocol

**Key page**: `client/src/pages/FastFoodGuidePage.tsx`

### 4. Holiday Feast Engine
Multi-course meal generation for holiday events. Generates a complete feast (appetizer through dessert) calibrated to:
- Serving size for N guests
- The host's dietary protocol (and optionally, guest accommodations)
- Holiday-specific cuisine traditions

This is distinct from standard meal generation — it is a multi-output, sequenced generation event producing a complete menu.

### 5. Wine, Beer & Spirits Pairing
AI-powered pairing guidance for alcohol (framed as educational, not prescription). Includes:
- Wine pairing recommendations by meal type and cuisine
- Beer pairing guidance
- Bourbon and spirits education
- Caloric and carbohydrate context for protocol-aware users

**Key pages**: `client/src/pages/wine-pairing.tsx`, `client/src/pages/beer-pairing.tsx`, `client/src/pages/bourbon-spirits.tsx`

### 6. Meal Pairing AI
Beyond beverages — general food pairing intelligence that suggests what goes well with a specific ingredient, cuisine, or meal component.

**Key page**: `client/src/pages/meal-pairing-ai.tsx`

---

## Key Files

| File | Role |
|---|---|
| `client/src/pages/SocializingHub.tsx` | Social dining hub |
| `client/src/pages/SocialRestaurantGuide.tsx` | Restaurant navigation |
| `client/src/pages/FastFoodGuidePage.tsx` | Fast food guide |
| `client/src/pages/lifestyle/GatheringsPage.tsx` | Social event navigation |
| `client/src/pages/wine-pairing.tsx` | Wine pairing AI |
| `client/src/pages/beer-pairing.tsx` | Beer pairing AI |
| `client/src/pages/bourbon-spirits.tsx` | Spirits education |
| `client/src/pages/meal-pairing-ai.tsx` | Food pairing AI |
| `server/routes/facebook.ts` | Social dining intent capture |

---

## What Makes This Unique

1. **Real-world protocol application** — UP-FEM constraints follow the user into the restaurant, not just into their home kitchen
2. **Social context awareness** — the system understands that "dinner party" has different constraints than "restaurant lunch" and responds accordingly
3. **Holiday feast engine** — multi-course, multi-output generation is architecturally distinct from single-meal generation and uncommon in consumer platforms
4. **Caloric-aware beverage pairing** — alcohol pairing is presented with nutritional context, which is rare and valuable for users managing macros

---

## Integration

- **Enforces**: UP-FEM (System 1) — protocol constraints apply in all restaurant contexts
- **Reads from**: Restaurant data APIs
- **Works alongside**: BMAS (System 4) — social dining patterns are tracked as behavioral events
- **Feeds**: UMGP (System 11) — restaurant meal generation is a specialized pipeline context
