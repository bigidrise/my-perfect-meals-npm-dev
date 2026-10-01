import { verifyPhysicianClientAccess } from "./procareAccessService";
import { handleOrgIsolationError } from "../lib/orgIsolation";

/**
 * Resolve an optional ProCare patient subject. The actor is always server
 * authenticated; a body-supplied client ID is accepted only after the active
 * physician/client relationship and organization boundary are revalidated.
 */
export async function authorizeRefinementSubject(
  actorUserId: string,
  professionalRole: string | null | undefined,
  requestedPatientId: string | undefined,
  res: { status: (code: number) => { json: (body: object) => void } },
): Promise<string | null> {
  if (!requestedPatientId) return actorUserId;
  if (professionalRole !== "physician") {
    res.status(403).json({
      error: "A verified physician session is required to refine a patient's meal.",
      code: "PROFESSIONAL_SUBJECT_REQUIRED",
    });
    return null;
  }

  try {
    if (!(await verifyPhysicianClientAccess(actorUserId, requestedPatientId))) {
      res.status(403).json({
        error: "You do not have active access to this patient.",
        code: "PROFESSIONAL_SUBJECT_REQUIRED",
      });
      return null;
    }
    return requestedPatientId;
  } catch (error) {
    if (handleOrgIsolationError(error, res)) return null;
    res.status(503).json({
      error: "Patient access could not be verified. Please try again.",
      code: "PROFESSIONAL_SUBJECT_UNAVAILABLE",
    });
    return null;
  }
}