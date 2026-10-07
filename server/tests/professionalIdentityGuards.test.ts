import { requirePhase1Cert } from "../middleware/requirePhase1Cert";
import { requirePhase2Training } from "../middleware/requirePhase2Training";
import { requireProfessionalIdentityReviewer } from "../middleware/requireProfessionalIdentityReviewer";
import { getAcademyProgression } from "../services/academyProgression";
import { db } from "../db";

jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/academyProgression", () => ({ getAcademyProgression: jest.fn() }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
const select = db.select as jest.Mock;
function request() {
  return { authUser: { id: "synthetic-reviewer", isAdmin: false, isFounder: true, isTester: true, isSandbox: true },
    session: { userId: "synthetic-reviewer", mfaVerified: true, authSecurityVersion: 7 } } as any;
}
function response() {
  const res = { status: jest.fn(), json: jest.fn() }; res.status.mockReturnValue(res); return res as any;
}
function row(value: unknown) { select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => value }) }) }); }
beforeEach(() => { jest.clearAllMocks(); process.env.PHASE2_GATE_ENABLED = "true"; });
afterAll(() => { delete process.env.PHASE2_GATE_ENABLED; });
describe("Stage 2 readiness and reviewer security guards", () => {
  test.each([requirePhase1Cert, requirePhase2Training])("database failure cannot bypass an active training guard", async guard => {
    select.mockImplementation(() => { throw new Error("database unavailable"); });
    const res = response(); const next = jest.fn(); await guard(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(503); expect(next).not.toHaveBeenCalled();
  });
  test("legacy completed boolean cannot replace real Academy training", async () => {
    row([{ professionalRole: "trainer", procareTrainingCompleted: true }]);
    (getAcademyProgression as jest.Mock).mockResolvedValue({ phase1: { complete: true }, proCare: { complete: false } });
    const res = response(); const next = jest.fn(); await requirePhase2Training(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
  test("Academy read failure is retryable and fail closed", async () => {
    row([{ professionalRole: "trainer", procareTrainingCompleted: true }]);
    (getAcademyProgression as jest.Mock).mockRejectedValue(new Error("evidence unavailable"));
    const res = response(); const next = jest.fn(); await requirePhase2Training(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(503); expect(next).not.toHaveBeenCalled();
  });
  test("actual Academy evidence passes without manufacturing a boolean", async () => {
    row([{ professionalRole: "trainer", procareTrainingCompleted: false }]);
    (getAcademyProgression as jest.Mock).mockResolvedValue({ proCare: { complete: true } });
    const next = jest.fn(); await requirePhase2Training(request(), response(), next); expect(next).toHaveBeenCalledTimes(1);
  });
  test.each([requirePhase1Cert, requirePhase2Training])("deleted accounts cannot pass training guards", async guard => {
    row([]); const res = response(); const next = jest.fn(); await guard(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(401); expect(next).not.toHaveBeenCalled();
  });
  test("founder/tester/sandbox flags do not constitute review authority", async () => {
    row([{ isAdmin: false, mfaEnabled: true, version: 7 }]);
    const res = response(); const next = jest.fn(); await requireProfessionalIdentityReviewer(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
  test.each(["not_enrolled", "not_verified", "stale_version", "bearer_only"])("every admin needs current browser MFA (%s)", async condition => {
    row([{ isAdmin: true, mfaEnabled: condition !== "not_enrolled", version: 7 }]);
    const req = request();
    if (condition === "not_verified") req.session.mfaVerified = false;
    if (condition === "stale_version") req.session.authSecurityVersion = 6;
    if (condition === "bearer_only") { delete req.session; req.bearerMfaVerified = true; }
    const res = response(); const next = jest.fn(); await requireProfessionalIdentityReviewer(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });
  test("persisted admin authority and current MFA establish a version-bound proof", async () => {
    row([{ isAdmin: true, mfaEnabled: true, version: 7 }]);
    const req = request(); const next = jest.fn(); await requireProfessionalIdentityReviewer(req, response(), next);
    expect(req.identityReviewer).toEqual({ id: "synthetic-reviewer", securityVersion: 7, mfaVerified: true });
    expect(next).toHaveBeenCalledTimes(1);
  });
  test("reviewer security database failure never calls next", async () => {
    select.mockImplementation(() => { throw new Error("unavailable"); });
    const res = response(); const next = jest.fn(); await requireProfessionalIdentityReviewer(request(), res, next);
    expect(res.status).toHaveBeenCalledWith(503); expect(next).not.toHaveBeenCalled();
  });
});
