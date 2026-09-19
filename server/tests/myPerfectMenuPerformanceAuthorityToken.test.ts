import {
  issuePerformanceAuthorityToken,
  verifyPerformanceAuthorityToken,
} from "../services/myPerfectMenu/performanceAuthorityToken";

describe("My Perfect Menu Performance authority tokens", () => {
  const authority: any = {
    dateISO: "2026-04-18",
    slot: "meal4",
    sessionType: "strength",
    sessionLabel: "Strength",
    trainingDay: true,
    performanceTrack: "athletic",
    competition: { eventDate: null, competitionType: null, phase: null },
    demand: null,
    nutrition: {
      targets: { calories: 2400, protein: 180, carbs: 250, fat: 70, starchyCarbs: 150, fibrousCarbs: 45 },
      remaining: { calories: 900, protein: 60, carbs: 80, fat: 20, starchyCarbs: 40, starchMealsRemaining: 1 },
      planned: { calories: 2400, protein: 180, carbs: 250, fat: 70, starchyCarbs: 150, starchMeals: 2 },
      starch: { isZeroStarchDay: false, distributionStrategy: "workout", gramsPerRemainingMeal: 40 },
    },
  };

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-performance-authority-secret";
  });

  it("round-trips the signed subject/date/slot/concept authority", () => {
    const token = issuePerformanceAuthorityToken({
      actorUserId: "actor",
      subjectUserId: "subject",
      conceptId: "concept-123",
      destinationDate: authority.dateISO,
      mealSlot: authority.slot,
      builderKey: "performance_competition",
      concept: { id: "concept-123", ideaType: "dinner", title: "Signed Bowl", description: "A signed meal concept." },
      authority,
    });
    expect(verifyPerformanceAuthorityToken(token, {
      actorUserId: "actor",
      subjectUserId: "subject",
      conceptId: "concept-123",
    })?.authority.nutrition.remaining.starchyCarbs).toBe(40);
  });

  it.each([
    ["actor", "subject", "concept-123"],
    ["other", "subject", "concept-123"],
    ["actor", "other", "concept-123"],
    ["actor", "subject", "other"],
  ])("rejects a token replayed for %s/%s/%s", (_actor, actor, concept) => {
    const token = issuePerformanceAuthorityToken({
      actorUserId: "actor",
      subjectUserId: "subject",
      conceptId: "concept-123",
      destinationDate: authority.dateISO,
      mealSlot: authority.slot,
      builderKey: "performance_competition",
      concept: { id: "concept-123", ideaType: "dinner", title: "Signed Bowl", description: "A signed meal concept." },
      authority,
    });
    expect(verifyPerformanceAuthorityToken(token, {
      actorUserId: actor,
      subjectUserId: actor === "other" ? "other" : "subject",
      conceptId: concept,
    })).toBeNull();
  });

  it("rejects tampering and expiry", () => {
    const token = issuePerformanceAuthorityToken({
      actorUserId: "actor",
      subjectUserId: "subject",
      conceptId: "concept-123",
      destinationDate: authority.dateISO,
      mealSlot: authority.slot,
      builderKey: "performance_competition",
      concept: { id: "concept-123", ideaType: "dinner", title: "Signed Bowl", description: "A signed meal concept." },
      authority,
    }, -1);
    expect(verifyPerformanceAuthorityToken(token, {
      actorUserId: "actor",
      subjectUserId: "subject",
      conceptId: "concept-123",
    })).toBeNull();
    expect(verifyPerformanceAuthorityToken(`${token}x`, {
      actorUserId: "actor",
      subjectUserId: "subject",
      conceptId: "concept-123",
    })).toBeNull();
  });
});