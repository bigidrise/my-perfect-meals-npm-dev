export interface HumanFoodRequestExecutionState {
  readonly rejectedCandidateSignatures: string[];
}

const MAX_REJECTED_CANDIDATES = 3;

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
  if (state.rejectedCandidateSignatures.length > MAX_REJECTED_CANDIDATES) {
    state.rejectedCandidateSignatures.splice(
      0,
      state.rejectedCandidateSignatures.length - MAX_REJECTED_CANDIDATES,
    );
  }
}

export function buildHumanFoodRepairInstructions(input: {
  state: HumanFoodRequestExecutionState;
  contextFingerprint: string;
  repairHints: string[];
}): string[] {
  const hints = input.repairHints
    .map((hint) => hint.trim())
    .filter(Boolean)
    .slice(0, 3);
  const rejected = buildRejectedCandidatePrompt(input.state);
  return [
    `Reuse the identical authoritative food context (${input.contextFingerprint}); do not resolve or infer a new profile.`,
    "Preserve the requested cuisine, cuisine intensity, dish identity, food category, heat, seasoning, and flavor while repairing only the rejected constraints.",
    ...hints,
    ...(rejected ? [rejected] : []),
  ];
}

export function buildRejectedCandidatePrompt(
  state: HumanFoodRequestExecutionState,
): string {
  return state.rejectedCandidateSignatures.length
    ? `Previous candidates were rejected. Produce a materially different result and do not repeat: ${state.rejectedCandidateSignatures.join(" | ")}`
    : "";
}