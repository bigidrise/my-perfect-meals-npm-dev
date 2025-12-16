import { WalkthroughRegistry } from "@/lib/knowledge/WalkthroughRegistry";
import type { KnowledgeResponse } from "../CopilotContext";

export const startWalkthrough = (id: string): KnowledgeResponse => {
  const steps = WalkthroughRegistry[id];

  if (!steps) {
    return {
      title: "No Walkthrough Found",
      description: "This feature doesn't have a walkthrough yet.",
      type: "knowledge",
    };
  }

  return {
    title: `${id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Walkthrough`,
    description: "Follow these steps to learn this feature.",
    type: "walkthrough",
    steps: steps.map(step => ({
      text: step.text,
      targetId: step.targetId,
    })),
    spokenText: steps[0].text,
  };
};
