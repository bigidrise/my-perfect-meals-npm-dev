/**
 * Supportive Accountability & Reinforcement Doctrine — Public API
 *
 * Consumed by:
 *   - Coach's Corner (via universal engine)
 *   - Pregnancy Coach (direct system prompt injection)
 *   - Parent's Corner (direct system prompt injection)
 *
 * Each surface adds its own domain reasoning and safety rules separately.
 * This module provides only the shared behavioral governance layer.
 */

export {
  generateDoctrineSystemPromptSection,
  GOVERNING_OBJECTIVE,
  HARD_PROHIBITION,
  BEHAVIOR_VS_OUTCOME_DOCTRINE,
  RECOVERY_REINFORCEMENT_GUIDANCE,
  EVIDENCE_PATTERN_PLAYBOOKS,
} from "./supportiveAccountabilityDoctrine";

export type { CoachingSurface } from "./supportiveAccountabilityDoctrine";

export {
  classifyBehaviorProgress,
  renderBehaviorSignalBlock,
  getComplianceBehaviorSignal,
  fetchComplianceOutputForUser,
} from "./behaviorProgressClassifier";
