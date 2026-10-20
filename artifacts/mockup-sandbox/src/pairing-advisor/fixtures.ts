import type { AdvisorResponse, ConversationContext } from "../../../../shared/pairingAdvisor/contracts";
import type { ActiveSubmission } from "../../../../shared/pairingAdvisor/conversation";
import type { AdvisorAction, Scenario } from "./model";

export const SYNTHETIC_LIST = "Test Cellar A — Dry White — 2024\nTest Cellar B — Light Red — 2023";
export const OPTIONAL_QUESTIONS = [
  "Why do crisp wines pair with rich food?",
  "Show a sample pairing",
  "Help me understand this wine list",
];

/** Explicit, bounded demo grammar—not semantic interpretation or safety classification. */
export function syntheticContextEdits(message: string): AdvisorAction[] {
  const edits: AdvisorAction[] = [];
  const fields = [
    ["meal", /^(?:my meal is|i'm having|i am having|meal:)\s+(.+)$/i],
    ["preparation", /^(?:preparation:|cooking method:)\s+(.+)$/i],
    ["sauce", /^sauce:\s+(.+)$/i],
    ["taste", /^(?:preference:|my preference is)\s+(.+)$/i],
  ] as const;
  for (const [key, pattern] of fields) {
    const match = message.match(pattern);
    if (match && match[1].length <= 500) edits.push({ type: "edit", key, value: match[1] });
  }
  if (/^(?:something |a little )?(?:less sweet|drier)[?.!]?$/i.test(message.trim())) {
    edits.push({ type: "edit", key: "taste", value: "Less sweet" });
  }
  const budget = message.match(/^(?:keep it under|budget:|under)\s+(USD|EUR|GBP)\s+(\d+(?:\.\d{1,2})?)\s+per (bottle|glass)[.!]?$/i);
  if (budget) {
    edits.push({ type: "edit", key: "currency", value: budget[1].toUpperCase() });
    edits.push({ type: "edit", key: "budget", value: `${budget[2]} per ${budget[3].toLowerCase()}` });
  }
  return edits;
}

export function syntheticResponse(
  submission: ActiveSubmission, context: ConversationContext, message: string, scenario: Scenario,
): AdvisorResponse | unknown {
  const common = {
    version: 1 as const, requestId: submission.requestId,
    conversationId: submission.conversationId, contextRevision: submission.contextRevision,
  };
  const outcome = scenario === "natural"
    ? (/why|explain|understand/i.test(message) ? "education" : "recommendation")
    : scenario;
  if (outcome === "invalid") return { ...common, outcome: "recommendation", recommendations: "unreviewed example" };
  if (outcome === "restricted") return {
    ...common, outcome, reason: "ACTIVE_SAFETY_RESTRICTION",
    message: "Synthetic restriction example: a server-authoritative restriction would limit recommendations here. This preview does not evaluate your health or eligibility.",
    education: { paragraphs: ["General pairing education can be shown only when the server response permits it."], followUps: [] },
  };
  if (outcome === "clarification") return {
    ...common, outcome, reason: "REFERENCE_UNRESOLVED",
    question: "Which pairing would you like to discuss? You can name the wine or describe the dish.",
  };
  if (outcome === "unavailable") return {
    ...common, outcome, reason: "PROVIDER_UNAVAILABLE",
    message: "Synthetic unavailable-service example. No real provider was contacted. Your question and context are still here.",
  };
  if (outcome === "education") return {
    ...common, outcome,
    education: {
      paragraphs: [
        "Think of acidity as contrast: a crisp wine can make a rich bite feel more balanced. Matching the weight of the drink to the food is often a useful starting point.",
        "Preparation and sauce can matter as much as the main ingredient. This is a scripted educational example, not a personal suitability assessment.",
      ],
      followUps: ["What changes with a richer sauce?", "Show a sample pairing"],
    },
  };
  // Fixed examples carry no membership, price, availability or suitability claims.
  const preference = context.taste?.value ? ` Your stated preference is “${context.taste.value}”.` : "";
  return {
    ...common, outcome: "recommendation", education: null,
    recommendations: [
      {
        id: "synthetic-dry-white", name: "Dry white wine — synthetic example",
        listEntryId: null, explanation: `A crisp, lighter style illustrates contrast with a richer dish.${preference}`,
        servingAdvice: null, alternativeIds: ["synthetic-light-red"], claims: [],
      },
      {
        id: "synthetic-light-red", name: "Light-bodied red — synthetic alternative",
        listEntryId: null, explanation: "A lighter red illustrates an alternative when you prefer a red-wine style, without implying a verified bottle or ingredient list.",
        servingAdvice: null, alternativeIds: ["synthetic-dry-white"], claims: [],
      },
    ],
    bestChoiceId: "synthetic-dry-white",
    narrative: [{
      text: context.meal
        ? `You’re discussing “${context.meal.value}”. Here is a fixed example of how a pairing answer could read—not an evaluated recommendation for that meal.`
        : "Here is a fixed example of a pairing conversation. Tell me about the food, preparation, or flavors you want to explore.",
      recommendationIds: ["synthetic-dry-white", "synthetic-light-red"],
    }, ...(context.budget ? [{
      text: `Your budget of ${context.currency?.value ?? "unspecified currency"} ${context.budget.value} is retained. No prices are verified, so these examples are not claimed to meet it.`,
      recommendationIds: [],
    }] : []), ...(context.wineList ? [{
      text: "Your supplied list is retained, but these fixed examples are not verified as members of it.",
      recommendationIds: [],
    }] : [])],
    followUps: [{ text: "Why does the first example work?", recommendationIds: ["synthetic-dry-white"] }],
  };
}
