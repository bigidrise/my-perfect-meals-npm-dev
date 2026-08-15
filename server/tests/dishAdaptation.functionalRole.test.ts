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
