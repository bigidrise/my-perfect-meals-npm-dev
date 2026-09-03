# System 10: Signature Kitchen & Creator Studio (SKCS)

**Classification:** Creator Economy — B2B2C Platform Layer
**Status:** Active, Production (Beta)

---

## Purpose

The Signature Kitchen & Creator Studio is MPM's creator economy infrastructure. It allows professional chefs, coaches, and culinary personalities to operate branded "Signature Kitchens" within the MPM platform — customizing the meal generation experience for their audience without modifying or bypassing the underlying clinical and safety infrastructure.

This is the system that transforms MPM from a consumer app into a **white-label nutrition platform** for culinary creators.

---

## What a Signature Kitchen Is

A Signature Kitchen is a branded generation experience where:
- The meal output uses the chef's naming conventions, style, and voice
- The description, instructions, and presentation reflect the chef's culinary identity
- The generation still runs through UP-FEM — medical and dietary safety is never compromised
- The chef's content layer sits *on top of* the core generation engine, not inside it

This separation is critical: **a chef can control the experience, but not the safety rules.**

---

## Creator System Layer Architecture

```
User request ("I want a Signature Kitchen meal")
    │
    ▼
Creator System Config Lookup (creator_system_configs in DB)
    ├── Load chef's style profile
    ├── Load chef's naming conventions
    └── Load chef's description template
         │
         ▼
    UP-FEM Enforcement (unmodified — chef cannot bypass)
         │
         ▼
    AI Generation with Creator Overlay
    ├── Meal name styled to chef's brand
    ├── Description uses chef's voice/style
    └── Instructions follow chef's technique preferences
         │
         ▼
    Output: Branded meal card (chef's name, style, logo)
```

---

## Creator Studio (Admin Side)

Chefs and partner brands access the Creator Studio to:
- Configure their kitchen's name, branding, and style guidelines
- Upload featured meals as templates
- Set flavor profile defaults for their kitchen
- Link their kitchen to a ProCare studio for client enrollment
- View analytics on how their kitchen is performing

**Key pages**: `client/src/pages/creator/CreatorStudioPage.tsx`, `CreatorStudioLanding.tsx`, `CreatorSetupPage.tsx`

---

## Template Matching System

Before falling back to generic AI generation, the Creator Studio checks whether a user's request matches the chef's signature meal library. If a match is found:

1. The chef's existing template is used as the generation seed
2. The AI personalizes it to the user's protocol (via UP-FEM)
3. The output maintains the chef's branding while meeting the user's constraints

This creates a "deterministic first, generative fallback" architecture that preserves chef identity while remaining fully personalized.

---

## Partner Tiers

| Tier | Description |
|---|---|
| Signature Kitchen Starter | Basic kitchen configuration, branded meals |
| Signature Kitchen Pro | Template library, analytics, client enrollment |
| Signature Kitchen Partner | Full studio integration, ProCare linking, white-label capability |

**Key config**: `server/config/coaches.ts`, `client/src/config/coaches.ts`

---

## Key Files

| File | Role |
|---|---|
| `server/db/schema/creators.ts` | Creator and kitchen data schema |
| `client/src/pages/kitchen/SignatureKitchenPage.tsx` | User-facing kitchen experience |
| `client/src/pages/kitchen/SignatureKitchenHubPage.tsx` | Kitchen discovery hub |
| `client/src/pages/creator/CreatorStudioPage.tsx` | Creator admin studio |
| `client/src/pages/creator/CreatorSetupPage.tsx` | Kitchen onboarding |
| `server/routes/studioGenerator.ts` | Studio-specific generation route |
| `client/src/lib/professionalBuilderMap.ts` | Builder-to-creator linkage |

---

## What Makes This Unique

1. **Safety-insulated creator layer** — chefs can customize the output style without touching the enforcement layer. A chef cannot accidentally remove a user's allergy restriction.
2. **Template-first generation** — checking against a chef's existing catalog before invoking full generative AI is an efficiency and consistency optimization not seen in other creator nutrition platforms
3. **Clinical-chef bridge** — a chef's kitchen can be linked to a ProCare studio, creating a monetizable professional relationship where the chef's recipes feed their clients' clinical nutrition plans
4. **Infrastructure, not just features** — the creator system is designed to support multiple chefs and brands simultaneously, each with isolated configurations

---

## Integration

- **Sits on top of**: UP-FEM (System 1) — always runs through safety enforcement
- **Linked to**: ProCare (System 5) — chef kitchens can be coach studios
- **Powers**: Lifestyle and creation pages with branded generation
- **Commercial layer**: Stripe-gated partner tiers
