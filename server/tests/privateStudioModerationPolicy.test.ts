import {
  moderateContent,
  moderatePrivateStudioContent,
} from "../services/tabletModerationService";

describe("private Studio moderation policy", () => {
  const ordinaryProfanity = "That was shit, but I understand the nutrition plan.";

  it.each([
    ["text", ordinaryProfanity],
    ["voice transcript", ordinaryProfanity],
    ["video transcript", ordinaryProfanity],
  ])("allows ordinary profanity in private Studio %s while preserving the source text", (_channel, originalText) => {
    const result = moderatePrivateStudioContent(originalText);

    expect(result).toEqual(expect.objectContaining({
      allowed: true,
      severity: "medium",
      category: "abusive_language",
      reason: "inappropriate language",
    }));
    expect(originalText).toBe("That was shit, but I understand the nutrition plan.");
  });

  it("keeps ordinary profanity blocked for the base/public moderation policy", () => {
    expect(moderateContent(ordinaryProfanity)).toEqual(expect.objectContaining({
      allowed: false,
      severity: "medium",
      category: "abusive_language",
      reason: "inappropriate language",
    }));
  });

  it.each([
    "Go die.",
    "My number is 555-555-1212.",
    "Message me on Discord.",
    "Just do what I say.",
  ])("continues blocking serious or policy-protected private Studio content: %s", (text) => {
    expect(moderatePrivateStudioContent(text).allowed).toBe(false);
  });
});