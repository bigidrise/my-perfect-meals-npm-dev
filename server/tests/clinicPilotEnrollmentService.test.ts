import { clinicTrialEnd } from "../services/clinicPilotEnrollmentService";

describe("clinic patient pilot entitlement clock", () => {
  it("uses an exact 30-day interval from successful enrollment", () => {
    const start = new Date("2026-01-01T12:34:56.789Z");
    expect(clinicTrialEnd(start).getTime() - start.getTime())
      .toBe(30 * 24 * 60 * 60 * 1000);
  });
});