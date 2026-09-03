import fs from "node:fs";
import path from "node:path";
import {
  professionalGlucosePeriodSchema,
  type ProfessionalGlucosePeriod,
} from "@shared/professionalGlucose";
import {
  evaluateProfessionalGlucoseAccess,
  type ProfessionalGlucoseAccessFacts,
} from "../services/professionalGlucosePolicy";
import {
  buildProfessionalGlucoseHistory,
  getProfessionalGlucoseWindowStart,
} from "../services/professionalGlucoseHistory";

const allowedFacts: ProfessionalGlucoseAccessFacts = {
  authenticated: true,
  professionalAccountActive: true,
  professionalRole: "physician",
  credentialVerified: true,
  sameOrganization: true,
  activeExactRelationship: true,
  patientMatchesRelationship: true,
  clinicalConsentActive: true,
};

describe("professional raw-glucose authorization policy", () => {
  it("allows an authorized physician", () => {
    expect(evaluateProfessionalGlucoseAccess(allowedFacts)).toMatchObject({
      allowed: true,
      reason: "allowed",
    });
  });

  it("allows a verified dietitian with the same complete authorization facts", () => {
    expect(
      evaluateProfessionalGlucoseAccess({
        ...allowedFacts,
        professionalRole: "dietitian",
      }),
    ).toMatchObject({ allowed: true, reason: "allowed" });
  });

  test.each([
    ["unauthenticated caller", { authenticated: false }, "authentication_required"],
    ["suspended professional account", { professionalAccountActive: false }, "professional_account_inactive"],
    ["unverified physician credential", { credentialVerified: false }, "credential_not_verified"],
    ["cross-organization physician", { sameOrganization: false }, "organization_mismatch"],
    ["unauthorized physician", { activeExactRelationship: false }, "relationship_not_active"],
    ["removed physician relationship", { activeExactRelationship: false }, "relationship_not_active"],
    ["cross-patient request", { patientMatchesRelationship: false }, "patient_mismatch"],
    ["missing or revoked consent", { clinicalConsentActive: false }, "clinical_consent_missing"],
    ["trainer", { professionalRole: "trainer" }, "clinical_role_not_approved"],
    ["coach", { professionalRole: "coach" }, "clinical_role_not_approved"],
    ["Business administrator", { professionalRole: "business" }, "clinical_role_not_approved"],
    ["staff member", { professionalRole: "staff" }, "clinical_role_not_approved"],
    ["unrelated professional", { professionalRole: "nurse_practitioner" }, "clinical_role_not_approved"],
    ["dietitian without verified authorization", { professionalRole: "dietitian", credentialVerified: false }, "credential_not_verified"],
  ])("denies %s", (_label, overrides, reason) => {
    expect(
      evaluateProfessionalGlucoseAccess({
        ...allowedFacts,
        ...(overrides as Partial<ProfessionalGlucoseAccessFacts>),
      }),
    ).toMatchObject({ allowed: false, reason });
  });
});

