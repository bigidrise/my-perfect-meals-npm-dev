/**
 * Investigation reproductions: fictional providers and in-memory DB only.
 * No application corrections, shared-account writes or invitation emails.
 */

let mockProvider: any;
let mockStudios: any[];
let mockBilling: any[];
let mockFailBilling: boolean;
let mockAccess: boolean;
let mockLegal: boolean;
let mockAcademy: boolean;
let mockCredentialReview: boolean;
const mockDatabase: any = {
  select: () => ({
    from: (table: any) => ({
      where: () => {
        const rows = table === require("@shared/schema").users ? [mockProvider] : mockStudios.map(s => ({ ...s }));
        return { limit: async () => rows, then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
      },
    }),
  }),
  insert: (table: any) => ({
    values: (values: any) => {
      const operation = async () => {
        if (table === require("../db/schema/studio").studios) {
          if (mockStudios.some(s => s.ownerUserId === values.ownerUserId)) return [];
          const row = { id: "fixture-clinic", ...values }; mockStudios.push(row); return [row];
        }
        if (mockFailBilling) { mockFailBilling = false; throw new Error("injected billing interruption"); }
        if (!mockBilling.some(b => b.studioId === values.studioId)) mockBilling.push({ ...values });
        return [];
      };
      return { onConflictDoNothing: () => ({ returning: operation, then: (resolve: any, reject: any) => operation().then(resolve, reject) }),
        returning: operation, then: (resolve: any, reject: any) => operation().then(resolve, reject) };
    },
  }),
};
jest.mock("../db", () => ({ db: mockDatabase }));
jest.mock("../services/procareProviderAccess", () => ({ providerHasProCareStudioAccess: async () => mockAccess }));
jest.mock("../services/legalCheck", () => ({ checkLegalAcceptance: async () => ({ allAccepted: mockLegal, missing: mockLegal ? [] : ["fixture-current-agreement"] }) }));
jest.mock("../services/academyProgression", () => ({ getAcademyProgression: async () => ({ phase1: { complete: mockAcademy }, proCare: { complete: true } }) }));
jest.mock("../services/professionalIdentityCredentialBoundary", () => ({ identityRequiresIndependentCredentialReview: async () => mockCredentialReview }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
jest.mock("../services/activityLog", () => ({ logClientActivity: jest.fn() }));
import { ensureStudioForTrainer } from "../services/studioBridge";
import { getProviderStudioReadiness, ensureProviderStudioReady } from "../services/procareStudioReadiness";
import { studios, studioBilling } from "../db/schema/studio";
beforeEach(() => {
  mockProvider = { id: "fictional-physician", professionalRole: "physician", role: "coach", isProCare: true, firstName: "Fictional",
    email: "fictional@example.invalid", organizationId: "fictional-organization", isTester: false, isSandbox: false,
    trialEndsAt: new Date("2026-11-01"), procareTrainingCompleted: true };
  mockStudios = []; mockBilling = []; mockFailBilling = false;
  mockAccess = mockLegal = mockAcademy = true; mockCredentialReview = false;
});
test("properly authorized physician pilot provisions a Clinic and preserves practitioner/Organization identity", async () => {
  const result = await ensureProviderStudioReady(mockProvider.id);
  expect(result.ok).toBe(true);
  expect(result.studio?.studioType).toBe("clinic");
  expect(mockProvider.professionalRole).toBe("physician");
  expect(mockProvider.organizationId).toBe("fictional-organization");
  expect(mockStudios).toHaveLength(1); expect(mockBilling).toHaveLength(1);
});
test("existing Clinic remains the same after refresh, returning login and repeated provisioning", async () => {
  mockStudios = [{ id: "existing-fictional-clinic", ownerUserId: mockProvider.id, type: "clinic", name: "Existing Clinic", orgId: "explicit-clinic-org", status: "active" }];
  for (const _transition of ["refresh", "logout-login", "repeat-login"]) await ensureProviderStudioReady(mockProvider.id);
  expect(mockStudios).toHaveLength(1);
  expect(mockStudios[0]).toMatchObject({ id: "existing-fictional-clinic", orgId: "explicit-clinic-org", status: "active" });
  expect(mockBilling).toHaveLength(1);
});
test("concurrent canonical provisioning produces one Clinic and one billing row", async () => {
  const results = await Promise.all([ensureStudioForTrainer(mockProvider.id), ensureStudioForTrainer(mockProvider.id)]);
  expect(results.every(result => result?.studioId === "fixture-clinic")).toBe(true);
  expect(mockStudios).toHaveLength(1); expect(mockBilling).toHaveLength(1);
});
test("canonical provisioning repairs an interrupted billing insert on retry without replacing the Clinic", async () => {
  mockFailBilling = true;
  expect(await ensureStudioForTrainer(mockProvider.id)).toBeNull();
  expect(mockStudios).toHaveLength(1); expect(mockBilling).toHaveLength(0);
  const recovered = await ensureStudioForTrainer(mockProvider.id);
  expect(recovered?.studioId).toBe("fixture-clinic");
  expect(mockStudios).toHaveLength(1); expect(mockBilling).toHaveLength(1);
});
test("pilot expiration blocks commercial capability but does not delete Clinic ownership", async () => {
  await ensureProviderStudioReady(mockProvider.id);
  const before = JSON.stringify(mockStudios);
  mockAccess = false;
  expect(await getProviderStudioReadiness(mockProvider.id)).toMatchObject({ ok: false, code: "PROCARE_ACCESS_REQUIRED" });
  expect(JSON.stringify(mockStudios)).toBe(before);
});
test("Doctor Test's persisted Business identity is rejected even with commercial access and an existing Clinic", async () => {
  await ensureProviderStudioReady(mockProvider.id);
  mockProvider.professionalRole = "business";
  expect(await getProviderStudioReadiness(mockProvider.id)).toMatchObject({ ok: false, code: "PROVIDER_ROLE_REQUIRED" });
  expect(mockStudios).toHaveLength(1);
});
test.each([
  ["credential review", "INDEPENDENT_CREDENTIAL_VERIFICATION_REQUIRED"],
  ["Academy", "PHASE1_CERT_REQUIRED"],
  ["legal acceptance", "LEGAL_REACCEPT_REQUIRED"],
])("an active commercial pilot never bypasses %s", async (gate, code) => {
  if (gate === "credential review") mockCredentialReview = true;
  if (gate === "Academy") mockAcademy = false;
  if (gate === "legal acceptance") mockLegal = false;
  expect(await getProviderStudioReadiness(mockProvider.id)).toMatchObject({ ok: false, code });
  expect(mockStudios).toHaveLength(0);
});
test("a commercial pilot is not professional activation: isProCare=false still requires setup", async () => {
  mockProvider.isProCare = false;
  expect(await getProviderStudioReadiness(mockProvider.id)).toMatchObject({ ok: false, code: "PROVIDER_ROLE_REQUIRED" });
});
