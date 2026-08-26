/**
 * @jest-environment jsdom
 */

import { getIdleTimeout, isClinicalSessionUser } from "@/components/IdleTimeoutModal";

describe("clinical idle-timeout classification", () => {
  it.each([
    [{ role: "coach", professionalRole: null }],
    [{ role: "client", professionalRole: "trainer" }],
    [{ role: "client", professionalRole: "physician" }],
    [{ role: "client", professionalRole: "dietitian" }],
    [{ role: "client", professionalRole: "nurse_practitioner" }],
  ])("uses the clinical 15-minute warning for %o", (user) => {
    expect(isClinicalSessionUser(user as any)).toBe(true);
    expect(getIdleTimeout(user.role, user.professionalRole)).toBe(15 * 60 * 1000);
  });

  it("keeps the consumer/client warning at 60 minutes", () => {
    expect(isClinicalSessionUser({ role: "client", professionalRole: null } as any)).toBe(false);
    expect(getIdleTimeout("client", null)).toBe(60 * 60 * 1000);
  });
});