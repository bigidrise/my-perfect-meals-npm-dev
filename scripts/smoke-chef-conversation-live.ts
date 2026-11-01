/**
 * Explicitly opt-in, bounded synthetic observation. No DB imports or persistence.
 * tsx scripts/smoke-chef-conversation-live.ts --allow-small-live-test
 */
import OpenAI from "openai";
import { runConciergeConversation } from "../server/services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../server/services/coaching/capabilityRegistry";
import type { PendingRecommendation } from "../server/services/coaching/conciergeNavigationState";

async function main() {
  if (!process.argv.includes("--allow-small-live-test")) {
    throw new Error("Live tests incur provider usage; explicit opt-in is required.");
  }
  const sdk = new OpenAI({ maxRetries: 0, timeout: 30_000 });
  const restaurantConfirmation = process.argv.includes("--restaurant-confirmation");
  let totalTokens = 0;
  const client = { chat: { completions: { create: async (args: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => {
    const result = await sdk.chat.completions.create({ ...args, max_tokens: 600 });
    totalTokens += result.usage?.total_tokens ?? 0;
    const turn = JSON.parse(result.choices[0]?.message?.content ?? "{}");
    // Only synthetic classification metadata; no credentials or member data.
    console.log(JSON.stringify({ synthetic: true, careDisposition: turn.careDisposition, redFlag: turn.redFlag,
      navigationIntent: turn.navigationIntent, decision: turn.conciergeDecision }));
    return result;
  } } } };
  const history: Array<{ role: string; content: string }> = [];
  let pendingRecommendation: PendingRecommendation | undefined;
  const messages = restaurantConfirmation
    ? ["I want some ice cream.", "I wanna go to a restaurant to get ice cream.", "yes"]
    : ["I want ice cream.", "I want to make it.", "Actually, I'm buying it at Walmart."];
  let completedRestaurantHandoff = false;
  for (const message of messages) {
    const response = await runConciergeConversation({
      client: client as unknown as OpenAI, userMessage: message, history,
      pendingRecommendation, rollingContext: null,
      context: { coachingContextBlock: "Synthetic adult test member. No symptoms or clinical conditions reported. No personal data or entitlement claims. Non-persisting observation." },
      tools: getCornerCapabilities(["all"]).map(cap => ({ ...cap, scope: "adult", featureTarget: cap.id })),
    });
    const reply = response.presentation?.message ?? response.todayPlan.items.map(item => item.text).join("\n");
    console.log(JSON.stringify({ liveModel: true, input: message, reply,
      redFlag: response.meta.redFlag, destination: response.presentation?.destinationId ?? null,
      navigation: response.presentation?.navigation?.state ?? null }));
    if (response.meta.redFlag || response.meta.concierge?.rendering === "retry") {
      throw new Error("Ordinary synthetic conversation did not complete normally; stopping without retries.");
    }
    pendingRecommendation = response.presentation?.navigation?.state === "recommendation_pending"
      ? response.presentation.navigation : undefined;
    completedRestaurantHandoff = response.presentation?.destinationId === "find_meals_near_me" &&
      response.presentation?.navigation?.state === "navigation_confirmed";
    history.push({ role: "user", content: message }, { role: "assistant", content: reply });
  }
  console.log(JSON.stringify({ liveTurns: 3, totalTokens, persisted: false, completedRestaurantHandoff }));
  if (restaurantConfirmation && !completedRestaurantHandoff) {
    throw new Error("One affirmative did not complete the restaurant handoff.");
  }
}
main().catch(() => {
  console.error("Controlled live test failed or provider unavailable. No retries or saved conversations.");
  process.exitCode = 1;
});
