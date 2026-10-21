import { chefPairingIngredientNotice } from "../chefPairingSafetyMessage";

const explanation =
  "Verified pairing ingredients are unavailable for your active food-safety restrictions. Please check a complete label or ask the venue.";
const response = (body: unknown) => ({
  name: "ApiError", status: 503, body: JSON.stringify(body),
  message: `API 503 Service Unavailable → ${JSON.stringify(body)}`,
});

describe("Chef Pairings ingredient-verification message", () => {
  it("uses the specific backend explanation and gives no retry or override advice", () => {
    const notice = chefPairingIngredientNotice(response({
      code: "PAIRING_INGREDIENTS_UNVERIFIED", error: explanation,
    }), true);
    expect(notice).toEqual({
      title: "Ingredient verification required", description: explanation, variant: "warning",
    });
    expect(JSON.stringify(notice)).not.toMatch(/try again|retry|override|disable/i);
  });

  it.each([undefined, null, "", "  ", false, 123])(
    "retains a useful explanation when backend text is missing or invalid: %j", error => {
      expect(chefPairingIngredientNotice(response({
        code: "PAIRING_INGREDIENTS_UNVERIFIED", error,
      }), true)?.description).toBe(explanation);
    },
  );

  it("leaves Production behavior unchanged", () => {
    expect(chefPairingIngredientNotice(response({
      code: "PAIRING_INGREDIENTS_UNVERIFIED", error: explanation,
    }), false)).toBeNull();
  });

  it.each([
    null, undefined, "PAIRING_INGREDIENTS_UNVERIFIED", new Error(explanation),
    { body: "not JSON" }, { body: "null" }, { body: "[]" },
    response({ code: "PROTOCOL_CONTEXT_UNRESOLVED", error: "Please try again." }),
    response({ error: explanation }), response({ code: "PAIRING_INGREDIENTS_UNVERIFIED_EXTRA" }),
  ])("does not reclassify unrelated, malformed, or substring-only errors: %j", error => {
    expect(chefPairingIngredientNotice(error, true)).toBeNull();
  });
});
