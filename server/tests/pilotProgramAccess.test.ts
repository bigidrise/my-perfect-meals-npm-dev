import {
  assertPilotCapacityAvailable,
  isOrganizationalPilotEntitlementActive,
} from "../services/pilotProgramAccess";

describe("organizational pilot entitlement foundation", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");
  const end = new Date("2026-10-01T00:00:00.000Z");
  const inside = new Date("2026-09-15T00:00:00.000Z");

  test("requires an active pilot and active participant inside the shared window", () => {
    expect(isOrganizationalPilotEntitlementActive({
      pilotStatus: "active",
      participantStatus: "active",
      pilotStartAt: start,
      pilotEndAt: end,
    }, inside)).toBe(true);
  });

  test("preparing never grants normal pilot commercial access", () => {
    expect(isOrganizationalPilotEntitlementActive({
      pilotStatus: "preparing",
      participantStatus: "active",
      pilotStartAt: null,
      pilotEndAt: null,
    }, inside)).toBe(false);
  });

  test("late participants inherit the organization end date", () => {
    const state = {
      pilotStatus: "active" as const,
      participantStatus: "active" as const,
      pilotStartAt: start,
      pilotEndAt: end,
    };
    expect(isOrganizationalPilotEntitlementActive(
      state,
      new Date("2026-09-30T23:59:59.999Z"),
    )).toBe(true);
    expect(isOrganizationalPilotEntitlementActive(state, end)).toBe(false);
  });

  test("professional seats and client capacity are independent", () => {
    expect(() => assertPilotCapacityAvailable({
      populationType: "professional",
      capacity: 5,
      reservedCount: 5,
    })).toThrow("No professional seats available");
    expect(() => assertPilotCapacityAvailable({
      populationType: "client",
      capacity: 30,
      reservedCount: 0,
    })).not.toThrow();
  });
});