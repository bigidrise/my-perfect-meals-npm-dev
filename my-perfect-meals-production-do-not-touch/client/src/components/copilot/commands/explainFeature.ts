import { AppKnowledge } from "@/lib/knowledge/AppKnowledgeRegistry";

export const explainFeature = async (featureId: string) => {
  const data = AppKnowledge[featureId];
  if (!data) {
    return {
      title: "Unknown Feature",
      description:
        "I don't have information about this feature yet, but I'm learning more every day.",
      howTo: [],
      tips: [],
    };
  }

  // Build spoken text that adds value beyond what's shown on card
  // Don't repeat description - user can already read it
  // Focus on actionable how-to steps
  const howToSteps = data.howTo?.length 
    ? `Here's how to use it: ${data.howTo.join(" ")}` 
    : "";
  
  const tipsSection = data.tips?.length 
    ? `Quick tips: ${data.tips.slice(0, 2).join(" ")}` 
    : "";

  const guideReminder = "Remember, every page has a Guide button at the top if you need more help.";

  const spokenText = `${data.title}. ${howToSteps} ${tipsSection} ${guideReminder}`.trim();

  return {
    ...data,
    spokenText,
  };
};
