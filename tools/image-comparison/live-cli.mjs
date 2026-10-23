// Importing this file never starts execution. Only direct invocation can claim approval.
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLiveTransport } from "./live-adapter.mjs";
import { createComparisonEngine } from "./runner.mjs";
import { createReviewSink } from "./review-artifacts.mjs";
import { claimAuthorization } from "./authorization-store.mjs";

export async function main() {
  // No credential read, output creation, or network before all explicit gates.
  const [flag, file, ...extra] = process.argv.slice(2);
  if (flag !== "--execute-explicitly-authorized-comparison" || !file || extra.length ||
      process.env.IMAGE_COMPARISON_CONTEXT !== "development" ||
      process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1" ||
      process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID || process.env.NODE_TEST_CONTEXT) {
    throw new Error("Live comparison is not authorized in this invocation");
  }
  const root = resolve("generated-artifacts/image-comparison");
  const manifest = JSON.parse(readFileSync(new URL("./frozen-prompts.json",import.meta.url),"utf8"));
  const authorization = claimAuthorization(file,manifest,root);
  const sink = createReviewSink(join(root,"private-runs"),authorization.runId);
  const transport = createLiveTransport({
    manifest, authorization, fetchImpl: globalThis.fetch,
    loadCredential: () => process.env.OPENAI_API_KEY,
  });
  const report = await createComparisonEngine(manifest,{
    transport, mode:"AUTHORIZED_LIVE_COMPARISON", saveReview: sink.save,
  }).run();
  sink.report(report);
  console.log(JSON.stringify({ completed: !report.stopReason, stopReason: report.stopReason,
    generations: report.generationRequests, verifications: report.verificationRequests,
    reservedUSD: report.reservedUSD, estimatedKnownCostUSD: report.estimatedKnownCostUSD,
    accountingUncertain: report.accountingUncertain }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Deliberately no raw exception/header/body/credential logging.
    console.error("Comparison stopped or authorization rejected. No automatic retry is permitted.");
    process.exitCode = 1;
  });
}
