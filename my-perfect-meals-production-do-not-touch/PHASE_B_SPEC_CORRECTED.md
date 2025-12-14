# 🚨 **PHASE B — IMPLEMENTATION SPEC (ARCHITECT APPROVED)**

**Date:** November 23, 2025  
**Status:** Ready for Implementation  
**Verified Against:** Router.tsx + PHASE_A_SPEC_CORRECTED.md

---

# 🔶 **PHASE B — BUTTON & HUB ROUTING SYSTEM**

This phase covers **B.1 (Routing)** and **B.2 (Hub Behavior)**.

**NOT included in Phase B:**
- ❌ Spotlight highlighting
- ❌ Walkthrough guided steps
- ❌ Visual dimming animations

**ONLY included in Phase B:**
- ✅ Keyword → Hub/Page routing
- ✅ Hub-first navigation
- ✅ Hub behavior logic (small vs large)

---

# 🔶 **PHASE B.1 — ROUTING RULES**

## **1. Create CanonicalAliasRegistry.ts**

**Location:** `client/src/components/copilot/CanonicalAliasRegistry.ts`

**Structure:**
```typescript
interface FeatureDefinition {
  id: string;              // Unique feature ID
  primaryRoute: string;    // Main navigation path
  isHub: boolean;          // True for hubs, false for direct pages
  hubSize?: "small" | "large"; // Only for hubs
  keywords: string[];      // Normalized keyword aliases
  subOptions?: SubOption[]; // Sub-pages within hub
}

interface SubOption {
  id: string;
  label: string;
  route: string;
  aliases: string[];
}
```

## **2. Hub-First Routing Logic**

If feature has a hub, ALWAYS navigate to hub first:

- "Craving Creator" → `/craving-creator-landing` (hub)
- "Kids meals" → `/healthy-kids-meals` (hub)
- "GLP-1" → `/glp1-hub` (hub)
- "Alcohol" → `/alcohol-hub` (hub)

After hub opens, user can select sub-option.

## **3. Direct Page Routing**

Features without hubs go directly to page:

- "Fridge Rescue" → `/fridge-rescue`
- "Macro Calculator" → `/macro-counter`
- "My Biometrics" → `/biometrics`
- "Weekly Meal Builder" → `/weekly-meal-board`

---

# 🔶 **PHASE B.2 — HUB BEHAVIOR LOGIC**

## **Small Hubs (1-2 sub-options)**

Copilot announces options explicitly:

### **Craving Hub** (2 options)
> "Do you want **Craving Creator** or **Craving Premades**?"

### **Socializing Hub** (2 options)
> "Do you want **Restaurant Guide** or **Find Meals Near Me**?"

### **Kids Meals Hub** (2 options)
> "Do you want **Kids Meals** or **Toddler Meals**?"

### **Diabetic Hub** (2 options)
> "Do you want **Diabetes Support** or **Diabetic Menu Builder**?"

### **GLP-1 Hub** (1 option)
> "Would you like to open the **GLP-1 Meal Builder**?"

### **Supplement Hub** (2 options)
> "Do you want **Supplement Hub** or **Supplement Education**?"

## **Large Hubs (3+ sub-options)**

Copilot says generic prompt only:

### **Spirits & Lifestyle Hub** (8 options)
> "Choose your page."

**Behavior:**
- Remove blur immediately
- User taps button OR speaks page name
- Copilot listens for sub-option keywords without listing them

---

# 🔶 **CANONICAL HUB LIST (VERIFIED ROUTES ONLY)**

## **Hubs (Hub-First Routing)** — 7 Total

| Hub Name | Route | Component | Hub Size | Sub-Options Count |
|----------|-------|-----------|----------|-------------------|
| Craving Hub | `/craving-creator-landing` | CravingCreatorLanding.tsx | small | 2 |
| Spirits & Lifestyle Hub | `/alcohol-hub` | AlcoholHubLanding.tsx | large | 8 |
| Socializing Hub | `/social-hub` | SocializingHub.tsx | small | 2 |
| Kids Meals Hub | `/healthy-kids-meals` | HealthyKidsMeals.tsx | small | 2 |
| Diabetic Hub | `/diabetic-hub` | DiabeticHub.tsx | small | 2 |
| GLP-1 Hub | `/glp1-hub` | GLP1Hub.tsx | small | 1 |
| Supplement Hub | `/supplement-hub-landing` | SupplementHubLanding.tsx | small | 2 |

