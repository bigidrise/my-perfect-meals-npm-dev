import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, chmodSync, rmSync, readdirSync, lstatSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createLiveTransport, validateAuthorization, validatePNG, pngCRC } from "./live-adapter.mjs";
import { deflateSync } from "node:zlib";
import { createComparisonEngine } from "./runner.mjs";
import { comparisonPlan, LIMITS } from "./contract.mjs";
import { MODELS, SETTINGS, VERIFIER } from "./recipes.mjs";
import { correctComparisonPrompts, BASELINE_DIGEST } from "./prompt-review.mjs";
import { writePrivate, createReviewSink } from "./review-artifacts.mjs";
import { claimAuthorization } from "./authorization-store.mjs";

const manifest=JSON.parse(readFileSync(new URL("./frozen-prompts.json",import.meta.url)));
const baseline=JSON.parse(readFileSync(new URL("./phase2b-prompts.json",import.meta.url)));
const plan=comparisonPlan(manifest), first=plan[0];
const NOW=Date.UTC(2026,9,23,22,30);
const approval=()=>({
  kind:"explicit-image-comparison-authorization",context:"development",manifestSha256:manifest.digest,
  models:[...MODELS],settings:{...SETTINGS},limits:{...LIMITS},verifier:VERIFIER,
  acceptsNonGuaranteedBillingCap:true,allowTemporaryPrivateArtifacts:true,
  runId:"approved-test-run",expiresAt:new Date(NOW+3_000_000).toISOString(),
});
// Solid-color synthetic pixel fixture, never AI output. No provider-test files.
const header=Buffer.alloc(13);header.writeUInt32BE(1024);header.writeUInt32BE(1024,4);header[8]=8;header[9]=6;
const chunk=(type,data)=>{const bytes=Buffer.alloc(12+data.length);bytes.writeUInt32BE(data.length);bytes.write(type,4);data.copy(bytes,8);bytes.writeUInt32BE(pngCRC(bytes.subarray(4,8+data.length)),8+data.length);return bytes;};
const png=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.alloc((1024*4+1)*1024))),chunk("IEND",Buffer.alloc(0))]);
const image=png.toString("base64");
const genBody=()=>({data:[{b64_json:image}],usage:{input_tokens:1000,input_tokens_details:{text_tokens:1000,image_tokens:0},output_tokens:1000,total_tokens:2000}});
const verBody=()=>({choices:[{message:{content:"PASS"}}],usage:{prompt_tokens:2000,completion_tokens:60,total_tokens:2060}});
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","x-request-id":"3e804716-db05-4b85-9e21-1720f0351ab9"}});
const create=(fetchImpl,extra={})=>createLiveTransport({manifest,authorization:approval(),fetchImpl,loadCredential:()=>"synthetic-credential-only",now:()=>NOW,...extra});
const flush=async()=>{for(let i=0;i<64;i++)await Promise.resolve();};

