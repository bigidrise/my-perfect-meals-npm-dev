# System 08: Smart Ingredient Normalization & Aggregation Engine (SINAE)

**Classification:** Data Processing — Shopping Intelligence
**Status:** Active, Production

---

## Purpose

When a user plans a week of meals, they generate content across multiple AI calls, multiple meal types, and multiple days — each with ingredients expressed in different formats, units, and quantities. SINAE transforms this fragmented output into a clean, shoppable, deduplicated grocery list.

This is harder than it sounds. AI models express quantities inconsistently:

- "a pinch of salt"
- "1/4 tsp kosher salt"
- "2 teaspoons of sea salt"
- "salt and pepper to taste"

SINAE resolves all of these to a single entry (or omits them as pantry staples) while correctly aggregating quantities across 21 meals.

---

## Processing Pipeline

### Stage 1: Ingredient Extraction
Raw ingredient strings are extracted from each generated meal object and parsed into structured components: name, quantity, unit, preparation note.

### Stage 2: Name Normalization
Ingredient names are mapped to canonical forms via the ingredient catalog:
- "chicken breast" + "boneless skinless chicken breasts" + "chicken breast fillets" → `chicken_breast`
- "Roma tomatoes" + "plum tomatoes" + "tomatoes (roma)" → `tomato_roma`

### Stage 3: Unit Conversion
All quantities are converted to a standardized U.S. Imperial base unit:
- Weight → ounces
- Volume → fluid ounces / tablespoons
- Count items → count

The unit converter handles fractions, mixed numbers, and informal expressions ("a handful," "a knob of butter").

### Stage 4: Aggregation & Deduplication
Normalized, unit-converted ingredients are aggregated across all meals. The same item appearing in 5 different meals is summed to a single shopping quantity.

### Stage 5: Pantry Classification
The system compares the ingredient list against a pantry staples registry. Items classified as pantry staples (olive oil, salt, black pepper, garlic powder, common spices) are moved to a separate "Pantry" checklist to reduce shopping list noise.

### Stage 6: Category Organization
Remaining grocery items are organized by store section:
- Proteins (meat, poultry, seafood, eggs)
- Produce (vegetables, fruits)
- Dairy & Eggs
- Grains & Starches
- Pantry & Dry Goods
- Frozen
- Condiments & Sauces

---

## Architecture

```
Weekly Meal Board (UnifiedMeal[])
    │
    ▼
SINAE Processing Pipeline
    ├── Stage 1: Ingredient Extraction
    ├── Stage 2: Canonical Name Normalization (ingredient catalog)
    ├── Stage 3: Unit Conversion (unit-converter.ts)
    ├── Stage 4: Aggregation & Deduplication
    ├── Stage 5: Pantry Classification (pantry staples registry)
    └── Stage 6: Category Organization
         │
         ▼
    ShoppingList Output
    ├── groceries: [{category, item, quantity, unit}]
    └── pantry: [{item, note}]
```

---

## Key Files

| File | Role |
|---|---|
| `server/services/shopping-list/list-builder.ts` | Core aggregation engine |
| `shared/ingredientNormalizer.ts` | Name canonicalization |
| `server/services/shopping-list/pantry.ts` | Pantry staples registry |
| `shared/pantryStaples.ts` | Staple definitions |
| `client/src/pages/ShoppingListMasterView.tsx` | Shopping list UI |

---

## What Makes This Unique

1. **Cross-meal aggregation** — most apps generate per-meal ingredient lists. SINAE aggregates across an entire week's board into a single optimized shopping run.
2. **Informal quantity parsing** — handles natural-language quantities that AI models produce ("a knob of butter," "handful of spinach") rather than requiring structured ingredient formats
3. **Pantry awareness** — the distinction between pantry staples and grocery items is maintained automatically, removing friction from the shopping experience
4. **Unit normalization** — multi-system unit conversion (metric, imperial, informal) is a non-trivial problem that SINAE solves with a canonical conversion layer

---

## Integration

- **Reads from**: Weekly Meal Board data, Unified Meal objects
- **Reads from**: Ingredient catalog, pantry staples registry
- **Outputs to**: Shopping List UI (`ShoppingListMasterView.tsx`)
- **Used by**: Users planning weekly meals
