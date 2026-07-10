// Coach Decision Engine — shared, situation-agnostic pipeline.
//
// This engine must NEVER branch on situation identity (no
// `if (situation === "tired")`). It only knows how to run the pipeline:
//   Situation Adapter provides evidence -> determineIntent -> buildRecommendation
// Each situation owns a SituationAdapter (its own evidence gathering, its own
// follow-up questions, its own intent + recommendation logic) and hands it to
// this engine. Adding a new situation means writing a new adapter, not
// touching this file.

import type {
  CoachResponse,
  SituationAdapter,
} from "../../../shared/coachCornerTypes";

export function resolveCoachingResponse<TContext, TFollowUp, TProfile>(
  adapter: SituationAdapter<TContext, TFollowUp, TProfile>,
  context: TContext,
  followUp: TFollowUp,
  profile: TProfile
): CoachResponse {
  const intent = adapter.determineIntent(context, followUp);
  return adapter.buildRecommendation(intent, context, followUp, profile);
}