test("every corrected prompt preserves ingredients, quantities, identity and base authorization; methods/yields/exclusions are represented",()=>{
  assert.equal(baseline.digest,BASELINE_DIGEST);
  manifest.recipes.forEach((entry,i)=>{
    const old=baseline.recipes[i];
    assert.deepEqual(entry.recipe,old.recipe);
    assert.equal(entry.basePrompt,old.prompt);
    assert.equal(entry.previousPromptSha256,old.promptSha256);
    assert.equal(entry.previousVerificationSha256,old.verificationSha256);
    const corrected=correctComparisonPrompts(entry.recipe,old.prompt,old.verificationPrompt);
    assert.equal(entry.prompt,corrected.prompt);
    assert.equal(entry.verificationPrompt,corrected.verificationPrompt);
    assert.deepEqual(entry.changes,corrected.changes);
    for(const ingredient of entry.recipe.ingredients)assert.ok(entry.prompt.includes(ingredient));
    assert.ok(entry.prompt.includes(entry.recipe.method));
    assert.ok(entry.prompt.includes(entry.recipe.visibleRequirement));
    assert.ok(entry.prompt.includes(`Recipe yield: ${entry.recipe.servings} serving(s)`));
    assert.ok(entry.prompt.includes("ingredient list above is the only authority"));
    assert.ok(entry.verificationPrompt.includes("Do not infer exact grams"));
  });
  const salad=manifest.recipes.find(r=>r.recipe.id==="egg-free-cobb");
  assert.ok(salad.prompt.includes("vegetables stay fresh"));
  assert.ok(!salad.prompt.includes("Show a plated hot or warm dish"));
  assert.ok(!salad.prompt.includes("NOT uncooked components"));
});
for(const edit of [
  a=>a.kind="other",a=>a.context="production",a=>a.manifestSha256="old",
  a=>a.models.reverse(),a=>a.settings.quality="high",a=>a.limits.generationRequests=17,
  a=>a.acceptsNonGuaranteedBillingCap=false,a=>a.allowTemporaryPrivateArtifacts=false,
  a=>a.expiresAt=new Date(NOW-1).toISOString(),a=>a.expiresAt=new Date(NOW+3_600_001).toISOString(),
  a=>a.runId="../escape",a=>a.verifier=MODELS[0],
])test("mismatched/expired/broadened authorization cannot construct a transport",()=>{
  let calls=0;
  const a=approval();edit(a);
  assert.throws(()=>createLiveTransport({manifest,authorization:a,fetchImpl:()=>{calls++;},loadCredential:()=>{calls++;},now:()=>NOW}),/authorization required/);
  assert.equal(calls,0);
});
test("authorization is inert; credential is loaded only for validated dispatch and never returned",async()=>{
  let loaded=0,calls=0;
  const transport=create(async(url,init)=>{
    calls++;assert.equal(url,first.generation.url);
    assert.equal(init.redirect,"manual");
    assert.equal(init.headers.Authorization,"Bearer synthetic-secret");
    assert.deepEqual(JSON.parse(init.body),first.generation.body);
    return response(genBody());
  },{loadCredential:()=>{loaded++;return "synthetic-secret";}});
  assert.equal(loaded,0);
  const result=await transport("generation",first.generation,first,new AbortController().signal);
  assert.equal(loaded,1);assert.equal(calls,1);
  assert.ok(!JSON.stringify(result).includes("synthetic-secret"));
  assert.equal(result.requestId,"3e804716-db05-4b85-9e21-1720f0351ab9");
});
test("transport rejects foreign URLs, parameter drift, wrong candidate ordering and forged verifier prompt before credential access",async()=>{
  let calls=0;
  const transport=create(async()=>{calls++;return response(genBody());},{loadCredential:()=>{calls++;return "fixture";}});
  await assert.rejects(()=>transport("generation",{...first.generation,url:"https://example.invalid"},first,new AbortController().signal));
  await assert.rejects(()=>transport("generation",plan[1].generation,plan[1],new AbortController().signal));
  assert.equal(calls,0);
  await transport("generation",first.generation,first,new AbortController().signal);
  const forged={...first,verificationPrompt:"changed"};
  const request={method:"POST",url:"https://api.openai.com/v1/chat/completions",body:{model:VERIFIER,max_tokens:60,messages:[{role:"user",content:[{type:"text",text:"changed"},{type:"image_url",image_url:{url:`data:image/png;base64,${image}`,detail:"low"}}]}]}};
  await assert.rejects(()=>transport("verification",request,forged,new AbortController().signal),/mismatch/);
  assert.equal(calls,2);
});
test("mocked live engine runs exactly 16 generations and 16 verifications serially with accounting",async()=>{
  let count=0,active=0,max=0;
  const transport=create(async(url)=>{
    count++;active++;max=Math.max(max,active);await Promise.resolve();active--;
    return response(url.endsWith("generations")?genBody():verBody());
  });
  const engine=createComparisonEngine(manifest,{transport,mode:"MOCKED_ADAPTER_TEST"});
  const report=await engine.run();
  assert.equal(count,32);assert.equal(max,1);
  assert.equal(report.generationRequests,16);assert.equal(report.verificationRequests,16);
  assert.equal(report.reservedUSD,4);
  assert.equal(Math.round(report.estimatedKnownCostUSD*1e6),649600);
  assert.equal(report.stopReason,null);
  assert.ok(!("paidCalls" in report));
  await assert.rejects(()=>engine.run(),/already consumed/);
  await assert.rejects(()=>transport("generation",first.generation,first,new AbortController().signal));
  assert.equal(count,32);
});
for(const status of [400,403,429,500,302])test(`mocked HTTP ${status} stops without retry or redirect and retains reservation`,async()=>{
  let calls=0;
  const transport=create(async()=>{calls++;return response({message:"synthetic-private-error"},status);});
  const report=await createComparisonEngine(manifest,{transport}).run();
  assert.equal(calls,1);assert.equal(report.reservedUSD,0.25);
  assert.equal(report.accountingUncertain,true);assert.equal(report.verificationRequests,0);
  assert.ok(!JSON.stringify(report).includes("synthetic-private-error"));
  assert.equal(report.records[0].generation.httpStatus,status);
});
test("raw network errors and credentials cannot leak into reports",async()=>{
  const transport=create(async()=>{throw new Error("synthetic-secret in provider exception");});
  const report=await createComparisonEngine(manifest,{transport}).run();
  assert.equal(report.stopReason,"transport_uncertain");
  assert.ok(!JSON.stringify(report).includes("synthetic-secret"));
});
test("in-flight second dispatch is rejected before fetch",async()=>{
  let finish,calls=0;
  const transport=create(()=>{calls++;return new Promise(r=>{finish=r;});});
  const pending=transport("generation",first.generation,first,new AbortController().signal);
  await assert.rejects(()=>transport("generation",first.generation,first,new AbortController().signal),/busy/);
  assert.equal(calls,1);finish(response(genBody()));await pending;
});
test("wrong PNG dimensions or URL output preserve request evidence and stop without verification or artifacts",async()=>{
  for(const data of [[{url:"https://example.invalid/p.png"}],[{b64_json:"AAAA"}]]){
    let written=0;
    const transport=create(async()=>response({...genBody(),data}));
    const report=await createComparisonEngine(manifest,{transport,saveReview:()=>{written++;}}).run();
    assert.equal(report.stopReason,"invalid_png_response");assert.equal(written,0);
    assert.ok(report.records[0].generation.requestId);
  }
  const wrong=Buffer.from(png);wrong.writeUInt32BE(512,16);
  assert.throws(()=>validatePNG(wrong.toString("base64")),/1024/);
  const corrupt=Buffer.from(png);corrupt[corrupt.length-1]^=1;
  assert.throws(()=>validatePNG(corrupt.toString("base64")),/checksum/);
  assert.throws(()=>validatePNG(png.subarray(0,png.length-12).toString("base64")),/Incomplete/);
});
test("timeout requests abort, quarantines transport, retains cost uncertainty and ignores late response",async()=>{
  let complete,calls=0,abort=false,now=0,next=0;
  const timers=new Map();
  const clock={now:()=>now,set:(fn,ms)=>{timers.set(++next,{fn,at:now+ms});return next;},clear:id=>timers.delete(id)};
  const transport=create((url,init)=>{calls++;init.signal.addEventListener("abort",()=>{abort=true;});return new Promise(r=>{complete=r;});});
  let artifacts=0;
  const pending=createComparisonEngine(manifest,{transport,clock,saveReview:()=>{artifacts++;}}).run();
  await flush();now=150_001;for(const {fn,at} of [...timers.values()])if(at<=now)fn();
  await flush();const report=await pending,text=JSON.stringify(report);
  assert.equal(abort,true);assert.equal(report.stopReason,"timeout_uncertain");
  assert.equal(report.reservedUSD,0.25);assert.equal(report.generationRequests,1);
  assert.equal(report.records[0].generation.cancellation,"requested_unconfirmed");
  complete(response(genBody()));await flush();
  assert.equal(JSON.stringify(report),text);assert.equal(artifacts,0);assert.equal(calls,1);
  await assert.rejects(()=>transport("generation",first.generation,first,new AbortController().signal),/stopped/);
});
test("private review artifacts and one-shot approval markers are local, nonpublic, no-overwrite and replay-resistant",()=>{
  const root=mkdtempSync(join(tmpdir(),"comparison-private-"));
  try {
    const authDir=join(root,"authorizations");mkdirSync(authDir,{mode:0o700});
    const file=join(authDir,"approved-run.json");writePrivate(file,JSON.stringify(approval()));
    assert.equal(claimAuthorization(file,manifest,root,NOW).runId,"approved-test-run");
    assert.throws(()=>claimAuthorization(file,manifest,root,NOW),/EEXIST/);
    assert.ok(lstatSync(file+".consumed").isFile());
    const sink=createReviewSink(join(root,"private-runs"),"artifact-test-run");
    const name=sink.save(first,png);sink.report({mode:"MOCK",imageDigest:"fixture"});
    assert.ok(readdirSync(sink.directory).includes(name));
    assert.equal(lstatSync(sink.directory).mode&0o077,0);
    assert.equal(lstatSync(join(sink.directory,name)).mode&0o077,0);
    assert.throws(()=>sink.save(first,png),/EEXIST/);
    assert.throws(()=>createReviewSink(join(root,"private-runs"),"artifact-test-run"),/EEXIST/);
    const link=join(root,"linked");symlinkSync(sink.directory,link);
    assert.throws(()=>createReviewSink(link,"another-test"),/Unsafe/);
    const publicAuth=join(authDir,"public-test.json");writePrivate(publicAuth,JSON.stringify(approval()));chmodSync(publicAuth,0o644);
    assert.throws(()=>claimAuthorization(publicAuth,manifest,root,NOW),/Private/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test("ordinary CLI invocations, tests and import cannot load a credential or make a request",()=>{
  const path=new URL("./live-cli.mjs",import.meta.url).pathname;
  for(const env of [{},{IMAGE_COMPARISON_CONTEXT:"development",NODE_ENV:"test"},{IMAGE_COMPARISON_CONTEXT:"development",NODE_ENV:"production"}]){
    assert.throws(()=>execFileSync(process.execPath,[path,"--execute-explicitly-authorized-comparison","missing.json"],{env,stdio:"pipe"}),/Command failed/);
  }
  execFileSync(process.execPath,["--input-type=module","-e",`globalThis.fetch=()=>{throw new Error("forbidden");}; await import(${JSON.stringify(new URL("./live-cli.mjs",import.meta.url).href)});`],{env:{},stdio:"pipe"});
});
test("all live adapter dependencies remain isolated from application registry, persistence and SDK side effects",()=>{
  const allowed=new Set(["./contract.mjs","./recipes.mjs","./runner.mjs","./live-adapter.mjs","./authorization-store.mjs","./review-artifacts.mjs","node:fs","node:path","node:url","node:zlib"]);
  for(const file of ["live-adapter.mjs","live-cli.mjs","authorization-store.mjs","review-artifacts.mjs"]){
    const text=readFileSync(new URL(file,import.meta.url),"utf8");
    for(const [,dependency] of text.matchAll(/from\s+["']([^"']+)["']/g))assert.ok(allowed.has(dependency),dependency);
    assert.ok(!/from\s+["'][^"']*(?:server|storage|registry|openai)/i.test(text));
  }
});