## **Direct Pages (No Hub Routing)** — 11 Total

| Page Name | Route | Keywords |
|-----------|-------|----------|
| Fridge Rescue | `/fridge-rescue` | "fridge", "rescue", "ingredients" |
| Macro Calculator | `/macro-counter` | "macros", "calculator", "protein" |
| My Biometrics | `/biometrics` | "biometrics", "weight", "tracking" |
| Master Shopping List | `/shopping-list-v2` | "shopping", "groceries", "list" |
| Weekly Meal Builder | `/weekly-meal-board` | "weekly", "meal board", "planner" |
| Get Inspiration | `/get-inspiration` | "inspiration", "ideas", "meal ideas" |
| Anti-Inflammatory Menu Builder | `/anti-inflammatory-menu-builder` | "anti-inflammatory", "inflammation" |
| Beach Body Meal Board | `/beach-body-meal-board` | "beach body", "competition", "shred" |
| Planner | `/planner` | "planner", "planning board" |
| Lifestyle | `/lifestyle` | "lifestyle", "main lifestyle" |
| Pro Care | `/procare-cover` | "pro care", "professional care" |

---

# 🔶 **DETAILED SUB-OPTIONS (FOR REGISTRY)**

## **1. Craving Hub**
```typescript
{
  id: "CRAVING_HUB",
  primaryRoute: "/craving-creator-landing",
  isHub: true,
  hubSize: "small",
  keywords: ["cravings", "craving creator", "craving hub", "satisfy cravings"],
  subOptions: [
    {
      id: "CRAVING_CREATOR",
      label: "Craving Creator",
      route: "/craving-creator",
      aliases: ["creator", "create", "custom craving"]
    },
    {
      id: "CRAVING_PREMADES",
      label: "Craving Premades",
      route: "/craving-presets",
      aliases: ["premades", "presets", "premade cravings"]
    }
  ]
}
```

## **2. Spirits & Lifestyle Hub**
```typescript
{
  id: "ALCOHOL_HUB",
  primaryRoute: "/alcohol-hub",
  isHub: true,
  hubSize: "large",
  keywords: ["alcohol", "spirits", "drinks", "cocktails", "lean cocktails"],
  subOptions: [
    { id: "LEAN_SOCIAL", label: "Alcohol Lean and Social", route: "/alcohol/lean-and-social", aliases: ["lean", "social", "lean and social"] },
    { id: "MOCKTAILS", label: "Mocktails", route: "/mocktails-low-cal-mixers", aliases: ["mocktails", "alcohol-free", "non-alcoholic"] },
    { id: "MEAL_PAIRING", label: "Meal Pairing", route: "/meal-pairing-ai", aliases: ["meal pairing", "pairing", "pair meal"] },
    { id: "WINE_PAIRING", label: "Wine Pairing", route: "/wine-pairing", aliases: ["wine", "wine pairing"] },
    { id: "BEER_PAIRING", label: "Beer Pairing", route: "/beer-pairing", aliases: ["beer", "beer pairing"] },
    { id: "BOURBON_PAIRING", label: "Bourbon Pairing", route: "/bourbon-spirits", aliases: ["bourbon", "spirits", "whiskey"] },
    { id: "ALCOHOL_LOG", label: "Alcohol Log", route: "/alcohol-log", aliases: ["log", "track alcohol"] },
    { id: "WEANING_OFF", label: "Weaning Off Tool", route: "/weaning-off-tool", aliases: ["weaning", "taper"] }
  ]
}
```

