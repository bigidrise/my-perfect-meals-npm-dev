// Comparison-only correction. Never imported by the application.
const serving = {
  "chia-parfait": "One finished layered parfait in one glass; hydrated chia beneath berries and coconut flakes.",
  "oat-brownies": "One cooled brownie square on a plate, cut from the six-square batch; no whole pan or cookies.",
  "berry-smoothie": "One smooth blended drink in a glass; spinach is blended in, not displayed as salad leaves.",
  "chicken-quinoa": "One of two plated servings: roasted chicken and broccoli with cooked quinoa; not raw dry grain.",
  "lentil-soup": "One of two bowls of thick, partially blended orange-red soup; lentils and carrots are softened.",
  "salmon-bowl": "One of two rice bowls with cooked flaked salmon, cucumber, avocado, nori and soy sauce; not raw fish.",
  "egg-free-cobb": "One of two fresh, crisp salad servings in a shallow bowl; chicken is already cooked, vegetables stay fresh. Not a hot or wilted salad.",
  "banana-pancakes": "One of two servings of small, soft, cooked pancakes on a plate; egg and banana are incorporated into the batter, not separate side dishes.",
};
export const BASELINE_DIGEST = "a2475c5745db875cbc008459ad96e5f7f82fa2b59943ebf0b5c35c1e151bb277";
export function correctComparisonPrompts(recipe, basePrompt, baseVerificationPrompt) {
  const start = basePrompt.indexOf("━━ CONTRACT 3: PRESENTATION ━━");
  const end = basePrompt.indexOf("Style:", start);
  if (start < 0 || end < 0 || !serving[recipe.id]) throw new Error("Unreviewed prompt structure/fixture");
  const presentation = `━━ CONTRACT 3: FINALIZED RECIPE PRESENTATION ━━
Preparation method (follow the resulting cooked/blended/chilled form): ${recipe.method}
Recipe yield: ${recipe.servings} serving(s). Ingredient quantities above are for the whole recipe.
Serving presentation: ${serving[recipe.id]}
Visible requirements and exclusions: ${recipe.visibleRequirement}
Ingredients such as water, oil, flour and egg may be absorbed, blended, dressed or cooked into the finished food; do not show them as separate raw ingredients.
Show only the finished serving. No additional food, garnish, humans, hands, text or logos.

`;
  const prompt = (basePrompt.slice(0, start) + presentation + basePrompt.slice(end))
    .replace("REQUIRED VISIBLE INGREDIENTS:", "AUTHORIZED RECIPE INGREDIENTS (whole-recipe quantities):");
  const verificationPrompt = `${baseVerificationPrompt}

ADDITIONAL FINALIZED RECIPE CHECK:
Expected finished serving: ${serving[recipe.id]}
Preparation: ${recipe.method}
Visible requirements/exclusions: ${recipe.visibleRequirement}
Judge observable food identity, visible ingredients and presentation only. Do not infer exact grams, serving nutrition, internal cooking temperature or clinical safety from pixels. Incorporated ingredients need not appear separately.
Answer exactly PASS or FAIL: followed by the observable violation.`;
  return {
    prompt, verificationPrompt,
    changes: [
      "Preserved existing display name, dish identity, ingredient list/quantities, unauthorized-ingredient rule, photographic style and no-human requirement.",
      "Relabeled required-visible ingredients as authorized recipe ingredients so incorporated water/oil/flour/egg need not be shown separately.",
      "Replaced the generic presentation block with the unchanged finalized method, yield, one-serving presentation and explicit exclusions.",
      "Extended the existing verification prompt with observable finalized-recipe checks; no nutritional or clinical inference.",
      ...(recipe.id === "egg-free-cobb" ? ["Removed hot/warm meal and no-raw-components instructions that contradicted the fresh salad."] : []),
    ],
  };
}
