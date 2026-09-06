import { requiresPrivilegedMfa } from "../lib/privilegedMfaPolicy";

describe("central privileged MFA policy", () => {
  it.each([
    "bigidrise@gmail.com",
    " BIGIDRISE@gmail.com ",
  ])("requires MFA for the designated account: %s", (email) => {
    expect(requiresPrivilegedMfa({ email })).toBe(true);
  });

  it.each([
    null,
    "",
    "pepper.totten@yahoo.com",
    "admin@myperfectmeals.com",
    "trainer@myperfectmeals.com",
  ])("does not require MFA for any other account: %s", (email) => {
    expect(requiresPrivilegedMfa({ email })).toBe(false);
  });
});