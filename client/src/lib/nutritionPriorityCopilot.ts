import {
  answerNutritionPriorityEducationQuestion,
  isNutritionPriorityEducationQuestion,
  type NutritionPriorityEducationAudience,
  type NutritionPriorityEducationQuestionContext,
} from "@shared/nutritionPriorityEducation";
import type { KnowledgeResponse } from "@/components/copilot/CopilotContext";

export { isNutritionPriorityEducationQuestion };

export function answerNutritionPriorityCopilotQuestion(
  query: string,
  audience: NutritionPriorityEducationAudience = "adult",
  context: NutritionPriorityEducationQuestionContext = {},
): KnowledgeResponse | null {
  const answer = answerNutritionPriorityEducationQuestion(
    query,
    audience,
    context,
  );
  if (!answer) return null;
  return {
    ...answer,
    spokenText: answer.description,
    type: "knowledge",
  };
}