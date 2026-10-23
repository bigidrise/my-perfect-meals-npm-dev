import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createOfflineHarness } from "./runner.mjs";
import { comparisonPlan, assertRequest, manifestDigest, estimateCost, sha256, LIMITS } from "./contract.mjs";
import { MODELS, SETTINGS, RECIPES } from "./recipes.mjs";

const manifest = JSON.parse(readFileSync(new URL("./frozen-prompts.json", import.meta.url)));
const cell = comparisonPlan(manifest)[0];
const clone = value => structuredClone(value);
const round = value => Math.round(value * 1e8) / 1e8;
const flush = async () => { for (let i = 0; i < 64; i++) await Promise.resolve(); };
class Clock {
  time = 0;
  next = 0;
  timers = new Map();
  now = () => this.time;
  set = (fn, delay) => { const id = ++this.next; this.timers.set(id, { at: this.time + delay, fn }); return id; };
  clear = id => this.timers.delete(id);
  async advance(ms) {
    await flush();
    const end = this.time + ms;
    for (;;) {
      const next = [...this.timers].sort((a,b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      this.time = next[1].at; this.timers.delete(next[0]); next[1].fn();
      await flush();
    }
    this.time = end; await flush();
  }
}

test("eight finalized fixtures produce 16 unique, alternating, immutable direct request plans", () => {
  const plan = comparisonPlan(manifest);
  assert.equal(RECIPES.length, 8);
  assert.equal(plan.length, 16);
  assert.equal(new Set(plan.map(p => p.id)).size, 16);
  for (let i=0;i<8;i++) {
    const pair = plan.slice(i*2,i*2+2);
    assert.deepEqual(pair.map(p=>p.model), i%2 ? [...MODELS].reverse() : MODELS);
    assert.equal(pair[0].generation.body.prompt, pair[1].generation.body.prompt);
    assert.equal(pair[0].verificationPrompt, pair[1].verificationPrompt);
    assert.equal(pair[0].promptSha256, sha256(pair[0].generation.body.prompt));
    assert.deepEqual(Object.fromEntries(Object.entries(pair[0].generation.body).filter(([k]) => !["model","prompt"].includes(k))), SETTINGS);
    assert.ok(!("response_format" in pair[0].generation.body));
    assert.equal(pair[0].generation.url, "https://api.openai.com/v1/images/generations");
  }
  assert.throws(()=>{plan[0].generation.body.model="other";}, TypeError);
});

for (const change of [
  m=>m.recipes[0].prompt+=" ",
  m=>m.recipes[0].recipe.ingredients.push("bacon"),
  m=>m.models[0]="gpt-image-1",
  m=>m.settings.quality="high",
  m=>m.recipes.push(m.recipes[0]),
]) test("rejects mutated frozen manifest before dispatch", () => {
  const m=clone(manifest);change(m);
  assert.throws(()=>createOfflineHarness(m), /mismatch/);
});
test("recomputed outer digest cannot conceal prompt hash or recipe identity drift", () => {
  const m=clone(manifest);m.recipes[0].prompt+=" ";
  m.digest=manifestDigest(m);
  assert.throws(()=>createOfflineHarness(m), /identity mismatch/);
});

for(const url of [
  "http://api.openai.com/v1/images/generations",
  "https://api.openai.com.evil.invalid/v1/images/generations",
  "https://api.openai.com/v1/images/generations?other=1",
  "https://api.openai.com/v1/images/edits",
  "https://api.openai.com/v1/responses",
  "https://api.openai.com/v1/files",
]) test(`rejects non-allowlisted endpoint ${url}`, () => {
  assert.throws(()=>assertRequest("generation",{...cell.generation,url},cell),/Endpoint not allowed/);
});
for(const bodyChange of [{n:2},{model:MODELS[1]},{size:"1536x1024"},{quality:"auto"},{output_format:"jpeg"},{response_format:"url"}]) {
  test(`rejects altered generation parameters ${JSON.stringify(bodyChange)}`,()=>{
    assert.throws(()=>assertRequest("generation",{...cell.generation,body:{...cell.generation.body,...bodyChange}},cell),/mismatch/);
  });
}
test("rejects wrong HTTP method and stage before any simulator dispatch",()=>{
  assert.throws(()=>assertRequest("generation",{...cell.generation,method:"GET"},cell),/Endpoint/);
  assert.throws(()=>assertRequest("storage",cell.generation,cell),/Endpoint/);
});
test("verification endpoint and body are independently constrained",()=>{
  const request = {method:"POST",url:"https://api.openai.com/v1/chat/completions",body:{
    model:"gpt-4o",max_tokens:60,messages:[{role:"user",content:[
      {type:"text",text:cell.verificationPrompt},{type:"image_url",image_url:{url:"data:image/png;base64,AAAA",detail:"low"}},
    ]}],
  }};
  assert.doesNotThrow(()=>assertRequest("verification",request,cell));
  for(const edit of [
    r=>r.body.model=MODELS[0],r=>r.body.max_tokens=100,r=>r.body.messages[0].content[0].text+=" ",
    r=>r.body.messages[0].content[1].image_url.url="https://example.invalid/photo.png",
  ]){const r=clone(request);edit(r);assert.throws(()=>assertRequest("verification",r,cell),/mismatch/);}
});

test("offline run makes exactly 16 simulated generations and 16 verifications, no network, no image output", async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error("Network attempted");};
  try {
    const harness=createOfflineHarness(manifest), report=await harness.run();
    assert.equal(report.paidCalls,0);
    assert.equal(report.generationRequests,16);
    assert.equal(report.verificationRequests,16);
    assert.equal(report.maxInFlight,1);
    assert.equal(report.reservedUSD,4);
    assert.equal(round(report.estimatedKnownCostUSD),0.6496);
    assert.equal(report.stopReason,null);
    assert.ok(report.records.every(r=>r.generation.status==="succeeded"&&r.verification.status==="passed"&&r.imageDigest));
    assert.ok(!JSON.stringify(report).includes("base64"));
    assert.ok(Object.isFrozen(report.records[0].generation.usage));
    await assert.rejects(()=>harness.run(),/already consumed/);
  } finally {globalThis.fetch=previous;}
});
test("concurrent rerun is rejected instead of adding a seventeenth request", async()=>{
  const harness=createOfflineHarness(manifest), first=harness.run();
  await assert.rejects(()=>harness.run(),/already consumed/);
  assert.equal((await first).generationRequests,16);
});
test("FAIL verification is recorded, not retried or replaced", async()=>{
  const report=await createOfflineHarness(manifest).run({[cell.id]:{verification:{body:{choices:[{message:{content:"FAIL: egg visible"}}]}}}});
  assert.equal(report.records[0].verification.status,"failed");
  assert.equal(report.generationRequests,16);
  assert.equal(report.verificationRequests,16);
});
for(const status of [400,401,403,429,500]) test(`HTTP ${status} stops without retries or failover`,async()=>{
  const report=await createOfflineHarness(manifest).run({[cell.id]:{generation:{httpStatus:status,body:{usage:undefined}}}});
  assert.equal(report.generationRequests,1);
  assert.equal(report.verificationRequests,0);
  assert.equal(report.reservedUSD,0.25);
  assert.equal(report.records[0].generation.status,"failed");
  assert.equal(report.stopReason,`generation_http_${status}`);
  assert.equal(report.accountingUncertain,true);
});
test("transport failure is uncertain; reservations are retained",async()=>{
  const report=await createOfflineHarness(manifest).run({[cell.id]:{generation:{error:true}}});
  assert.equal(report.stopReason,"transport_uncertain");
  assert.equal(report.generationRequests,1);
  assert.equal(report.reservedUSD,0.25);
  assert.equal(report.accountingUncertain,true);
});
for(const stage of ["generation","verification"]) test(`${stage} deadline retains uncertain reservation and ignores late completion`,async()=>{
  const clock=new Clock(), harness=createOfflineHarness(manifest,{clock});
  const ms=stage==="generation"?150_000:20_000;
  const pending=harness.run({[cell.id]:{[stage]:{delayMs:ms+100,ignoreAbort:true}}});
  await clock.advance(ms+1);
  const report=await pending, text=JSON.stringify(report);
  assert.equal(report.stopReason,"timeout_uncertain");
  assert.equal(report.records[0][stage].cancellation,"requested_unconfirmed");
  assert.equal(report.reservedUSD,0.25);
  assert.equal(report.generationRequests,1);
  await clock.advance(1000);
  assert.equal(JSON.stringify(report),text);
  await assert.rejects(()=>harness.run(),/already consumed/);
});
test("latency is independently measured and requests remain serial",async()=>{
  const clock=new Clock();
  const pending=createOfflineHarness(manifest,{clock}).run({[cell.id]:{generation:{delayMs:120_000},verification:{delayMs:10_000}}});
  await clock.advance(130_001);
  const report=await pending;
  assert.equal(report.records[0].generation.latencyMs,120_000);
  assert.equal(report.records[0].verification.latencyMs,10_000);
  assert.equal(report.records[0].latencyMs,130_000);
  assert.equal(report.maxInFlight,1);
});
test("overall deadline stops verification dispatch when operation time is exhausted",async()=>{
  let calls=0;
  const clock={now:()=>++calls>=3?180_001:0,set:()=>1,clear:()=>{}};
  const report=await createOfflineHarness(manifest,{clock}).run();
  assert.equal(report.stopReason,"overall_deadline");
  assert.equal(report.generationRequests,1);
  assert.equal(report.verificationRequests,0);
});
for(const body of [
  {data:[]},{data:[{url:"https://example.invalid/photo.png"}]},
  {data:[{b64_json:"AAAA"}]},{usage:undefined},
  {usage:{input_tokens:5,input_tokens_details:{text_tokens:1,image_tokens:1},output_tokens:1,total_tokens:6}},
]) test("malformed image or missing/inconsistent usage fails closed",async()=>{
  const report=await createOfflineHarness(manifest).run({[cell.id]:{generation:{body}}});
  assert.equal(report.generationRequests,1);
  assert.equal(report.verificationRequests,0);
  assert.ok(report.stopReason);
  assert.equal(report.reservedUSD,0.25);
});
test("missing verification usage and ambiguous verdict stop further spending",async()=>{
  const report=await createOfflineHarness(manifest).run({[cell.id]:{verification:{body:{usage:undefined}}}});
  assert.equal(report.stopReason,"verification_usage_unknown");
  assert.equal(report.verificationRequests,1);
  assert.equal(report.accountingUncertain,true);
  const unknown=await createOfflineHarness(manifest).run({[cell.id]:{verification:{body:{choices:[{message:{content:"maybe"}}]}}}});
  assert.equal(unknown.stopReason,"verification_unavailable");
});
test("UUID provider request IDs are retained and unsafe IDs are rejected",async()=>{
  const uuid="3e804716-db05-4b85-9e21-1720f0351ab9";
  const report=await createOfflineHarness(manifest).run({[cell.id]:{generation:{requestId:uuid}}});
  assert.equal(report.records[0].generation.requestId,uuid);
  const invalid=await createOfflineHarness(manifest).run({[cell.id]:{generation:{requestId:"secret\nheader"}}});
  assert.equal(invalid.records[0].generation.requestId,null);
  assert.equal(invalid.stopReason,"generation_request_id_missing");
});
test("documented full-rate arithmetic includes image-input tokens without assuming cached discounts",()=>{
  assert.equal(estimateCost("generation",{input_tokens:1500,input_tokens_details:{text_tokens:1000,image_tokens:500},output_tokens:4000,total_tokens:5500}),0.129);
  assert.equal(estimateCost("verification",{prompt_tokens:2000,completion_tokens:60,total_tokens:2060}),0.0056);
  for(const output_tokens of [-1,NaN,Infinity,1.5])assert.throws(()=>estimateCost("generation",{input_tokens:1,input_tokens_details:{text_tokens:1,image_tokens:0},output_tokens,total_tokens:1}),/Usage/);
  assert.equal(LIMITS.operationMs,180_000);
  assert.ok(LIMITS.generationRequests*LIMITS.reservationUSD<=LIMITS.runAllowanceUSD);
});
test("observed cost above reservation stops instead of silently exceeding the risk model",async()=>{
  const usage={input_tokens:1000,input_tokens_details:{text_tokens:1000,image_tokens:0},output_tokens:10000,total_tokens:11000};
  const report=await createOfflineHarness(manifest).run({[cell.id]:{generation:{body:{usage}}}});
  assert.equal(report.stopReason,"reservation_exceeded");
  assert.equal(report.generationRequests,1);
  assert.equal(report.verificationRequests,0);
  assert.equal(round(report.estimatedKnownCostUSD),0.305);
  assert.equal(report.reservedUSD,0.25);
  assert.equal(report.accountingUncertain,true);
});
test("runtime import graph is local/pure and has no credentials, networking, registry, DB, storage or writes",()=>{
  for(const name of ["runner.mjs","contract.mjs","recipes.mjs","offline.mjs"]) {
    const text=readFileSync(new URL(name,import.meta.url),"utf8");
    assert.ok(!/\b(?:fetch|eval|require)\s*\(|process\.env|import\s*\(|writeFile|appendFile|createWriteStream/.test(text),name);
    const imports=[...text.matchAll(/from\s+["']([^"']+)["']/g)].map(m=>m[1]);
    const allowed=new Set(["./runner.mjs","./contract.mjs","./recipes.mjs","node:crypto",...(name==="offline.mjs"?["node:fs"]:[])]);
    imports.forEach(spec=>assert.ok(allowed.has(spec),`${name}: forbidden dependency ${spec}`));
    assert.ok(!imports.some(spec=>/server|storage|openai|registry|database/i.test(spec)));
  }
});
test("CLI runs without environment credentials and rejects any live/enabling flag",()=>{
  const path=new URL("./offline.mjs",import.meta.url).pathname;
  const report=JSON.parse(execFileSync(process.execPath,[path],{env:{},encoding:"utf8"}));
  assert.equal(report.mode,"OFFLINE_FIXTURES_ONLY");
  assert.equal(report.paidCalls,0);
  assert.equal(report.generationRequests,16);
  assert.throws(()=>execFileSync(process.execPath,[path,"--live"],{env:{},stdio:"pipe"}),/Command failed/);
});
test("post-construction mutations cannot change either requests or report identity",async()=>{
  const m=clone(manifest), harness=createOfflineHarness(m);
  m.settings.quality="high";m.digest="changed";m.recipes[0].prompt="changed";
  const report=await harness.run();
  assert.equal(report.manifestSha256,manifest.digest);
  assert.equal(report.requestSettings.quality,"low");
  assert.equal(harness.plan[0].generation.body.prompt,manifest.recipes[0].prompt);
});
