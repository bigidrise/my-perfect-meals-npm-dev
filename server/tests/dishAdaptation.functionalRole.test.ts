/**
 * Deterministic tests for the DAL functional-role reasoning (no LLM calls):
 *  - role-tagged rules win over generic rules for the same component
 *  - the adaptation block names the functional requirement
 *  - structural role requirements never recommend an ingredient blocked by
 *    another active guardrail (vegetarian lard, vegan + gluten-free flour)
 */
import {
  resolveConflicts,
  renderAdaptationBlock,
  buildGuardrailContext,
} from "../services/dishAdaptation/dishAdaptationLayer";

describe("DAL functional-role reasoning", () => {
  it("vegan cheesecake: role-tagged cream-cheese rule wins over generic dairy rule and names the setter requirement", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["cream cheese", "sugar", "eggs", "graham cracker crust"],
      adaptableComponents: ["sweetener type", "toppings"],
    };
    const conflicts = resolveConflicts("classic cheesecake", decomposition, ctx);

    const creamCheese = conflicts.filter(c => c.component === "cream cheese");
    expect(creamCheese).toHaveLength(1); // generic dairy rule suppressed
    expect(creamCheese[0].functionalRole).toBe("binder/setter");
    expect(creamCheese[0].directive).toMatch(/set firm enough to slice/i);
    expect(creamCheese[0].directive).toMatch(/agar|arrowroot/i);

    const block = renderAdaptationBlock("classic cheesecake", decomposition, conflicts, ctx, "first_pass");
    expect(block).toContain("STRUCTURAL INTEGRITY");
    expect(block).toMatch(/set firm enough to slice/i);
    expect(block).toMatch(/never use an ingredient blocked by another rule/i);
  });

  it("vegetarian lard crust: fat substitution carries fat/flakiness role, not setter — no agar directive", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegetarian"] });
    const decomposition = {
      definingComponents: ["lard pastry crust", "fruit filling"],
      adaptableComponents: ["sweetener"],
    };
    const conflicts = resolveConflicts("apple pie", decomposition, ctx);

    const lard = conflicts.filter(c => c.component === "lard pastry crust" && /lard/.test(c.guardrail));
    expect(lard.length).toBeGreaterThan(0);
    for (const c of lard) {
      // Lard is a fat-in-pastry ingredient, not a setter; it gets fat/flakiness role.
      expect(c.functionalRole).toBe("fat/flakiness");
      // Fat/flakiness substitution must never recommend a setting agent (agar/gelatin).
      expect(c.directive).not.toMatch(/agar|gelatin/i);
      // Must recommend a solid fat that can replicate flakiness.
      expect(c.directive).toMatch(/plant-based shortening|coconut oil/i);
    }
  });

  it("vegetarian gelatin dessert: gelatin rule alone carries the setter role", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegetarian"] });
    const decomposition = {
      definingComponents: ["gelatin base", "fruit"],
      adaptableComponents: ["sweetener"],
    };
    const conflicts = resolveConflicts("fruit gelatin dessert", decomposition, ctx);
    const gel = conflicts.find(c => c.component === "gelatin base");
    expect(gel).toBeDefined();
    expect(gel!.functionalRole).toBe("setter");
    expect(gel!.directive).toMatch(/agar/i);
  });

  it("vegan cake: 'eggs' component triggers leavening rule (not just binding) and mentions lift/aquafaba/baking soda", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["eggs", "flour", "butter", "sugar"],
      adaptableComponents: ["frosting", "mix-ins"],
    };
    const conflicts = resolveConflicts("vanilla layer cake", decomposition, ctx);

    const eggConflicts = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    // The leavening rule must win over the generic egg rule (role-aware selection)
    expect(eggConflicts).toHaveLength(1);
    expect(eggConflicts[0].functionalRole).toBe("leavening");
    // Directive must mention lift/aeration — not just "flax eggs or silken tofu"
    expect(eggConflicts[0].directive).toMatch(/aquafaba|baking soda|lift|leavening/i);
    // Must not be the plain generic binding-only recommendation
    expect(eggConflicts[0].directive).not.toMatch(/^Use flax eggs or silken tofu\.? The dish/);

    const block = renderAdaptationBlock("vanilla layer cake", decomposition, conflicts, ctx, "first_pass");
    expect(block).toContain("STRUCTURAL INTEGRITY");
    expect(block).toMatch(/aquafaba|baking soda/i);
  });

  it("vegan muffin: 'large eggs' component triggers leavening rule via substring match", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["large eggs", "flour", "vegetable oil", "blueberries"],
      adaptableComponents: ["sugar", "toppings"],
    };
    const conflicts = resolveConflicts("blueberry muffins", decomposition, ctx);

    const eggConflicts = conflicts.filter(c => c.component === "large eggs" && /vegan/i.test(c.guardrail));
    expect(eggConflicts).toHaveLength(1);
    expect(eggConflicts[0].functionalRole).toBe("leavening");
    expect(eggConflicts[0].directive).toMatch(/aquafaba|baking soda|lift/i);
  });

  it("vegan cheesecake: cream-cheese binder/setter fires; 'eggs' falls back to generic rule (not leavening — cheesecake is not a baked-good context)", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["cream cheese", "sugar", "eggs", "graham cracker crust"],
      adaptableComponents: ["toppings"],
    };
    const conflicts = resolveConflicts("classic cheesecake", decomposition, ctx);

    // cream cheese component: binder/setter rule must still fire
    const creamCheese = conflicts.filter(c => c.component === "cream cheese");
    expect(creamCheese).toHaveLength(1);
    expect(creamCheese[0].functionalRole).toBe("binder/setter");
    expect(creamCheese[0].directive).toMatch(/set firm enough to slice/i);

    // eggs component: dishContextPattern blocks the leavening rule for "cheesecake"
    // (\bcake\b has no word boundary before "cake" inside "cheesecake"), so only
    // the generic egg rule fires — flax eggs / silken tofu, no leavening role.
    const eggs = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    expect(eggs).toHaveLength(1);
    expect(eggs[0].functionalRole).toBeUndefined(); // generic rule, no structural role
    expect(eggs[0].directive).toMatch(/flax eggs|silken tofu/i);
  });

  it("vegan omelet: 'eggs' component does NOT trigger leavening rule — dish is not a baked good", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["eggs", "vegetables", "olive oil"],
      adaptableComponents: ["fillings", "seasoning"],
    };
    const conflicts = resolveConflicts("vegetable omelet", decomposition, ctx);

    const eggs = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    expect(eggs).toHaveLength(1);
    // Must use generic egg rule, not leavening
    expect(eggs[0].functionalRole).toBeUndefined();
    expect(eggs[0].directive).not.toMatch(/aquafaba|baking soda/i);
    expect(eggs[0].directive).toMatch(/flax eggs|silken tofu/i);
  });

  it("vegan quiche: 'eggs' component does NOT trigger leavening rule — dish is not a baked good", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["eggs", "pastry crust", "cream", "vegetables"],
      adaptableComponents: ["fillings"],
    };
    const conflicts = resolveConflicts("spinach quiche", decomposition, ctx);

    const eggs = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    expect(eggs).toHaveLength(1);
    expect(eggs[0].functionalRole).toBeUndefined();
    expect(eggs[0].directive).not.toMatch(/aquafaba|baking soda/i);
  });

  it("vegan eggplant dish: 'eggplant' component does NOT trigger leavening rule", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["eggplant", "tomato sauce", "herbs"],
      adaptableComponents: ["oil", "seasoning"],
    };
    const conflicts = resolveConflicts("eggplant parmesan", decomposition, ctx);

    // No egg-related conflict should arise from the "eggplant" component
    const eggConflicts = conflicts.filter(c => c.component === "eggplant" && /egg/i.test(c.guardrail));
    expect(eggConflicts).toHaveLength(0);
  });

  it("vegan frittata: 'eggs' component does NOT trigger leavening rule — frittata is not a baked good", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["eggs", "vegetables", "olive oil", "herbs"],
      adaptableComponents: ["fillings", "seasoning"],
    };
    const conflicts = resolveConflicts("mushroom frittata", decomposition, ctx);

    const eggs = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    expect(eggs).toHaveLength(1);
    expect(eggs[0].functionalRole).toBeUndefined(); // generic rule, no leavening role
    expect(eggs[0].directive).not.toMatch(/aquafaba|baking soda/i);
    expect(eggs[0].directive).toMatch(/flax eggs|silken tofu/i);
  });

  it("vegan battered fish: 'eggs' in a savory battered dish does NOT trigger leavening rule", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["fish fillet", "eggs", "beer batter", "oil"],
      adaptableComponents: ["seasoning", "dipping sauce"],
    };
    const conflicts = resolveConflicts("beer battered fish", decomposition, ctx);

    const eggs = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    expect(eggs).toHaveLength(1);
    expect(eggs[0].functionalRole).toBeUndefined();
    expect(eggs[0].directive).not.toMatch(/aquafaba|baking soda/i);
  });

  it("vegan meatloaf: 'eggs' binder component does NOT trigger leavening rule", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan"] });
    const decomposition = {
      definingComponents: ["ground beef", "eggs", "breadcrumbs", "ketchup glaze"],
      adaptableComponents: ["seasoning", "vegetables"],
    };
    const conflicts = resolveConflicts("classic meatloaf", decomposition, ctx);

    const eggs = conflicts.filter(c => c.component === "eggs" && /vegan/i.test(c.guardrail));
    expect(eggs).toHaveLength(1);
    expect(eggs[0].functionalRole).toBeUndefined();
    expect(eggs[0].directive).not.toMatch(/aquafaba|baking soda/i);
  });

  it("vegetarian pastry crust without lard: no false 'no lard' directive is emitted", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegetarian"] });
    const decomposition = {
      definingComponents: ["pastry crust", "fruit filling"],
      adaptableComponents: ["sweetener", "seasoning"],
    };
    const conflicts = resolveConflicts("apple tart", decomposition, ctx);

    // "pastry crust" contains no lard/tallow/suet — lard rule must NOT fire
    const lardConflicts = conflicts.filter(
      c => c.component === "pastry crust" && /lard/i.test(c.guardrail),
    );
    expect(lardConflicts).toHaveLength(0);
  });

  it("vegan + gluten-free flour crust: structure requirement never unconditionally recommends egg", () => {
    const ctx = buildGuardrailContext({ dietaryIdentity: ["vegan", "gluten-free"] });
    const decomposition = {
      definingComponents: ["flour crust", "filling"],
      adaptableComponents: ["toppings"],
    };
    const conflicts = resolveConflicts("tart", decomposition, ctx);
    const flour = conflicts.filter(c => c.component === "flour crust" && c.functionalRole === "structure");
    expect(flour.length).toBeGreaterThan(0);
    for (const c of flour) {
      // Plant-safe binders listed; egg only conditioned on being permitted.
      expect(c.roleRequirement).toMatch(/flax|psyllium|xanthan/i);
      if (/egg/i.test(c.roleRequirement ?? "")) {
        expect(c.roleRequirement).toMatch(/egg only where eggs are permitted/i);
      }
    }
    const block = renderAdaptationBlock("tart", decomposition, conflicts, ctx, "fallback");
    expect(block).toMatch(/never use an ingredient blocked by another rule/i);
  });
});
