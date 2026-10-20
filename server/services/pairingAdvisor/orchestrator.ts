import {
  AdvisorResponse, type AdvisorRequest, type EvidenceContext, type PolicyDecision,
  type RestrictedAdvisorResponse,
} from "../../../shared/pairingAdvisor/contracts";
import { decideAdvisorPolicy } from "./policy";
import {
  EDUCATIONAL_PROMPT_CONTRACT, CONSUMPTION_PROMPT_CONTRACT, INTENT_PROMPT_CONTRACT,
} from "./prompts";
import {
  CLARIFICATION_QUESTIONS, RESTRICTION_MESSAGES, UNAVAILABLE_MESSAGES, validateAdvisorResponse,
} from "./validation";
import type { ResolveAuthority } from "./authorityAdapter";
import type { SafetyAdapter } from "./safetyAdapter";

export type SyntheticOrchestration = {
  mode: "synthetic_test_only";
  resolveAuthority: ResolveAuthority;
  safety: SafetyAdapter;
  classify: (input: { request: AdvisorRequest; prompt: typeof INTENT_PROMPT_CONTRACT }) => Promise<unknown>;
  generate: (input: {
    request: AdvisorRequest;
    prompt: typeof EDUCATIONAL_PROMPT_CONTRACT | typeof CONSUMPTION_PROMPT_CONTRACT;
    ownerConstraints: string | null;
    evidence: EvidenceContext;
  }) => Promise<unknown>;
  review: (response: AdvisorResponse) => Promise<unknown>;
};

function metadata(request: AdvisorRequest) {
  return {
    version: 1 as const, requestId: request.requestId,
    conversationId: request.conversationId, contextRevision: request.contextRevision,
  };
}
export function unavailableResponse(
  request: AdvisorRequest,
  reason: keyof typeof UNAVAILABLE_MESSAGES,
): AdvisorResponse {
  return { ...metadata(request), outcome: "unavailable", reason, message: UNAVAILABLE_MESSAGES[reason] };
}

/** Synthetic orchestration only; absent dependencies never select a live implementation. */
export async function orchestrateAdvisor(
  accountId: string, request: AdvisorRequest, deps?: SyntheticOrchestration,
): Promise<AdvisorResponse> {
  if (deps?.mode !== "synthetic_test_only") return unavailableResponse(request, "PROVIDER_UNAVAILABLE");
  try {
    let resolution;
    try {
      resolution = await deps.resolveAuthority(accountId);
    } catch {
      return unavailableResponse(request, "SAFETY_AUTHORITY_UNAVAILABLE");
    }
    const policyInput = {
      enabled: true, access: "authorized" as const, accountId, authority: resolution.authority,
      context: request.context,
    };
    // Validate authority BEFORE classification, even if an injected adapter is malformed.
    const preflight = decideAdvisorPolicy({ ...policyInput, assessment: null });
    if (preflight.kind === "unavailable" || preflight.kind === "forbidden" || preflight.kind === "unauthorized") {
      return unavailableResponse(request, "SAFETY_AUTHORITY_UNAVAILABLE");
    }
    let decision = decideAdvisorPolicy({
      ...policyInput, assessment: await deps.classify({ request, prompt: INTENT_PROMPT_CONTRACT }),
    });
    if (decision.kind === "generate_recommendation") {
      const inputSafety = await deps.safety.checkInput(request, resolution.safetyContext);
      if (inputSafety === "unavailable") return unavailableResponse(request, "SAFETY_AUTHORITY_UNAVAILABLE");
      if (inputSafety === "restricted") {
        decision = { kind: "restricted", reason: "ACTIVE_SAFETY_RESTRICTION", allowEducation: decision.includeEducation };
      }
    }
    let candidate: unknown;
    if (decision.kind === "clarification") {
      candidate = {
        ...metadata(request), outcome: "clarification",
        reason: decision.reason, question: CLARIFICATION_QUESTIONS[decision.reason],
      };
    } else if (decision.kind === "restricted" && !decision.allowEducation) {
      candidate = restrictedResponse(request, decision, null);
    } else if (decision.kind === "generate_education" || decision.kind === "generate_recommendation"
      || (decision.kind === "restricted" && decision.allowEducation)) {
      const consumption = decision.kind === "generate_recommendation";
      const raw = await deps.generate({
        request,
        prompt: consumption ? CONSUMPTION_PROMPT_CONTRACT : EDUCATIONAL_PROMPT_CONTRACT,
        ownerConstraints: consumption ? (resolution.constraints ?? "") : null,
        evidence: evidenceFor(request),
      });
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unavailableResponse(request, "VALIDATION_FAILED");
      const generated = AdvisorResponse.safeParse({ ...raw, ...metadata(request) });
      if (!generated.success) return unavailableResponse(request, "VALIDATION_FAILED");
      if (decision.kind === "restricted") {
        if (generated.data.outcome !== "education") return unavailableResponse(request, "VALIDATION_FAILED");
        candidate = restrictedResponse(request, decision, generated.data.education);
      } else {
        candidate = generated.data;
      }
    } else {
      return unavailableResponse(request, "SAFETY_AUTHORITY_UNAVAILABLE");
    }
    const normalized = AdvisorResponse.safeParse(candidate);
    if (!normalized.success) return unavailableResponse(request, "VALIDATION_FAILED");
    const response = normalized.data;
    const exactPayload = JSON.stringify(response);
    if (response.outcome === "recommendation") {
      if (decision.kind !== "generate_recommendation"
        || !await deps.safety.scanFinal(response, resolution.safetyContext)) {
        return unavailableResponse(request, "VALIDATION_FAILED");
      }
    }
    const generatedContent = response.outcome === "education" || response.outcome === "recommendation"
      || (response.outcome === "restricted" && response.education !== null);
    const review = generatedContent ? await deps.review(response) : null;
    if (JSON.stringify(response) !== exactPayload) return unavailableResponse(request, "VALIDATION_FAILED");
    const validated = validateAdvisorResponse(response, decision, evidenceFor(request), review);
    return validated.status === "accepted" ? validated.response : unavailableResponse(request, "VALIDATION_FAILED");
  } catch {
    // No provider retry, scanner bypass, partial payload, or unrestricted authority fallback.
    return unavailableResponse(request, "PROVIDER_UNAVAILABLE");
  }
}

function evidenceFor(request: AdvisorRequest): EvidenceContext {
  const list = request.context.wineList;
  return { suppliedList: list ? { revision: list.revision, text: list.text } : null };
}

function restrictedResponse(
  request: AdvisorRequest,
  decision: Extract<PolicyDecision, { kind: "restricted" }>,
  education: RestrictedAdvisorResponse["education"],
): AdvisorResponse {
  return {
    ...metadata(request), outcome: "restricted", reason: decision.reason,
    message: RESTRICTION_MESSAGES[decision.reason], education,
  };
}
