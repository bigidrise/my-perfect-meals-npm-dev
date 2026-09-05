import { requiresPrivilegedMfa } from "../lib/privilegedMfaPolicy";

const consumer = {
  isFounder: false,
  isAdmin: false,
  role: "client",
  professionalRole: null,
  isBusinessOwner: false,
  isBusinessAdmin: false,
};

describe("central privileged MFA policy", () => {
  it.each([
    { isFounder: true },
    { isAdmin: true },
    { role: "admin" },
    { role: "coach" },
    { professionalRole: "physician" },
    { professionalRole: "nurse_practitioner" },
    { professionalRole: "dietitian" },
    { professionalRole: "trainer" },
    { isBusinessOwner: true },
    { isBusinessAdmin: true },
  ])("requires MFA for privileged authority %#", (authority) => {
    expect(requiresPrivilegedMfa({ ...consumer, ...authority })).toBe(true);
  });

  it("does not require MFA for a consumer", () => {
    expect(requiresPrivilegedMfa(consumer)).toBe(false);
  });

  it("does not exempt a tester when another source grants authority", () => {
    // Tester status is intentionally absent from the policy's authority input.
    expect(requiresPrivilegedMfa({ ...consumer, professionalRole: "trainer" })).toBe(true);
  });
});