import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";
import { runInNewContext } from "node:vm";

test("review/status UI uses the real JSON-returning API helper contract", async () => {
  const calls: unknown[][] = [];
  const fixture = { synthetic: true };
  const exports: Record<string, (...args: any[]) => Promise<unknown>> = {};
  const source = transpileModule(readFileSync("client/src/lib/professionalIdentityReview.ts", "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports, require: () => ({ apiRequest: async (...args: unknown[]) => { calls.push(args); return fixture; } }) });
  for (const [name, args] of [
    ["getProfessionalReviewQueue", []], ["getProfessionalReviewDetail", ["synthetic-request"]],
    ["saveProfessionalIdentityDecision", ["synthetic-request", { revision: 2, decision: "approve" }]], ["getOwnProfessionalReadiness", []],
  ] as const) {
    expect(await exports[name](...args)).toBe(fixture);
  }
  expect(calls[0]).toEqual(["/api/admin/professional-requests"]);
  expect(calls[1]).toEqual(["/api/admin/professional-requests/synthetic-request"]);
  expect(calls[2]).toEqual(["/api/admin/professional-requests/synthetic-request/decision", { method: "POST", body: JSON.stringify({ revision: 2, decision: "approve" }) }]);
  expect(calls[3]).toEqual(["/api/professional-onboarding/readiness"]);
});
