import type { ElementType } from "react";
import {
  getNutritionPriorityEducationEntries,
  type NutritionPriorityEducationEntry,
} from "@shared/nutritionPriorityEducation";

export interface NutritionPriorityLibraryTopic {
  id: string;
  title: string;
  subtitle: string;
  icon: ElementType;
  content: {
    sections: Array<{
      heading: string;
      text?: string;
      list?: string[];
    }>;
  };
  citations: NutritionPriorityEducationEntry["citations"];
}

export function buildNutritionPriorityLibraryTopics(
  icon: ElementType,
): NutritionPriorityLibraryTopic[] {
  return getNutritionPriorityEducationEntries("adult").map((entry) => ({
    id: `nutrition-priority-${entry.id}`,
    title: entry.label,
    subtitle: entry.shortSummary,
    icon,
    content: {
      sections: [
        { heading: "What is it?", text: entry.whatItIs },
        { heading: "Why might someone choose this?", text: entry.whyChooseIt },
        {
          heading: "What can it generally help support?",
          text: entry.generallySupports,
        },
        { heading: "What My Perfect Meals does", text: entry.whatMpmDoes },
        { heading: "Food examples", list: entry.foodExamples },
        { heading: "Important limitations", list: entry.limitations },
      ],
    },
    citations: entry.citations,
  }));
}