## **3. Socializing Hub**
```typescript
{
  id: "SOCIAL_HUB",
  primaryRoute: "/social-hub",
  isHub: true,
  hubSize: "small",
  keywords: ["restaurant", "socializing", "eating out", "social meals"],
  subOptions: [
    { id: "RESTAURANT_GUIDE", label: "Restaurant Guide", route: "/social-hub/restaurant-guide", aliases: ["restaurant guide", "guide"] },
    { id: "FIND_MEALS", label: "Find Meals Near Me", route: "/social-hub/find", aliases: ["find meals", "near me", "find"] }
  ]
}
```

## **4. Kids Meals Hub**
```typescript
{
  id: "KIDS_HUB",
  primaryRoute: "/healthy-kids-meals",
  isHub: true,
  hubSize: "small",
  keywords: ["kids", "kids meals", "children", "healthy kids"],
  subOptions: [
    { id: "KIDS_MEALS", label: "Kids Meals", route: "/kids-meals", aliases: ["kids meals", "children meals"] },
    { id: "TODDLER_MEALS", label: "Toddler Meals", route: "/toddler-meals", aliases: ["toddler", "toddler meals"] }
  ]
}
```

## **5. Diabetic Hub**
```typescript
{
  id: "DIABETIC_HUB",
  primaryRoute: "/diabetic-hub",
  isHub: true,
  hubSize: "small",
  keywords: ["diabetic", "diabetes", "blood sugar", "glucose"],
  subOptions: [
    { id: "DIABETES_SUPPORT", label: "Diabetes Support", route: "/diabetes-support", aliases: ["support", "diabetes support"] },
    { id: "DIABETIC_BUILDER", label: "Diabetic Menu Builder", route: "/diabetic-menu-builder", aliases: ["builder", "menu builder", "diabetic builder"] }
  ]
}
```

## **6. GLP-1 Hub**
```typescript
{
  id: "GLP1_HUB",
  primaryRoute: "/glp1-hub",
  isHub: true,
  hubSize: "small",
  keywords: ["glp", "glp-1", "glp1", "ozempic", "wegovy", "semaglutide"],
  subOptions: [
    { id: "GLP1_BUILDER", label: "GLP-1 Meal Builder", route: "/glp1-meal-builder", aliases: ["builder", "meal builder", "glp1 builder"] }
  ]
}
```

## **7. Supplement Hub**
```typescript
{
  id: "SUPPLEMENT_HUB",
  primaryRoute: "/supplement-hub-landing",
  isHub: true,
  hubSize: "small",
  keywords: ["supplements", "supplement hub", "vitamins", "nutrition supplements"],
  subOptions: [
    { id: "SUPPLEMENT_BROWSE", label: "Supplement Hub", route: "/supplement-hub", aliases: ["browse", "hub", "products"] },
    { id: "SUPPLEMENT_EDUCATION", label: "Supplement Education", route: "/supplement-education", aliases: ["education", "learn", "supplement education"] }
  ]
}
```

---

# 🔶 **ARCHITECT IMPLEMENTATION CHECKLIST**

## **Phase B.1 - Routing**
- [ ] Create `CanonicalAliasRegistry.ts` with 7 verified hubs
- [ ] Add 11 direct pages to registry
- [ ] Update `CopilotCommandRegistry.ts` to use registry
- [ ] Implement hub-first routing logic
- [ ] Implement direct-page fallback logic

## **Phase B.2 - Hub Behavior**
- [ ] Implement small hub prompt (announce options)
- [ ] Implement large hub prompt (generic "choose your page")
- [ ] Add blur toggle logic (blur ON for hub entry, OFF for large hubs)
- [ ] Integrate with responseCallback for compatibility

## **Testing**
- [ ] Test all 7 hubs open correctly
- [ ] Test sub-option navigation works
- [ ] Test direct pages bypass hub-first routing
- [ ] Test keyword aliases match correctly
- [ ] Test blur behavior on hub entry/exit

## **Safety Checks**
- [ ] No conflicts with existing Copilot commands
- [ ] No breaking of locked features
- [ ] Spotlight feature flag compatibility
- [ ] No 404 errors on navigation

---

# ✅ **READY FOR ARCHITECT FINAL APPROVAL**

This spec is verified against Router.tsx and contains ONLY routes that actually exist in the codebase.

**Next Step:** Architect reviews this corrected spec and approves for implementation.
