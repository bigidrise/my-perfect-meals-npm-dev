---
name: Universal Meal Card Architecture
description: The long-term card architecture for My Perfect Meals — one component, multiple modes, not one card per feature.
---

# Universal Meal Card — Architecture North Star

## The Rule
There is ONE meal card component in the app. Every recipe-generating feature is a "brain" that feeds data into it. The card decides which modules to render based on `mode`.

**Why:** Parents already know where the image is, where ingredients are, where directions are, where Favorite/Translate/Walk Through the Kitchen are. A different card per feature forces them to learn a new interface every time.

## Mode → Module Matrix

| Module | adult | pediatric | (future: athlete) | (future: glp1) |
|---|---|---|---|---|
| DALL·E image + shimmer | ✅ | ✅ | ✅ | ✅ |
| Expandable ingredients | ✅ | ✅ | ✅ | ✅ |
| Expandable directions | ✅ | ✅ | ✅ | ✅ |
| Walk Through the Kitchen | ✅ | ✅ | ✅ | ✅ |
| Favorite / Delete / Translate | ✅ | ✅ | ✅ | ✅ |
| Share | ✅ | ✅ | ✅ | ✅ |
| Shopping List | ✅ | ✅ | ✅ | ✅ |
| Info tiles | Calories/Protein/Carbs/Fat | Age Group/Texture/Confidence/Clinical Review | TBD | TBD |
| Diet/medical badges | ✅ | ✅ (pediatric: Iron Rich, Calcium, etc.) | ✅ | ✅ |
| Log to Macros | ✅ | ❌ | ✅ | ✅ |
| Add to Meal Plan | ✅ | ❌ | ✅ | ✅ |
| Nutrition Benefits section | ❌ | ✅ | ❌ | ❌ |
| Why This Meal section | ❌ | ✅ | ❌ | ❌ |
| Safety Notes section | ❌ | ✅ | ❌ | ❌ |
| Clinical Review section | ❌ | ✅ | ❌ | ❌ |
| Conflict Resolution section | ❌ | ✅ | ❌ | ❌ |

## How to apply
- When adding a new recipe-generating feature, do NOT build a new card component. Add a new `mode` value and teach the universal card which modules to show.
- The card's rendering logic branches on `mode`; the interaction logic (Favorite, image pipeline, Walk Through the Kitchen) never branches.
- Pediatric mode specifically: info tiles replace macros (not supplement them). Macros available in a collapsed "Clinical Details" section for physicians.

## Current state (as of this writing)
- Adult card: lives in `CreateDishPage.tsx` (inline, not yet extracted as a shared component)
- Pediatric card: lives in `MyPerfectBeginningCreateMealPage.tsx` (custom RecipeCard, to be replaced)
- Tasks #440–442 are implementing the pediatric mode; once merged, extraction into a true shared UniversalMealCard is the natural next step

## Reviewer quote
> "The parent shouldn't feel like they entered a different application. They should immediately recognize the same meal card experience they've already learned elsewhere in My Perfect Meals, with the pediatric engine simply filling it with pediatric-specific information instead of adult nutrition data."