describe("professional glucose history contract", () => {
  const now = new Date("2026-09-03T18:00:00.000Z");

  it.each([7, 14, 30, 90] as ProfessionalGlucosePeriod[])(
    "accepts the %s-day allowlisted period",
    (period) => {
      expect(professionalGlucosePeriodSchema.parse(String(period))).toBe(period);
      expect(getProfessionalGlucoseWindowStart(period, now).toISOString()).toBe(
        new Date(now.getTime() - period * 86_400_000).toISOString(),
      );
    },
  );

  it.each([0, 1, 8, 365, "all", "14 days"])(
    "rejects a non-allowlisted period: %s",
    (period) => {
      expect(professionalGlucosePeriodSchema.safeParse(period).success).toBe(false);
    },
  );

  it("returns an explicit no-data and unavailable-target state", () => {
    const result = buildProfessionalGlucoseHistory([], {
      periodDays: 14,
      timeZone: "America/Chicago",
      guardrails: null,
      now,
    });
    expect(result).toMatchObject({
      unit: "mg/dL",
      readingCount: 0,
      latestReading: null,
      dataStatus: "no_data",
      targetStatus: "unavailable",
      freshness: { status: "no_data", ageHours: null },
    });
  });

  it("returns one reading as limited history with patient-local time and units", () => {
    const result = buildProfessionalGlucoseHistory(
      [
        {
          valueMgdl: 142,
          context: "POST_MEAL_2H",
          recordedAt: "2026-09-03T15:30:00.000Z",
          notes: "After lunch",
        },
      ],
      {
        periodDays: 7,
        timeZone: "America/Chicago",
        now,
      },
    );
    expect(result.dataStatus).toBe("insufficient_data");
    expect(result.latestReading).toMatchObject({
      value: 142,
      unit: "mg/dL",
      context: "POST_MEAL_2H",
      patientLocalTime: expect.stringContaining("10:30"),
      patientTimeZone: "America/Chicago",
      note: "After lunch",
    });
  });

  it("calculates latest reading and averages separately by context", () => {
    const result = buildProfessionalGlucoseHistory(
      [
        { valueMgdl: 130, context: "FASTED", recordedAt: "2026-09-02T13:00:00Z" },
        { valueMgdl: 110, context: "FASTED", recordedAt: "2026-09-01T13:00:00Z" },
        { valueMgdl: 180, context: "POST_MEAL_2H", recordedAt: "2026-09-03T13:00:00Z" },
      ],
      { periodDays: 14, timeZone: "UTC", now },
    );
    expect(result.latestReading?.value).toBe(180);
    expect(result.averagesByContext).toEqual(
      expect.arrayContaining([
        { context: "FASTED", averageMgdl: 120, readingCount: 2 },
        { context: "POST_MEAL_2H", averageMgdl: 180, readingCount: 1 },
      ]),
    );
    expect(result.averagesByContext).toHaveLength(2);
  });

  it("uses only stored authoritative target fields and classifies matching contexts", () => {
    const result = buildProfessionalGlucoseHistory(
      [
        { valueMgdl: 70, context: "FASTED", recordedAt: "2026-09-03T12:00:00Z" },
        { valueMgdl: 100, context: "FASTED", recordedAt: "2026-09-03T11:00:00Z" },
        { valueMgdl: 160, context: "POST_MEAL_2H", recordedAt: "2026-09-03T10:00:00Z" },
        { valueMgdl: 125, context: "PRE_MEAL", recordedAt: "2026-09-03T09:00:00Z" },
      ],
      {
        periodDays: 14,
        timeZone: "UTC",
        guardrails: { fastingMin: 80, fastingMax: 120, postMealMax: 140 },
        now,
      },
    );
    expect(result.targetStatus).toBe("available");
    expect(result.targetRanges.PRE_MEAL).toBeUndefined();
    expect(result.rangeCounts).toEqual({
      inRange: 1,
      aboveRange: 1,
      belowRange: 1,
      unavailable: 1,
    });
  });

  it("marks data stale after seven days without making a clinical claim", () => {
    const result = buildProfessionalGlucoseHistory(
      [
        {
          valueMgdl: 115,
          context: "FASTED",
          recordedAt: "2026-08-20T18:00:00Z",
        },
      ],
      { periodDays: 30, timeZone: "UTC", now },
    );
    expect(result.freshness).toMatchObject({
      status: "stale",
      ageHours: 336,
      staleAfterHours: 168,
    });
  });

  it("falls back safely to UTC for an invalid patient timezone", () => {
    const result = buildProfessionalGlucoseHistory(
      [
        {
          valueMgdl: 115,
          context: "FASTED",
          recordedAt: "2026-09-03T17:00:00Z",
        },
      ],
      { periodDays: 7, timeZone: "Not/A_Zone", now },
    );
    expect(result.patientTimeZone).toBe("UTC");
    expect(result.latestReading?.patientTimeZone).toBe("UTC");
  });
});

describe("professional glucose route privacy regressions", () => {
  const routesSource = fs.readFileSync(
    path.resolve(__dirname, "../routes/procareRoutes.ts"),
    "utf8",
  );
  const studioRoutesSource = fs.readFileSync(
    path.resolve(__dirname, "../routes/studioRoutes.ts"),
    "utf8",
  );
  const accessSource = fs.readFileSync(
    path.resolve(__dirname, "../services/professionalGlucoseAccess.ts"),
    "utf8",
  );

  it("does not add glucose to the shared Studio client-list payload", () => {
    const clientListRoute = studioRoutesSource.slice(
      studioRoutesSource.indexOf('router.get("/:studioId/clients"'),
      studioRoutesSource.indexOf('router.patch("/:studioId/clients'),
    );
    expect(clientListRoute).not.toContain("glucose");
  });

  it("fetches nutrition-strategy glucose only after the authoritative policy allows it", () => {
    expect(routesSource).toContain(
      "const glucoseAccess = await resolveProfessionalGlucoseAccess(callerId, clientId)",
    );
    expect(routesSource).toMatch(
      /glucoseAccess\.allowed\s*\?\s*db\.select\(\)\s*\.from\(glucoseLogs\)/,
    );
    expect(routesSource).toContain("if (glucoseAccess.allowed)");
    expect(routesSource).toContain(
      "const visibleGlp1Hub = hasGlp1Hub && glucoseAccess.allowed",
    );
    expect(routesSource).toContain("glp1: visibleGlp1Hub ?");
  });

  it("uses one scoped latest-reading batch query for the physician client list", () => {
    expect(accessSource).toContain("SELECT DISTINCT ON (gl.user_id)");
    expect(accessSource).toContain(
      'if (provider.professionalRole !== "physician")',
    );
    expect(accessSource).toContain("INNER JOIN studio_memberships");
    expect(accessSource).toContain("INNER JOIN client_links");
    expect(accessSource).toContain("patient_clinical_data_consent");
  });

  it("audits success and denial without logging glucose values or notes", () => {
    const historyRoute = routesSource.slice(
      routesSource.indexOf('"/clients/:clientId/glucose-history"'),
      routesSource.indexOf('"/glucose/client-summaries"'),
    );
    expect(historyRoute).toContain('outcome: "success"');
    expect(historyRoute).toContain('audit("denied", access.reason)');
    expect(historyRoute).toContain('audit("denied", "data_read_failed")');
    expect(historyRoute).toContain("auditProfessionalGlucoseRejectedResponse");
    expect(routesSource).toContain(
      'requestedPeriod: parsedRequestedPeriod.success',
    );
    expect(historyRoute).not.toMatch(/meta:\s*\{[^}]*valueMgdl/s);
    expect(historyRoute).not.toMatch(/meta:\s*\{[^}]*notes/s);
  });
});