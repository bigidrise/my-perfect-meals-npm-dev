/**
 * Task #1209 — Triple-constraint cheesecake regression test.
 *
 * Scenario: user requests "strawberry cheesecake" while simultaneously subject to
 *   • vegan guardrail  (covers dairy AND egg — removes cream cheese AND eggs)
 *   • diabetic guardrail (removes sugar and white flour)
 *
 * Every structurally critical ingredient is under restriction. The DAL must:
 *   1. Resolve cream cheese → cashew-cream base with agar setter (binder/setter role)
 *   2. Resolve eggs → flax egg + baking soda/vinegar note (or silken tofu for set desserts)
 *   3. Resolve sugar → sugar-free sweetener (sweetener role)
 *   4. Resolve graham cracker crust → almond flour base (structure role)
 *   5. Never recommend egg as a setter when eggs are also restricted (cross-contamination guard)
 *   6. Identity validator passes a compliant sliceable cheesecake
 *   7. Identity validator flags mousse / pudding / parfait as catastrophicDeviation
 */

import {
  resolveConflicts,
  renderAdaptationBlock,
  buildGuardrailContext,
} from "../services/dishAdaptation/dishAdaptationLayer";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";

// ── Synthetic decomposition — what gpt-4o-mini would return for strawberry cheesecake ──

const decomposition = {
  definingComponents: [
    "cream cheese filling",
    "graham cracker crust",
    "strawberry topping",
  ],
  adaptableComponents: [
    "eggs",
    "sugar",
    "vanilla extract",
    "lemon zest",
  ],
  dishForm: "sliceable baked cake with crust",
};

const tripleCtx = buildGuardrailContext({
  dietaryIdentity: ["vegan", "diabetic"],
});

// ── Conflict resolution ───────────────────────────────────────────────────────

describe("triple-constraint cheesecake — conflict resolution", () => {
  const conflicts = resolveConflicts("strawberry cheesecake", decomposition, tripleCtx);

  it("resolves cream cheese filling with binder/setter functional role", () => {
    const cc = conflicts.filter(c =>
      c.component === "cream cheese filling" && c.functionalRole === "binder/setter",
    );
    expect(cc.length).toBeGreaterThan(0);
    // Setter directive must recommend agar or arrowroot — NOT egg
    expect(cc[0].directive).toMatch(/agar|arrowroot/i);
    expect(cc[0].directive).not.toMatch(/\begg\b/i);
  });

  it("resolves eggs with a substitute directive", () => {
    const eggs = conflicts.filter(c => c.component === "eggs");
    expect(eggs.length).toBeGreaterThan(0);
    // Flax egg mentioned for binding
    expect(eggs[0].directive).toMatch(/flax/i);
  });

  it("resolves sugar with a sweetener directive", () => {
    const sugar = conflicts.filter(c =>
      c.component === "sugar" && /sweetener|diabetic/i.test(c.guardrail),
    );
    expect(sugar.length).toBeGreaterThan(0);
    expect(sugar[0].directive).toMatch(/sugar.free|sweetener|monk fruit|erythritol/i);
  });

  it("resolves graham cracker crust with a structure substitute", () => {
    const crust = conflicts.filter(c =>
      c.component === "graham cracker crust" && c.functionalRole === "structure",
    );
    expect(crust.length).toBeGreaterThan(0);
    expect(crust[0].directive).toMatch(/almond flour/i);
  });

  it("structural-integrity block never recommends egg as a setter when eggs are restricted", () => {
    const block = renderAdaptationBlock(
      "strawberry cheesecake",
      decomposition,
      conflicts,
      tripleCtx,
      "first_pass",
    );
    // The STRUCTURAL INTEGRITY section must include the cross-contamination guard.
    expect(block).toContain("STRUCTURAL INTEGRITY");
    expect(block).toMatch(/never use an ingredient blocked by another rule/i);
  });

  it("adaptation block explicitly names the setter requirement for the filling", () => {
    const block = renderAdaptationBlock(
      "strawberry cheesecake",
      decomposition,
      conflicts,
      tripleCtx,
      "first_pass",
    );
    expect(block).toMatch(/set firm enough to slice|setter|agar|arrowroot/i);
  });
});

// ── Identity validation — passing cases ──────────────────────────────────────

const tripleDirective: DishAdaptationDirective = {
  identityAnchor: "This IS strawberry cheesecake. Do not change the dish.",
  definingComponents: decomposition.definingComponents,
  adaptableComponents: decomposition.adaptableComponents,
  dishForm: decomposition.dishForm,
  conflicts: resolveConflicts("strawberry cheesecake", decomposition, tripleCtx),
  adaptationBlock: "",
};

describe("triple-constraint cheesecake — identity validator passes compliant adaptations", () => {
  it("cashew cream base + almond crust + monk fruit passes", () => {
    const r = validateDishIdentity("strawberry cheesecake", {
      name: "Triple-Free Strawberry Cheesecake",
      description:
        "A sliceable cheesecake with a golden almond flour crust, a firm cashew cream cheese filling set with agar-agar and sweetened with monk fruit, topped with fresh strawberries.",
      ingredients: [
        { name: "cashew cream cheese" },
        { name: "almond flour crust" },
        { name: "fresh strawberry topping" },
        { name: "monk fruit sweetener" },
        { name: "agar-agar" },
        { name: "flax eggs" },
      ],
    }, tripleDirective);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.formMismatch).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("silken tofu base + oat crust + erythritol passes", () => {
    const r = validateDishIdentity("strawberry cheesecake", {
      name: "Vegan Diabetic-Friendly Strawberry Cheesecake",
      description:
        "Set cheesecake with a silken tofu and coconut cream filling on an oat-almond crust, sweetened with erythritol. Sliceable after chilling.",
      ingredients: [
        { name: "silken tofu base" },
        { name: "coconut cream" },
        { name: "oat-almond crust" },
        { name: "strawberry topping" },
        { name: "erythritol" },
      ],
    }, tripleDirective);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });
});

// ── Identity validation — form-collapse escape paths must be rejected ─────────

describe("triple-constraint cheesecake — form collapse must be caught", () => {
  const ESCAPE_CASES = [
    {
      label: "mousse",
      name: "Vegan Strawberry Cheesecake Mousse",
      description: "A light mousse made from blended cashews and strawberry puree. No crust.",
      ingredients: [{ name: "cashews" }, { name: "strawberry puree" }, { name: "coconut cream" }],
    },
    {
      label: "parfait",
      name: "Strawberry Cheesecake Parfait",
      description: "Layered parfait of cashew cream and strawberry compote in a glass.",
      ingredients: [{ name: "cashew cream" }, { name: "strawberry compote" }, { name: "granola" }],
    },
    {
      label: "pudding",
      name: "Strawberry Cheesecake Pudding",
      description: "A chilled chia pudding with cheesecake flavor notes.",
      ingredients: [{ name: "chia seeds" }, { name: "coconut milk" }, { name: "strawberry extract" }],
    },
    {
      label: "smoothie",
      name: "Strawberry Cheesecake Smoothie",
      description: "A blended drink with strawberry and cream cheese flavor.",
      ingredients: [{ name: "frozen strawberries" }, { name: "cashew milk" }, { name: "vanilla" }],
    },
  ];

  test.each(ESCAPE_CASES)(
    "$label escape: must be catastrophicDeviation even under triple constraint",
    ({ name, description, ingredients }) => {
      const r = validateDishIdentity("strawberry cheesecake", { name, description, ingredients }, tripleDirective);
      expect(r.catastrophicDeviation).toBe(true);
      expect(r.passed).toBe(false);
    },
  );
});
