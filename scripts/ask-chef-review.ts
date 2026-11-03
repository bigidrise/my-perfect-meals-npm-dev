import net from "node:net";
import { REVIEW_FIXTURES, type ReviewFixture } from "./ask-chef-review/fixtures";

// Validate before importing the application conversation modules or a provider.
if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Ask Chef review requires an unpublished Development process");
}
const args = process.argv.slice(2);
let live = false;
let paidConsent = false;
let fixture: ReviewFixture = "vegan-soy-missing";
const turns: string[] = [];
for (let index = 0; index < args.length; index++) {
  const argument = args[index];
  if (argument === "--live") live = true;
  else if (argument === "--allow-paid-model-calls") paidConsent = true;
  else if (argument === "--fixture") {
    const value = args[++index] as ReviewFixture;
    if (!REVIEW_FIXTURES.includes(value)) throw new Error(`Choose a synthetic fixture: ${REVIEW_FIXTURES.join(", ")}`);
    fixture = value;
  } else if (argument === "--turn") {
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error("--turn requires a message");
    turns.push(value);
  } else throw new Error(`Unknown review argument: ${argument}`);
}
if (live !== paidConsent) throw new Error("Paid calls require BOTH --live and --allow-paid-model-calls");
if (!turns.length) turns.push("I'm trying to get more protein.", "I don't know how much protein I'm getting.");
if (turns.length > 10 || turns.some(turn => !turn.trim() || turn.length > 2000)) {
  throw new Error("Review supports at most 10 turns, each containing 1–2000 characters");
}

// Process-local network blockade before importing the runner. This also prevents
// PostgreSQL connections/writes in default offline verification. No env changes.
if (!live) {
  const forbidden = () => { throw new Error("Network access is forbidden in offline Ask Chef review"); };
  net.Socket.prototype.connect = forbidden as typeof net.Socket.prototype.connect;
  globalThis.fetch = forbidden as typeof fetch;
}
const { createReviewSession, injectedReviewClient, reviewAnswer } = await import("./ask-chef-review/session");
let client: Parameters<typeof createReviewSession>[0]["client"];
if (live) {
  const { default: OpenAI } = await import("openai");
  // Existing model/settings are owned by runConciergeConversation. Only this
  // explicitly opted-in branch can construct a real provider.
  // Explicit transport also permits offline verification of this opt-in branch;
  // the SDK's Node auto-shim can otherwise ignore a global fetch interceptor.
  client = new OpenAI({ maxRetries: 0, fetch: globalThis.fetch });
} else {
  client = injectedReviewClient(turns.map((_turn, index) =>
    reviewAnswer(`Offline injected reply ${index + 1}. This verifies session plumbing, not coaching quality.`)));
}
const session = createReviewSession({ fixture, client });
console.log(JSON.stringify({ reviewMode: live ? "live-paid-opt-in" : "offline-injected",
  fixture, isolated: true, persisted: false }));
for (const turn of turns) {
  const response = await session.send(turn);
  console.log(JSON.stringify({ member: turn, response, transcriptMessages: session.transcript().length }));
}
