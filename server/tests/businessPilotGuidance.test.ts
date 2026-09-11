import {
  BUSINESS_PILOT_PROGRAM_VERSION,
  WEEKS,
  getBusinessPilotWeek,
  getPilotAssignmentPack,
} from "../services/businessPilotGuidanceService";
import {
  pilotDeliverySchedule,
  shouldSendMidweek,
  deliveryCopy,
} from "../services/businessPilotDeliveryService";

describe("development Business pilot program", () => {
  test("uses exact four-week authorized program and stable version", () => {
    expect(BUSINESS_PILOT_PROGRAM_VERSION).toBe("business-pilot-2026-01");
    expect(WEEKS.map((w) => w.title)).toEqual([
      "Learn My Perfect Meals",
      "Use It With Real People",
      "Put It Into Your Workflow",
      "Evaluate and Prepare for Review",
    ]);
    expect(WEEKS.every((w) => w.assignments.length >= 5 && w.assignments.length <= 7)).toBe(true);
    expect(WEEKS.flatMap((w) => w.assignments).some((a) => a.key === "w1_setup")).toBe(true);
    expect(WEEKS.flatMap((w) => w.assignments).filter((a) => a.key.endsWith("_schedule_review"))).toHaveLength(4);
    expect(new Set(WEEKS.flatMap((w) => w.assignments).map((a) => a.key)).size).toBe(
      WEEKS.flatMap((w) => w.assignments).length,
    );
  });

  test("week boundaries use the Business window day", () => {
    expect(getBusinessPilotWeek(1)).toBe(1);
    expect(getBusinessPilotWeek(7)).toBe(1);
    expect(getBusinessPilotWeek(8)).toBe(2);
    expect(getBusinessPilotWeek(15)).toBe(3);
    expect(getBusinessPilotWeek(22)).toBe(4);
    expect(getBusinessPilotWeek(31)).toBe(4);
  });

  test("pack values are constrained and progress threshold is strict", () => {
    expect(getPilotAssignmentPack("diabetes_clinical")).toBe("diabetes_clinical");
    expect(getPilotAssignmentPack("invented")).toBe("general_business");
    expect(shouldSendMidweek(2, 5)).toBe(true);
    expect(shouldSendMidweek(3, 6)).toBe(false);
  });

  test("schedule has one weekly, midweek, and bounded final logical message", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(pilotDeliverySchedule(start).map((x) => x.messageType)).toEqual([
      "week_1", "week_2", "week_3", "week_4",
      "midweek_1", "midweek_2", "midweek_3", "midweek_4", "final_review",
    ]);
    expect(pilotDeliverySchedule(start, new Date("2026-01-27T00:00:00Z")).find((x) => x.messageType === "final_review")?.eligible).toBe(true);
    expect(pilotDeliverySchedule(start, new Date("2026-01-30T00:00:00Z")).find((x) => x.messageType === "final_review")?.eligible).toBe(false);
    expect(pilotDeliverySchedule(start, new Date("2026-01-30T00:00:00Z")).filter((x) => x.messageType.startsWith("week_") && x.eligible)).toHaveLength(0);
    expect(deliveryCopy("week_2")).toContain("real people");
    expect(deliveryCopy("week_3")).toContain("workflow");
  });
});