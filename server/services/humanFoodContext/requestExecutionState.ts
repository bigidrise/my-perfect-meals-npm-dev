export interface HumanFoodRequestExecutionState {
  readonly rejectedCandidateSignatures: string[];
}

export function createHumanFoodRequestExecutionState(): HumanFoodRequestExecutionState {
  return { rejectedCandidateSignatures: [] };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 240);
}

export function humanFoodCandidateSignature(candidate: any): string {
  const ingredients = Array.isArray(candidate?.ingredients)
    ? candidate.ingredients
        .map((item: any) => typeof item === "string" ? item : item?.name ?? item?.item ?? "")
        .filter(Boolean)
        .join(",")
    : "";
  return normalize(`${candidate?.name ?? ""}|${ingredients}`);
}

export function recordRejectedHumanFoodCandidate(
  state: HumanFoodRequestExecutionState,
  candidate: unknown,
): void {
  const signature = humanFoodCandidateSignature(candidate);
  if (!signature || state.rejectedCandidateSignatures.includes(signature)) return;
  state.rejectedCandidateSignatures.push(signature);
}

export function buildRejectedCandidatePrompt(
  state: HumanFoodRequestExecutionState,
): string {
  return state.rejectedCandidateSignatures.length
    ? `Previous candidates were rejected. Produce a materially different result and do not repeat: ${state.rejectedCandidateSignatures.join(" | ")}`
    : "";
}