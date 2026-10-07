import {
  CANONICAL_PRACTITIONER_ROLES,
  CLINICAL_PRACTITIONER_ROLES,
  careTeamRoleDisplayKey,
  isCanonicalPractitionerRole,
  isClinicalPractitionerRole,
  practitionerRelationshipType,
  requiresProfessionalRoleReview,
  resolveCareTeamRequestedRole,
} from "@shared/professionalRoles";
import { evaluateConsumerProCareAccess } from "@shared/procareConsumerAccess";

describe("canonical professional identity versus request/display aliases", () => {
  test("the authoritative practitioner vocabulary contains exactly the four supported roles", () => {
    expect(CANONICAL_PRACTITIONER_ROLES).toEqual(["trainer", "physician", "dietitian", "nurse_practitioner"]);
    expect(CLINICAL_PRACTITIONER_ROLES).toEqual(["physician", "dietitian", "nurse_practitioner"]);
  });

  test.each(CANONICAL_PRACTITIONER_ROLES)("%s remains exact and canonical", role => {
    expect(isCanonicalPractitionerRole(role)).toBe(true);
    expect(resolveCareTeamRequestedRole(role)).toBe(role);
    expect(requiresProfessionalRoleReview(role)).toBe(false);
    expect(practitionerRelationshipType(role)).toBe(role === "trainer" ? "coaching" : "clinical");
  });

  test.each([
    ["doctor", "physician"],
    ["np", "nurse_practitioner"],
  ])("%s maps to %s only at the Care Team boundary, never for account authorization", (alias, canonical) => {
    expect(resolveCareTeamRequestedRole(alias)).toBe(canonical);
    expect(isCanonicalPractitionerRole(alias)).toBe(false);
    expect(isClinicalPractitionerRole(alias)).toBe(false);
    expect(practitionerRelationshipType(alias)).toBe("unsupported");
    expect(requiresProfessionalRoleReview(alias)).toBe(true);
    expect(evaluateConsumerProCareAccess({
      providerRole: alias, planLookupKey: "mpm_ultimate_monthly", accessTier: "PAID_FULL",
    })).toMatchObject({ allowed: false, code: "UNSUPPORTED_PROVIDER_ROLE" });
  });

  test.each(["rn", "pa", "medical", "coach", "nutritionist", "business", "PHYSICIAN", " physician ", "unknown"])(
    "%s cannot silently become a practitioner through a similar label, ownership, or a paid/internal entitlement",
    value => {
      expect(isCanonicalPractitionerRole(value)).toBe(false);
      expect(resolveCareTeamRequestedRole(value)).toBeNull();
      expect(practitionerRelationshipType(value)).toBe("unsupported");
      expect(evaluateConsumerProCareAccess({
        providerRole: value, planLookupKey: "mpm_ultimate_monthly", accessTier: "PAID_FULL", isInternalAccount: true,
      })).toMatchObject({ allowed: false, code: "UNSUPPORTED_PROVIDER_ROLE" });
      expect(requiresProfessionalRoleReview(value)).toBe(value !== "business");
    },
  );

  test.each([null, undefined, "", {}, [], 42])("missing/malformed identity %p never grants practitioner authorization", value => {
    expect(isCanonicalPractitionerRole(value)).toBe(false);
    expect(isClinicalPractitionerRole(value)).toBe(false);
    expect(resolveCareTeamRequestedRole(value)).toBeNull();
  });

  test("friendly UI keys do not modify the canonical identity", () => {
    expect(careTeamRoleDisplayKey("physician")).toBe("doctor");
    expect(careTeamRoleDisplayKey("nurse_practitioner")).toBe("np");
    expect(careTeamRoleDisplayKey("dietitian")).toBe("dietitian");
    expect(careTeamRoleDisplayKey("business")).toBe("business");
    expect(isCanonicalPractitionerRole(careTeamRoleDisplayKey("physician"))).toBe(false);
  });
});
