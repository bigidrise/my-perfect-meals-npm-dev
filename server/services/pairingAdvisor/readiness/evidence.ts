import {
  EvidenceContext, type AdvisorRequest, type AdvisorResponse, type PolicyDecision,
} from "../../../../shared/pairingAdvisor/contracts";
import { parseWineListEntries } from "../../pairings/wineListIdentity";
import { validateAdvisorCandidate } from "../validation";
import { immutableCopy } from "./immutable";
import { ReadinessFailure } from "./execution";

export function prepareEvidence(request: AdvisorRequest): EvidenceContext {
  const list = request.context.wineList;
  if (list && parseWineListEntries(list.text).length > 100) throw new ReadinessFailure("INVALID_REQUEST");
  return immutableCopy(EvidenceContext.parse({
    suppliedList: list ? { revision: list.revision, text: list.text } : null,
  }));
}
export function validateCandidate(
  response: unknown, decision: PolicyDecision, evidence: EvidenceContext,
): AdvisorResponse {
  const result = validateAdvisorCandidate(response, decision, evidence);
  if (result.status !== "accepted") throw new ReadinessFailure("VALIDATION_FAILED");
  return immutableCopy(result.response);
}
