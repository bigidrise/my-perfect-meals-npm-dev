import { mutableProfileStyles, withOneTouchDiet } from "../services/oneTouch/dietAuthority";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

describe("One-Touch request-scoped dietary authority", () => {
  it("replaces only a mutable style while retaining saved religious and medical rules", () => {
    const profile = {
      dietaryIdentity: ["omnivore", "kosher", "gluten-free"],
      allergies: ["shellfish"],
      medicalHardLimits: ["diabetes"],
      avoidances: ["mushroom"],
      procedural: {},
    } as unknown as UserProtocolEnvelope;
    const effective = withOneTouchDiet(profile, "vegan");
    expect(effective.dietaryIdentity).toEqual(["vegan", "kosher", "gluten-free"]);
    expect(effective.allergies).toEqual(["shellfish"]);
    expect(effective.medicalHardLimits).toEqual(["diabetes"]);
    expect(effective.avoidances).toEqual(["mushroom"]);
    expect(profile.dietaryIdentity).toEqual(["omnivore", "kosher", "gluten-free"]);
    expect(mutableProfileStyles(profile)).toEqual(["omnivore"]);
  });

  it("does not treat religious or unfamiliar restrictions as mutable", () => {
    const profile = { dietaryIdentity: ["vegan", "halal", "renal"] } as UserProtocolEnvelope;
    expect(mutableProfileStyles(profile)).toEqual(["vegan"]);
    expect(withOneTouchDiet(profile, "paleo").dietaryIdentity).toEqual(["paleo", "halal", "renal"]);
  });
});