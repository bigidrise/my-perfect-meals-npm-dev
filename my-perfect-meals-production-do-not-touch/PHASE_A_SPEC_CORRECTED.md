# ✅ **PHASE A – BUTTON-LEVEL NAVIGATION & KEYWORD ROUTING**

**Updated to match actual Router.tsx routes**

---

# 🚀 **PHASE A SPEC – COPILOT BUTTON NAVIGATION + KEYWORD ALIASES**

## **GOAL OF PHASE A**

Create a **fully reliable keyword → navigation** system that routes the user to the correct button/hub/page when they SAY anything related to that feature.

No spotlight yet.
No walkthroughs yet.
No dimming yet.
This phase is ONLY:

### ✔ Keyword → Navigation
### ✔ Navigation → Hub/Page
### ✔ If Hub opens, list available sub-options
### ✔ User can verbally choose the sub-option

This gives us a stable foundation before building Spotlight in Phase B.

---

# 1️⃣ **BUTTONS + KEYWORD ALIASES (PRIMARY ROUTES)**

The system must recognize ANY of these words and route accordingly.

Architect must implement fuzzy match (contains / includes / similar).

---

## **Supplement Hub**

Aliases:
* "supplements"
* "supplement hub"
* "vitamins"
* "nutrition supplements"

Route → **/supplement-hub-landing**

---

## **Craving Creator Hub**

Aliases:
* "cravings"
* "craving creator"
* "craving hub"
* "I have a craving"
* "make a craving meal"

Route → **/craving-creator-landing**

**When opened:**
Copilot asks:
> "Do you want Craving Creator or Craving Premades?"

User says:
* "creator" → Navigate to `/craving-creator`
* "premades" → Navigate to `/craving-presets`

---

## **Fridge Rescue**

Aliases:
* "fridge rescue"
* "rescue"
* "use my fridge"
* "what can I make with ingredients"

Route → **/fridge-rescue**

---

## **Socializing Hub**

(restaurant guide + social meals)

Aliases:
* "restaurant"
* "restaurants"
* "eating out"
* "socializing"
* "social meals"
* "out to eat"
* "find meals"
* "restaurant guide"

Route → **/social-hub**

**When opened:**
Copilot can guide to:
* "find meals" → `/social-hub/find`
* "restaurant guide" → `/social-hub/restaurant-guide`

---

## **Kids Meals Hub**

Aliases:
* "kids meals"
* "children meals"
* "kids hub"
* "meals for kids"
* "healthy kids meals"

Route → **/kids-meals**

---

## **Spirits & Lifestyle Hub (Alcohol)**

Aliases:
* "alcohol"
* "drinks"
* "cocktails"
* "spirits"
* "low calorie alcohol"
* "lean cocktails"
* "smart sips"

Route → **/alcohol-hub**

---

## **My Weekly Meal Builder**

Aliases:
* "weekly board"
* "meal board"
* "weekly planner"
* "meal builder"
* "meal board builder"

Route → **/weekly-meal-board**

---

## **Diabetic Hub + Meal Builder**

Aliases:
* "diabetic"
* "diabetes"
* "sugar control"
* "diabetic meals"
* "blood sugar"
* "glucose"

Route → **/diabetic-hub**

**When opened:**
Copilot can guide to:
* "diabetes support" → `/diabetes-support`
* "diabetic menu builder" → `/diabetic-menu-builder`

---

## **GLP-1 Hub + Meal Builder**

Aliases:
* "GLP"
* "glp one"
* "glp-1"
* "ozempic"
* "wegovy"
* "semaglutide"
* "injection"

Route → **/glp1-hub**

**When opened:**
Copilot can guide to:
* "GLP-1 meal builder" → `/glp1-meal-builder`

---

## **Anti-Inflammatory Meal Builder**

Aliases:
* "anti-inflammatory"
* "inflammation"
* "healing meals"
* "anti inflammatory builder"
* "anti"

Route → **/anti-inflammatory-menu-builder**

---

## **Beach Body Meal Builder**

Aliases:
* "beach body"
* "hard body"
* "summer shred"
* "lean out"
* "competition"
* "shred"

Route → **/beach-body-meal-board**

---

## **Master Shopping List**

Aliases:
* "shopping list"
* "groceries"
* "master list"
* "shopping planner"
* "grocery"
* "shopping"

Route → **/shopping-list-v2**

---

## **Macro Calculator**

Aliases:
* "macros"
* "macro calculator"
* "protein calculator"
* "calorie calculator"
* "macro counter"
* "calculator"
* "calculate"

Route → **/macro-counter**

---

## **My Diet Biometrics**

Aliases:
* "biometrics"
* "diet numbers"
* "profile numbers"
* "my macros profile"
* "tracking"
* "weight"

Route → **/biometrics**

---

## **Get Inspiration**

Aliases:
* "inspiration"
* "ideas"
* "meal ideas"
* "meal inspiration"

Route → **/get-inspiration**

---

# 2️⃣ **PAGES (SECONDARY ROUTES)**

### **Lifestyle Page**

Aliases:
* "lifestyle"
* "main lifestyle page"
* "nutrition lifestyle page"

Route → **/lifestyle**

---

### **Pro Care Page**

Aliases:
* "pro care"
* "professional care"
* "doctor care"

Route → **/procare-cover**

---

### **Planner Page**

Aliases:
* "planner"
* "meal planner"
* "planning board"

Route → **/planner**

---

# 3️⃣ **IN-HUB OPTION LISTING (REQUIRED LOGIC)**

When a hub contains sub-features:
Example → Craving Hub, Diabetic Hub, GLP-1 Hub, Social Hub, etc.

Copilot MUST:

1. Detect hub loaded
2. Speak or show:
   > "Which option would you like? ___, ___, or ___?"

3. Accept ANY keyword from that list
4. Navigate into correct sub-feature

This must be dynamic (reads from registry), not hardcoded.

---

# 4️⃣ **REMOVED FROM ORIGINAL SPEC** (Not in Router.tsx)

The following features were in the original spec but do NOT exist in the current Router:

- ❌ **Trainer Portal** - No route exists
- ❌ **Physician Portal** - Individual physician pages exist (Diabetic Hub, GLP-1 Hub) but no central portal
- ❌ **Log From Photos** - No route exists

These can be added later when the pages are built.

---

# 5️⃣ **REQUIRED ARCHITECTURE FOR PHASE A**

Architect must implement:

### ✔ Keyword → FeatureID lookup
### ✔ Alias map with fuzzy match
### ✔ FeatureID → Route lookup
### ✔ Auto-navigation
### ✔ Optional follow-up menu when hub contains subbuttons
### ✔ EXACT same behavior for voice AND text queries
### ✔ Feature flag support (phase B will use same system)

---

# ✔ DONE — Corrected Phase A Spec

This spec now matches your actual Router.tsx routes and will enable reliable keyword-based navigation.

Next steps:
1. Implement KeywordFeatureMap with these aliases
2. Test navigation for each feature
3. Move to Phase B (Spotlight walkthroughs)
