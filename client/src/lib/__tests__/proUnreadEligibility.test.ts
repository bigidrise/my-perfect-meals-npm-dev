import { canPollProfessionalUnread } from "@/lib/proUnreadEligibility";

describe("professional unread eligibility", () => {
  it.each([
    ["anonymous", null],
    ["consumer", { isProCare: false, professionalRole: null }],
    ["client", { isProCare: true, professionalRole: "client" }],
    ["ordinary Pro trainer", { isProCare: false, professionalRole: "trainer" }],
    ["ordinary Clinical physician", { isProCare: false, professionalRole: "physician" }],
  ])("does not poll for %s identities", (_label, user) => {
    expect(canPollProfessionalUnread(user)).toBe(false);
  });

  it.each([
    ["ProCare trainer", { isProCare: true, professionalRole: "trainer" }],
    ["ProCare physician", { isProCare: true, professionalRole: "physician" }],
  ])("allows polling for an eligible %s", (_label, user) => {
    expect(canPollProfessionalUnread(user)).toBe(true);
  });

  it("allows an authenticated Development identity to ask the server, not to bypass it", () => {
    expect(canPollProfessionalUnread({
      id: "fixture-studio-account", isProCare: false, professionalRole: "business",
    }, true)).toBe(true);
    expect(canPollProfessionalUnread({
      id: "fixture-studio-account", isProCare: false, professionalRole: "business",
    })).toBe(false);
    expect(canPollProfessionalUnread(null, true)).toBe(false);
    expect(canPollProfessionalUnread({ professionalRole: "physician", isProCare: true }, true)).toBe(false);
  });
});