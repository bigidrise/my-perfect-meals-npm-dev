// OFFLINE ONLY. No network client, credential access, application imports, or writes.
import { comparisonPlan, assertRequest, deepFreeze, sha256, estimateCost, safeRequestId, LIMITS, VERIFIER } from "./contract.mjs";

const PNG_FIXTURE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const systemClock = { now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
const generationUsage = { input_tokens: 1000, input_tokens_details: { text_tokens: 1000, image_tokens: 0 }, output_tokens: 1000, total_tokens: 2000 };
const verificationUsage = { prompt_tokens: 2000, completion_tokens: 60, total_tokens: 2060 };

// Declarative scenarios, never injected transport callbacks. No live adapter exists.
function simulate(stage, script, signal, clock, index, state) {
  const spec = script ?? {};
  state.inFlight++;
  state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
  let done = false;
  const finish = () => { if (!done) { done = true; state.inFlight--; } };
  return new Promise((resolve, reject) => {
    let timer;
    signal.addEventListener("abort", () => {
      if (!spec.ignoreAbort) {
        if (timer !== undefined) clock.clear(timer);
        finish();
        reject(new Error("Fixture aborted; provider cancellation unconfirmed"));
      }
    }, { once: true });
    if (spec.never) return;
    const complete = () => {
      finish();
      if (spec.error) { reject(new Error("Scripted provider failure")); return; }
      resolve({
        requestId: spec.requestId ?? `req_offline_${stage}_${index}`,
        status: spec.httpStatus ?? 200,
        body: stage === "generation"
          ? { data: [{ b64_json: PNG_FIXTURE }], usage: generationUsage, ...spec.body }
          : { choices: [{ message: { content: "PASS" } }], usage: verificationUsage, ...spec.body },
      });
    };
    if (spec.delayMs) timer = clock.set(complete, spec.delayMs); else complete();
  });
}
async function bounded(stage, spec, deadline, clock, state, index) {
  const start = clock.now(), controller = new AbortController();
  const stop = {};
  let timer;
  const pending = simulate(stage, spec, controller.signal, clock, index, state);
  const timeout = new Promise(resolve => {
    timer = clock.set(() => { controller.abort(); resolve(stop); }, Math.max(0, deadline - start));
  });
  try {
    const result = await Promise.race([pending, timeout]);
    return result === stop
      ? { outcome: "uncertain", reason: "timeout_uncertain", cancellation: "requested_unconfirmed", latencyMs: clock.now() - start }
      : { outcome: "response", response: result, cancellation: "not_requested", latencyMs: clock.now() - start };
  } catch {
    return { outcome: "uncertain", reason: controller.signal.aborted ? "timeout_uncertain" : "transport_uncertain",
      cancellation: controller.signal.aborted ? "requested_unconfirmed" : "not_requested", latencyMs: clock.now() - start };
  } finally { clock.clear(timer); }
}

export function createOfflineHarness(manifest, { clock = systemClock } = {}) {
  // Clone before freezing: a caller cannot change prompt bytes during execution.
  const frozenManifest = deepFreeze(structuredClone(manifest));
  const plan = comparisonPlan(frozenManifest);
  let used = false;
  return Object.freeze({
    plan,
    async run(scenarios = {}) {
      if (used) throw new Error("Harness already consumed; no resume or retry");
      used = true;
      const report = {
        mode: "OFFLINE_FIXTURES_ONLY", paidCalls: 0, generationRequests: 0, verificationRequests: 0,
        manifestSha256: frozenManifest.digest, requestSettings: frozenManifest.settings, limits: LIMITS,
        pricingBasis: {
          reviewedDate: "2026-10-23", currency: "USD", processing: "Standard",
          source: "https://developers.openai.com/api/docs/pricing",
          imageModelPerMillionTokens: { textInput: 5, imageInput: 8, imageOutput: 30 },
          verifierPerMillionTokens: { input: 2.5, output: 10 },
          cachedDiscountAssumed: false,
        },
        reservedUSD: 0, estimatedKnownCostUSD: 0, accountingUncertain: false,
        allowanceUSD: LIMITS.runAllowanceUSD,
        warning: "Application risk allowance, NOT a guaranteed provider billing cap. Reservations are never automatically refunded.",
        stopReason: null, maxInFlight: 0, records: [],
      };
      const state = { inFlight: 0, maxInFlight: 0 };
      for (const cell of plan) {
        if (report.generationRequests >= LIMITS.generationRequests ||
            report.reservedUSD + LIMITS.reservationUSD > LIMITS.runAllowanceUSD ||
            LIMITS.reservationUSD > LIMITS.operationUSD) {
          report.stopReason = "request_or_reservation_limit"; break;
        }
        const start = clock.now(), overallEnd = start + LIMITS.operationMs;
        const record = {
          id: cell.id, model: cell.model, recipeId: cell.recipeId, promptSha256: cell.promptSha256,
          reservationUSD: LIMITS.reservationUSD, estimatedCostUSD: 0, generation: { status: "pending" },
          verification: { status: "not_requested" }, imageDigest: null, latencyMs: 0,
        };
        report.records.push(record);
        report.reservedUSD += LIMITS.reservationUSD;
        assertRequest("generation", cell.generation, cell);
        report.generationRequests++;
        const gen = await bounded("generation", scenarios[cell.id]?.generation,
          Math.min(overallEnd, start + LIMITS.generationMs), clock, state, report.generationRequests);
        record.generation = { status: gen.outcome, latencyMs: gen.latencyMs, cancellation: gen.cancellation };
        if (gen.outcome === "uncertain") {
          record.generation.reason = gen.reason;
          report.accountingUncertain = true; report.stopReason = gen.reason;
        } else {
          const response = gen.response;
          record.generation.requestId = safeRequestId(response.requestId);
          record.generation.httpStatus = response.status;
          record.generation.usage = response.body?.usage ?? null;
          try {
            record.generation.estimatedCostUSD = estimateCost("generation", response.body?.usage);
            record.estimatedCostUSD += record.generation.estimatedCostUSD;
          } catch { report.accountingUncertain = true; report.stopReason = "generation_usage_unknown"; }
          if (response.status !== 200) {
            record.generation.status = "failed"; report.stopReason = `generation_http_${response.status}`;
          } else {
            const image = response.body?.data?.[0]?.b64_json;
            if (response.body?.data?.length !== 1 || typeof image !== "string" ||
                !/^[A-Za-z0-9+/]+=*$/.test(image) || !Buffer.from(image, "base64").subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
              record.generation.status = "failed"; report.stopReason = "invalid_png_response";
            } else {
              record.generation.status = "succeeded";
              record.imageDigest = sha256(Buffer.from(image, "base64"));
              if (!record.generation.requestId) report.stopReason = "generation_request_id_missing";
              if (!report.stopReason && record.estimatedCostUSD >= LIMITS.reservationUSD) report.stopReason = "reservation_exceeded";
              if (!report.stopReason && clock.now() >= overallEnd) report.stopReason = "overall_deadline";
              if (!report.stopReason) {
                const request = {
                  method: "POST", url: "https://api.openai.com/v1/chat/completions",
                  body: { model: VERIFIER, max_tokens: 60, messages: [{ role: "user", content: [
                    { type: "text", text: cell.verificationPrompt },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${image}`, detail: "low" } },
                  ] }] },
                };
                assertRequest("verification", request, cell);
                if (report.verificationRequests >= LIMITS.verificationRequests) throw new Error("Verification limit");
                report.verificationRequests++;
                const ver = await bounded("verification", scenarios[cell.id]?.verification,
                  Math.min(overallEnd, clock.now() + LIMITS.verificationMs), clock, state, report.verificationRequests);
                record.verification = { status: ver.outcome, model: VERIFIER, latencyMs: ver.latencyMs, cancellation: ver.cancellation };
                if (ver.outcome === "uncertain") {
                  record.verification.reason = ver.reason; report.accountingUncertain = true; report.stopReason = ver.reason;
                } else {
                  record.verification.requestId = safeRequestId(ver.response.requestId);
                  record.verification.httpStatus = ver.response.status;
                  record.verification.usage = ver.response.body?.usage ?? null;
                  try {
                    record.verification.estimatedCostUSD = estimateCost("verification", ver.response.body?.usage);
                    record.estimatedCostUSD += record.verification.estimatedCostUSD;
                  } catch { report.accountingUncertain = true; report.stopReason = "verification_usage_unknown"; }
                  const verdict = ver.response.body?.choices?.[0]?.message?.content?.trim();
                  record.verification.status = ver.response.status === 200 && verdict === "PASS" ? "passed"
                    : ver.response.status === 200 && /^FAIL:/.test(verdict ?? "") ? "failed" : "unavailable";
                  if (!record.verification.requestId) report.stopReason = "verification_request_id_missing";
                  if (record.verification.status === "unavailable") report.stopReason = "verification_unavailable";
                }
              }
            }
          }
        }
        record.latencyMs = clock.now() - start;
        report.estimatedKnownCostUSD += record.estimatedCostUSD;
        if (record.estimatedCostUSD > LIMITS.reservationUSD) {
          report.accountingUncertain = true; report.stopReason = "reservation_exceeded";
        }
        if (clock.now() > overallEnd) report.stopReason = "overall_deadline";
        if (report.stopReason) break;
      }
      report.maxInFlight = state.maxInFlight;
      return deepFreeze(report);
    },
  });
}
