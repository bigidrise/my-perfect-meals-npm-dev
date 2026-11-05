/**
 * Six explicitly opted-in provider calls against the normal conversation and
 * safety pipeline. Synthetic context only; no member accounts or saved chats.
 * NODE_ENV=development node --import tsx scripts/ask-chef-founder-live.ts --allow-paid-model-calls
 */
import OpenAI from "openai";
import { createReviewSession } from "./ask-chef-review/session";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT ||
    !process.argv.includes("--allow-paid-model-calls")) {
    throw Error("Unpublished Development and explicit paid-call consent are required");
  }
  let calls = 0;
  let tokens = 0;
  const sdk = new OpenAI({ maxRetries: 0, timeout: 45_000 });
  const client = { chat: { completions: { create: async (args: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => {
    if (++calls > 6) throw Error("Six-call limit exceeded");
    const result = await sdk.chat.completions.create(args);
    tokens += result.usage?.total_tokens ?? 0;
    const raw = JSON.parse(result.choices[0]?.message?.content ?? "{}");
    console.log("FOUNDER_MODEL", JSON.stringify({ call: calls, purpose: raw.responsePurpose,
      intent: raw.navigationIntent, target: raw.conciergeDecision?.destinationId,
      handoffDeclaration: raw.foodDeclarations?.handoffMessage?.mode ?? null }));
    return result;
  } } } };
  const session = createReviewSession({ fixture: "vegetarian-logged", client: client as any });
  const cases = [
    ["Take me to open my grocery list.", "shopping_list"],
    ["How about my shopping list? Take me to my shopping list.", "shopping_list"],
    ["My perfect menu would be great. I don't know what I want, so I want you to choose for me.", "my_perfect_menu"],
    ["I want to eat at a restaurant.", "clarification"],
    ["I want to make a protein shake.", "offer"],
    ["yes", "beverage_creator"],
  ];
  try {
    for (const [request, expected] of cases) {
      const response = await session.send(request);
      const p = response.presentation;
      const actions = response.todayPlan.items.filter(item => item.kind === "use_feature");
      const passed = !response.meta.redFlag && response.meta.concierge?.rendering !== "retry" &&
        (expected === "clarification"
          ? !p?.destinationId && actions.length === 0 && !p?.navigation &&
            !!p?.message.includes("Restaurant Guide") && p.message.includes("Find Meals Near Me")
          : expected === "offer"
            ? !p?.destinationId && actions.length === 0 &&
              p?.navigation?.state === "recommendation_pending" && p.navigation.destinationId === "beverage_creator"
            : p?.destinationId === expected && actions.length === 1 && actions[0].destinationId === expected &&
              p.navigation?.state === (request === "yes" ? "navigation_confirmed" : "direct_navigation"));
      console.log("FOUNDER_LIVE", JSON.stringify({ request, expected, passed, reply: p?.message,
        destinationId: p?.destinationId ?? null, navigation: p?.navigation?.state ?? null,
        actions: actions.map(item => ({ kind: item.kind, destinationId: item.destinationId })),
        foodCompatibility: response.foodCompatibility?.status ?? null }));
      if (!passed) throw Error("Targeted live acceptance failed; no retry or extra calls");
    }
  } finally {
    console.log("FOUNDER_USAGE", JSON.stringify({ calls, tokens, persisted: false, synthetic: true }));
  }
}
main().then(() => process.exit(0), error => {
  console.error("FOUNDER_STOP", error instanceof Error ? error.message : "Unavailable");
  process.exit(1);
});
