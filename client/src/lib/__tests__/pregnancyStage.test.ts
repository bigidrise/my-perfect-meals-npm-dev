import { derivePregnancyStage } from "@shared/pregnancyStage";
import { derivePregnancyStatus } from "@/lib/pregnancyUtils";

const now = new Date("2026-10-18T12:00:00Z");
const dueAtWeek = (week: number) => new Date(
  now.getTime() + (40 - week) * 7 * 24 * 60 * 60 * 1000,
).toISOString().slice(0, 10);

describe("shared pregnancy stage interpretation", () => {
  it.each([
    [1, "trimester-1"], [13, "trimester-1"], [14, "trimester-2"],
    [27, "trimester-2"], [28, "trimester-3"], [40, "trimester-3"], [42, "trimester-3"],
  ])("derives week %i as %s", (week, expected) => {
    expect(derivePregnancyStage("trimester-1", dueAtWeek(week as number), "due-date", now))
      .toEqual({ resolvedStage: expected, weekOfPregnancy: week });
  });

  it.each(["trying-to-conceive", "breastfeeding", "postpartum"])(
    "preserves explicit %s despite an old due date", stage => {
      expect(derivePregnancyStage(stage, "2026-01-01", "due-date", now))
        .toEqual({ resolvedStage: stage, weekOfPregnancy: null });
    },
  );

  it.each(["not-a-date", "2026-02-30", "2026-13-01", ""])(
    "preserves the saved stage for invalid date %s", due => {
      expect(derivePregnancyStage("trimester-1", due, "due-date", now))
        .toEqual({ resolvedStage: "trimester-1", weekOfPregnancy: null });
    },
  );

  it("preserves manual selection even if the due date belongs to another trimester", () => {
    expect(derivePregnancyStage("trimester-3", dueAtWeek(14), "manual", now))
      .toEqual({ resolvedStage: "trimester-3", weekOfPregnancy: null });
  });

  it.each(["breastfeeding", "postpartum"])("keeps the browser's %s display and breastfeeding status", stage => {
    expect(derivePregnancyStatus({
      pregnancyStage: stage, pregnancyDueDate: "2026-01-01",
      pregnancySupportContext: { trackingMode: "due-date", isBreastfeeding: true },
    })).toMatchObject({ stage, weekOfPregnancy: null, isBreastfeeding: true, nextMilestone: null });
  });

  it("keeps an unconfigured browser profile unconfigured", () => {
    expect(derivePregnancyStatus({})).toBeNull();
  });
});
