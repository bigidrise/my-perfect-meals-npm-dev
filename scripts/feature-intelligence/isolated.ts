import { run, requireDevelopment } from "./cli";
import { MPM_CAPABILITIES } from "../../server/services/coaching/capabilityRegistry";

/** A separate local process. Never starts the app, authenticates an account,
 * calls a provider, saves a conversation or enables the running workspace. */
requireDevelopment(process.env.NODE_ENV);
if (process.env.REPLIT_DEPLOYMENT) throw new Error("Published runtimes cannot run this diagnostic.");
const args = process.argv.slice(2);
const message = args[0] ?? "What do you do?";
const screen = args[1];
run(process.cwd());
process.env.ASK_CHEF_FEATURE_INTELLIGENCE = "true"; // this short-lived process only
const { runConciergeConversation } = await import(new URL("../../server/services/coaching/conciergeConversation.ts", import.meta.url).href);
let providerAttempts = 0;
const response = await runConciergeConversation({
  client: { chat: { completions: { create: () => { providerAttempts++; throw new Error("Provider calls are forbidden in this diagnostic."); } } } },
  userMessage: message, history: [], rollingContext: null, context: {},
  tools: MPM_CAPABILITIES.map(cap => ({ ...cap, scope: "adult", featureTarget: cap.id })),
  knowledgeAccess: { organizationAdmin: false, professional: false },
  featureScreenContext: screen ? { currentRoute: screen } : undefined,
});
if (providerAttempts) throw new Error("Not an isolated feature-help question; no provider request was sent.");
if (response.presentation?.destinationId || response.todayPlan.items.length)
  throw new Error("Diagnostic must not grant navigation or execute actions.");
console.log(JSON.stringify({ mode: "isolated synthetic member context; no account/persistence/model", providerCalls: 0,
  message: response.presentation?.message }, null, 2));
