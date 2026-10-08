let mockActive = true, mockEntitled = true, mockPhase1 = true, mockTraining = true, mockLegal = true, mockCleared = true;
jest.mock("../db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [{
  id: "fictional-clinician", role: "coach", isProCare: mockActive, professionalRole: "physician",
}] }) }) }) } }));
jest.mock("../services/procareProviderAccess", () => ({ providerHasProCareStudioAccess: async () => mockEntitled }));
jest.mock("../services/professionalIdentityCredentialBoundary", () => ({ identityRequiresIndependentCredentialReview: async () => !mockCleared }));
jest.mock("../services/academyProgression", () => ({ getAcademyProgression: async () => ({
  phase1: { complete: mockPhase1 }, proCare: { complete: mockTraining },
}) }));
jest.mock("../services/legalCheck", () => ({ checkLegalAcceptance: async () => ({ missing: mockLegal ? [] : ["current-agreement"] }) }));
jest.mock("../services/studioBridge", () => ({ ensureStudioForTrainer: jest.fn() }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
import { getProviderStudioReadiness } from "../services/procareStudioReadiness";
beforeEach(() => { mockActive = mockEntitled = mockPhase1 = mockTraining = mockLegal = mockCleared = true; });
test("current independent clearance permits readiness only when all existing gates are ready", async () => {
  expect(await getProviderStudioReadiness("fictional-clinician", { requireTraining: true })).toEqual({ ok: true });
});
test.each([
  ["activation", "PROVIDER_ROLE_REQUIRED"], ["entitlement", "PROCARE_ACCESS_REQUIRED"],
  ["academy", "PHASE1_CERT_REQUIRED"], ["training", "PHASE2_TRAINING_REQUIRED"],
  ["legal", "LEGAL_REACCEPT_REQUIRED"], ["clearance", "INDEPENDENT_CREDENTIAL_VERIFICATION_REQUIRED"],
])("verified credentials cannot replace %s", async (gate, code) => {
  if (gate === "activation") mockActive = false;
  if (gate === "entitlement") mockEntitled = false;
  if (gate === "academy") mockPhase1 = false;
  if (gate === "training") mockTraining = false;
  if (gate === "legal") mockLegal = false;
  if (gate === "clearance") mockCleared = false;
  expect(await getProviderStudioReadiness("fictional-clinician", { requireTraining: true })).toMatchObject({ ok: false, code });
});
