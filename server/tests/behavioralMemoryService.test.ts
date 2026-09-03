/**
 * Behavioral preference learning regression tests.
 *
 * Run: npx jest server/tests/behavioralMemoryService.test.ts
 */

const mockSelectResults: any[][] = [];
const mockInnerJoin = jest.fn();

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const rows = mockSelectResults.shift() ?? [];
      const chain: any = {};
      chain.from = jest.fn(() => chain);
      chain.leftJoin = jest.fn(() => chain);
      chain.innerJoin = jest.fn((...args: any[]) => {
        mockInnerJoin(...args);
        return chain;
      });
      chain.where = jest.fn(() => chain);
      chain.orderBy = jest.fn(() => chain);
      chain.limit = jest.fn(() => Promise.resolve(rows));
      return chain;
    }),
  },
}));

import {
  buildBehavioralMemoryPromptSection,
  derivePreferenceProfile,
  hasBehavioralMemorySignals,
} from "../services/behavioralMemoryService";

const NOW = new Date("2026-08-30T18:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function instance(
  title: string,
  status: "eaten" | "logged" | "skipped" | "replaced",
  ageDays = 0,
  ingredients: any[] = [{ name: title }],
) {
  const at = daysAgo(ageDays);
  return {
    title,
    ingredients,
    status,
    createdAt: at,
    statusChangedAt: at,
    loggedAt: status === "eaten" || status === "logged" ? at : null,
  };
}

function queueEvidence({
  saved = [],
  recipes = [],
  instances = [],
}: {
  saved?: any[];
  recipes?: any[];
  instances?: any[];
}) {
  mockSelectResults.push(saved, recipes, instances);
}

describe("behavioral meal preference learning", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockSelectResults.length = 0;
    mockInnerJoin.mockClear();
  });

  test("confirmed consumption produces stronger positive evidence and accumulates when repeated", async () => {
    queueEvidence({
      instances: [
        instance("Grilled Salmon Bowl", "eaten"),
        instance("Salmon Sheet Pan Dinner", "eaten", 1),
      ],
    });

    const profile = await derivePreferenceProfile("user-1");

    expect(profile?.patterns.prefersProteins).toContain("salmon");
    const consumptionEvidence = profile?.evidence.filter(
      evidence => evidence.eventType === "logged_instance",
    ) ?? [];
    expect(consumptionEvidence).toHaveLength(2);
    expect(consumptionEvidence[0]?.score).toBeCloseTo(1.5, 5);
    expect(consumptionEvidence.reduce((total, evidence) => total + evidence.score, 0))
      .toBeGreaterThan(2.9);
  });

  test("one skipped meal does not create an inferred avoidance or generation hint", async () => {
    queueEvidence({
      instances: [instance("Tilapia Taco Bowl", "skipped")],
    });

    const profile = await derivePreferenceProfile("user-1");

    expect(profile).not.toBeNull();
    expect(profile?.avoids).toEqual([]);
    expect(profile?.patterns.prefersProteins).not.toContain("tilapia");
    expect(buildBehavioralMemoryPromptSection(profile!)).toBe("");
  });

  test("one skip does not weaken an existing marginal preference", async () => {
    queueEvidence({
      saved: [{
        id: "saved-1",
        title: "Baked Tilapia",
        mealData: { ingredients: [{ name: "tilapia" }] },
        createdAt: daysAgo(30),
      }],
      instances: [instance("Tilapia Taco Bowl", "skipped")],
    });

    const profile = await derivePreferenceProfile("user-1");

    expect(profile?.patterns.prefersProteins).toContain("tilapia");
    expect(profile?.avoids).not.toContain("tilapia dishes");
  });

  test("repeated skips and replacements create a bounded soft avoidance", async () => {
    queueEvidence({
      instances: [
        instance("Tilapia Taco Bowl", "skipped"),
        instance("Baked Tilapia", "replaced", 1),
      ],
    });

    const profile = await derivePreferenceProfile("user-1");
    const prompt = buildBehavioralMemoryPromptSection(profile!);

    expect(profile?.avoids).toContain("tilapia dishes");
    expect(profile?.likes).toHaveLength(0);
    expect(hasBehavioralMemorySignals(profile!)).toBe(true);
    expect(profile?.patterns.prefersProteins).not.toContain("tilapia");
    expect(prompt).toContain("Repeatedly does not choose: tilapia dishes");
    expect(prompt).toContain("soft recommendation hints only");
    expect(prompt).not.toContain("ABSOLUTE RULE");
  });

  test("negative evidence decays below the avoidance threshold", async () => {
    queueEvidence({
      instances: [
        instance("Tilapia Taco Bowl", "skipped", 20),
        instance("Baked Tilapia", "replaced", 20),
      ],
    });

    const profile = await derivePreferenceProfile("user-1");

    expect(profile?.avoids).toEqual([]);
    expect(buildBehavioralMemoryPromptSection(profile!)).toBe("");
  });

  test("a recent skip uses the action time rather than an old plan creation time", async () => {
    const recentSkipFromOldPlan = {
      ...instance("Tilapia Taco Bowl", "skipped"),
      createdAt: daysAgo(60),
      statusChangedAt: daysAgo(0),
    };
    queueEvidence({
      instances: [
        recentSkipFromOldPlan,
        { ...recentSkipFromOldPlan, title: "Baked Tilapia", statusChangedAt: daysAgo(1) },
      ],
    });

    const profile = await derivePreferenceProfile("user-1");

    expect(profile?.avoids).toContain("tilapia dishes");
    expect(profile?.evidence.every(evidence => evidence.daysSince <= 1)).toBe(true);
  });

  test("new confirmed consumption cancels older negative evidence and restores affinity", async () => {
    queueEvidence({
      instances: [
        instance("Tilapia Taco Bowl", "skipped", 10),
        instance("Baked Tilapia", "replaced", 10),
        instance("Grilled Tilapia", "eaten"),
      ],
    });

    const profile = await derivePreferenceProfile("user-1");

    expect(profile?.avoids).not.toContain("tilapia dishes");
    expect(profile?.patterns.prefersProteins).toContain("tilapia");
  });

  test("meal-instance evidence is resolved through an owned-recipe join", async () => {
    queueEvidence({ instances: [] });

    await derivePreferenceProfile("owner-user");

    expect(mockInnerJoin).toHaveBeenCalledTimes(1);
  });

  test("behavioral hints remain explicitly subordinate to safety rules", async () => {
    queueEvidence({
      instances: [
        instance("Shrimp Stir Fry", "eaten"),
        instance("Shrimp Curry", "eaten"),
      ],
    });

    const profile = await derivePreferenceProfile("user-1");
    const prompt = buildBehavioralMemoryPromptSection(profile!);

    expect(prompt).toContain("do not override dietary or medical rules");
    expect(prompt).not.toContain("overrides everything");
  });
});