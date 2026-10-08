import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import { createDemoDataBoundary } from "../middleware/demoDataBoundary";
import { createDemoProfessionalService, type DemoRepository, type DemoTransaction } from "../services/demoProfessionalService";
import { identitySnapshotHash, type IdentityAccountSnapshot } from "../services/professionalIdentityDecisionService";
import { DEMO_CAPABILITIES, DEMO_ACKNOWLEDGMENT_VERSION, demoGrantPreparationInput, demoPlanInput, isDemoGrantCurrent, type DemoGrant, type DemoPatient } from "@shared/demoProfessional";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as founder } from "../config/developmentFounderPhysicianDemo";
import { normalizeDemoGrantRecord } from "../services/demoGrantRecord";

const now = new Date("2026-10-07T18:00:00.000Z");
function fixture(targetId = "demo-actor") {
  const target: IdentityAccountSnapshot = { id:targetId, professionalRole:"physician", authSecurityVersion:7,
    professionalCategory:"non_certified", credentialBody:null, credentialNumber:null, credentialType:null, credentialYear:null,
    isProCare:false, organizationId:"preserved-clinic-org", isAdmin:false, mfaEnabled:true };
  let state = {
    accounts:[{...target,id:"reviewer",isAdmin:true},target],
    grant:{id:"37e010aa-c441-4881-bf2a-3f402654cd01",userId:target.id,workspaceId:"37e010aa-c441-4881-bf2a-3f402654cd10",
      persona:"physician",operatingStatus:"demo_only",state:"active",revision:2,capabilities:[...DEMO_CAPABILITIES],
      expiresAt:"2026-10-08T18:00:00.000Z",approverId:"reviewer",reason:"Synthetic demonstration only.",
      trainingBasis:"demo_only_waiver",trainingWaiverReason:"Demo waiver; no Academy completion.",acknowledgedAt:now.toISOString(),
      acknowledgmentVersion:DEMO_ACKNOWLEDGMENT_VERSION,identityRequestId:"37e010aa-c441-4881-bf2a-3f402654cd12"} as DemoGrant | null,
    workspace:{id:"37e010aa-c441-4881-bf2a-3f402654cd10",label:"Synthetic workspace",classification:"synthetic" as "synthetic"|"live"|null},
    patient:{id:"37e010aa-c441-4881-bf2a-3f402654cd11",workspaceId:"37e010aa-c441-4881-bf2a-3f402654cd10",classification:"synthetic",
      label:"Synthetic Patient 001",scenario:"Fictional diabetes follow-up",revision:1,
      glucose:[{id:"reading",value:118,unit:"mg/dL",context:"FASTED",recordedAt:now.toISOString()}],
      messages:[{id:"message",author:"Synthetic patient",text:"Demo message"}],
      media:[{id:"37e010aa-c441-4881-bf2a-3f402654cd15",name:"synthetic.txt",contentType:"text/plain",content:"SYNTHETIC ONLY"}],plan:null} as DemoPatient,
    events:[] as unknown[], academy:false, approved:true, failEvent:false, clinicOwned:true,
    independent:{credentials:"unchanged",verification:"unverified",academy:[],agreements:[],billing:"unchanged",ownership:["clinic"],memberships:["org"],relationships:["preserved"],history:["business"]},
  };
  let tail = Promise.resolve();
  const repo: DemoRepository = { async transaction(work) {
    const previous = tail; let unlock!:()=>void; tail=new Promise<void>(resolve=>{unlock=resolve;}); await previous;
    const before=JSON.parse(JSON.stringify(state));
    const tx: DemoTransaction = {
      accounts:async ids=>state.accounts.filter(row=>ids.includes(row.id)), grant:async id=>state.grant?.userId===id?state.grant:null,
      workspace:async id=>state.workspace.id===id?state.workspace:null, patients:async()=>[state.patient],
      patient:async (workspaceId,id)=>state.patient.id===id&&state.patient.workspaceId===workspaceId?state.patient:null,
      academyComplete:async()=>state.academy, approvedIdentityRequest:async()=>state.approved,
      ownedClinic:async(userId,clinicId)=>state.clinicOwned && userId===founder.userId && clinicId===founder.clinicId
        ? {id:clinicId,name:"Existing fixture Clinic",type:"clinic",syntheticOnly:true}:null,
      createDataset:async(workspace,patient)=>{state.workspace=workspace;state.patient=patient;},
      saveGrant:async grant=>{state.grant={...grant};}, savePlan:async(record,plan)=>(state.patient={...record,plan,revision:record.revision+1}),
      saveInvitation:async(record,connectionInvitation)=>(state.patient={...record,connectionInvitation,revision:record.revision+1}),
      invalidateSessions:async account=>{state.accounts.find(row=>row.id===account.id)!.authSecurityVersion++;},
      event:async(grant,actor,kind,metadata)=>{if(state.failEvent)throw new Error("event failure");state.events.push({grantId:grant.id,actor,kind,metadata});},
    };
    try {return await work(tx);}catch(error){state=before;throw error;}finally{unlock();}
  }};
  const service=createDemoProfessionalService(repo,()=>now);
  const proof={id:"reviewer",securityVersion:7,mfaVerified:true as const};
  const preparation=()=>({targetUserId:target.id,reviewedStateHash:identitySnapshotHash(state.accounts[1]),
    reason:"Prepare isolated demonstration only.",expiresAt:"2026-10-08T18:00:00.000Z",capabilities:[...DEMO_CAPABILITIES],
    demoTrainingWaiverReason:"Explicit synthetic-only training waiver.",identityOnlyAcknowledged:true as const,sharedDataAcknowledged:true as const});
  return {state:()=>state,service,proof,preparation};
}
describe("Stage 3 isolated demo authorization — no shared accounts",()=>{
  test.each(["code","token"] as const)("authorized demo → synthetic client accepts by %s and persists an isolated connection", async kind => {
    const f=fixture(), s=f.state();
    const invitation=await f.service.invite("demo-actor",s.workspace.id,s.patient.id);
    const key=kind==="code"?invitation.code:invitation.token;
    const result=await f.service.acceptInvitation("demo-actor",s.workspace.id,s.patient.id,key);
    expect(result).toMatchObject({providerUserId:"demo-actor",clientUserId:s.patient.id,workspaceId:s.workspace.id,state:"accepted",classification:"synthetic"});
    const revision=f.state().patient.revision;
    expect(await f.service.acceptInvitation("demo-actor",s.workspace.id,s.patient.id,key)).toEqual(result);
    expect(f.state().patient.revision).toBe(revision);
    expect(await f.service.invitation("demo-actor",s.workspace.id,s.patient.id)).toEqual(result);
    expect(f.state().events).toEqual([]);
    expect(f.state().grant).toEqual(s.grant);
  });
  test("live → synthetic and demo → live invitation attempts are denied", async()=>{
    const f=fixture(),s=f.state();
    await expect(f.service.invite("live-actor",s.workspace.id,s.patient.id)).rejects.toMatchObject({code:"DEMO_AUTHORITY_REQUIRED"});
    await expect(f.service.invite("demo-actor",s.workspace.id,"live-client")).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
    expect(f.state().patient.connectionInvitation).toBeUndefined();
  });
  test("wrong synthetic recipient/workspace and wrong invitation key cannot connect", async()=>{
    const f=fixture(),s=f.state();
    await f.service.invite("demo-actor",s.workspace.id,s.patient.id);
    await expect(f.service.acceptInvitation("demo-actor",s.workspace.id,"wrong-patient","wrong")).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
    await expect(f.service.acceptInvitation("demo-actor","wrong-workspace",s.patient.id,"wrong")).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
    await expect(f.service.acceptInvitation("demo-actor",s.workspace.id,s.patient.id,"wrong")).rejects.toMatchObject({code:"DEMO_INVITATION_NOT_FOUND"});
    expect(f.state().patient.connectionInvitation!.state).toBe("pending");
  });
  test.each(["expired","revoked"] as const)("an %s synthetic invitation is not reusable", async kind=>{
    const f=fixture(),s=f.state();
    const invitation=await f.service.invite("demo-actor",s.workspace.id,s.patient.id);
    if(kind==="expired")f.state().patient.connectionInvitation!.expiresAt="2000-01-01T00:00:00.000Z";
    else f.state().patient.connectionInvitation!.revokedAt=now.toISOString();
    await expect(f.service.acceptInvitation("demo-actor",s.workspace.id,s.patient.id,invitation.code)).rejects.toMatchObject({code:kind==="expired"?"EXPIRED":"REVOKED"});
    expect(f.state().patient.connectionInvitation!.state).toBe("pending");
  });
  test("grant revocation blocks an already issued synthetic code without changing live authority",async()=>{
    const f=fixture(),s=f.state();
    const invitation=await f.service.invite("demo-actor",s.workspace.id,s.patient.id);
    f.state().grant!.state="revoked";
    await expect(f.service.acceptInvitation("demo-actor",s.workspace.id,s.patient.id,invitation.code)).rejects.toMatchObject({code:"DEMO_GRANT_INACTIVE"});
    expect(f.state().independent).toEqual(s.independent);
  });
  test("explicit active physician grant reads synthetic patient/glucose and truthful readiness",async()=>{
    const f=fixture(),s=f.state();
    const context=await f.service.context("demo-actor");
    expect(context).toMatchObject({operatingStatus:"demo_only",persona:"physician",realClinicalReadiness:false,credentialVerificationGranted:false,academyCompletionGranted:false,realAgreementsGranted:false,paidSubscriptionGranted:false});
    expect(await f.service.list("demo-actor",s.workspace.id)).toHaveLength(1);
    expect(await f.service.read("demo-actor",s.workspace.id,s.patient.id)).toMatchObject({classification:"synthetic",glucose:[{value:118}]});
  });
  test.each(["read","messages","mediaList","export"] as const)("%s rejects substituted real patient ID",async method=>{
    const f=fixture();await expect(f.service[method]("demo-actor",f.state().workspace.id,"real-patient")).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
  });
  test("writes cannot use a substituted real patient ID",async()=>{
    const f=fixture();await expect(f.service.savePlan("demo-actor",f.state().workspace.id,"real-patient",{nutritionFocus:"balanced_meals",followupDays:7})).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
  });
  test.each(["read","messages","mediaList","export"] as const)("%s rejects cross-workspace access",async method=>{
    const f=fixture();await expect(f.service[method]("demo-actor","another-demo-workspace",f.state().patient.id)).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
  });
  test.each([null,"live"] as const)("unclassified/live workspace %s is denied",async classification=>{
    const f=fixture();f.state().workspace.classification=classification;
    await expect(f.service.context("demo-actor")).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
  });
  test.each([null,"live"] as const)("unclassified/live patient %s is not listed/read/written/exported",async classification=>{
    const f=fixture();f.state().patient.classification=classification;const s=f.state();
    expect(await f.service.list("demo-actor",s.workspace.id)).toEqual([]);
    for(const method of ["read","messages","mediaList","export"] as const)await expect(f.service[method]("demo-actor",s.workspace.id,s.patient.id)).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
    await expect(f.service.savePlan("demo-actor",s.workspace.id,s.patient.id,{nutritionFocus:"balanced_meals",followupDays:7})).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
  });
  test.each(["prepared","revoked"] as const)("%s grant cannot access data or acknowledgment",async grantState=>{
    const f=fixture();f.state().grant!.state=grantState;await expect(f.service.read("demo-actor",f.state().workspace.id,f.state().patient.id)).rejects.toMatchObject({code:"DEMO_GRANT_INACTIVE"});
    await expect(f.service.acknowledge("demo-actor")).rejects.toMatchObject({code:"DEMO_GRANT_INACTIVE"});
  });
  test("expired and malformed expiry are denied",async()=>{
    const f=fixture();for(const expiry of [now.toISOString(),"invalid"]){f.state().grant!.expiresAt=expiry;await expect(f.service.context("demo-actor")).rejects.toMatchObject({code:"DEMO_GRANT_EXPIRED"});}
  });
  test("ordinary physician/founder/owner without grant cannot get synthetic authority",async()=>{
    const f=fixture();f.state().grant=null;await expect(f.service.context("demo-actor")).rejects.toMatchObject({code:"DEMO_AUTHORITY_REQUIRED"});
  });
  test("grant persona does not substitute for canonical account physician identity",async()=>{
    const f=fixture();f.state().accounts[1].professionalRole="business";await expect(f.service.context("demo-actor")).rejects.toMatchObject({code:"DEMO_AUTHORITY_REQUIRED"});
  });
  test.each(["clinical.read","clinical.write","messages.read","media.read","export"] as const)("explicit %s capability is required",async capability=>{
    const f=fixture();f.state().grant!.capabilities=f.state().grant!.capabilities.filter(value=>value!==capability);const s=f.state();
    const work=capability==="clinical.read"?f.service.read("demo-actor",s.workspace.id,s.patient.id):
      capability==="clinical.write"?f.service.savePlan("demo-actor",s.workspace.id,s.patient.id,{nutritionFocus:"balanced_meals",followupDays:7}):
      capability==="messages.read"?f.service.messages("demo-actor",s.workspace.id,s.patient.id):
      capability==="media.read"?f.service.mediaList("demo-actor",s.workspace.id,s.patient.id):f.service.export("demo-actor",s.workspace.id,s.patient.id);
    await expect(work).rejects.toMatchObject({code:"DEMO_CAPABILITY_DENIED"});
  });
  test("real media ID and real file path never resolve in demo",async()=>{
    const f=fixture(),s=f.state();for(const id of ["real-file","/objects/private-patient-file"])await expect(f.service.media("demo-actor",s.workspace.id,s.patient.id,id)).rejects.toMatchObject({code:"DEMO_DATA_SCOPE_DENIED"});
    expect((await f.service.media("demo-actor",s.workspace.id,s.patient.id,s.patient.media[0].id)).content).toBe("SYNTHETIC ONLY");
  });
  test("genuine demo acknowledgment is separate from real agreements",async()=>{
    const f=fixture();f.state().grant!.acknowledgedAt=null;const before=JSON.stringify(f.state().independent);
    await expect(f.service.list("demo-actor",f.state().workspace.id)).rejects.toMatchObject({code:"DEMO_ACKNOWLEDGMENT_REQUIRED"});
    await f.service.acknowledge("demo-actor");expect(JSON.stringify(f.state().independent)).toBe(before);
  });
  test("synthetic plan save and export affect only synthetic data and audit",async()=>{
    const f=fixture(),s=f.state(),before=JSON.stringify(s.independent);
    await f.service.savePlan("demo-actor",s.workspace.id,s.patient.id,{nutritionFocus:"carb_awareness",followupDays:7});
    expect(await f.service.export("demo-actor",s.workspace.id,s.patient.id)).toMatchObject({classification:"synthetic",patient:{plan:{followupDays:7}}});
    expect(JSON.stringify(f.state().independent)).toBe(before);
  });
  test("failed audit rolls back clinical plan",async()=>{
    const f=fixture();f.state().failEvent=true;const before=JSON.stringify(f.state());
    await expect(f.service.savePlan("demo-actor",f.state().workspace.id,f.state().patient.id,{nutritionFocus:"balanced_meals",followupDays:7})).rejects.toThrow("event failure");
    expect(JSON.stringify(f.state())).toBe(before);
  });
  test("MFA admin preparation restricts first, preserves business identity/Clinic/history and independent authority",async()=>{
    const f=fixture();f.state().grant=null;f.state().accounts[1].professionalRole="business";const before=JSON.stringify(f.state().independent);
    const grant=await f.service.prepare(f.proof,f.preparation());
    expect(grant).toMatchObject({state:"prepared",operatingStatus:"demo_only",persona:"physician",trainingBasis:"demo_only_waiver"});
    expect(f.state().accounts[1]).toMatchObject({professionalRole:"business",authSecurityVersion:8,credentialNumber:null,isProCare:false,organizationId:"preserved-clinic-org"});
    expect(JSON.stringify(f.state().independent)).toBe(before);
  });
  test.each(["admin","mfa","version"] as const)("preparation requires current reviewer %s",async condition=>{
    const f=fixture();f.state().grant=null;
    if(condition==="admin")f.state().accounts[0].isAdmin=false;
    if(condition==="mfa")f.state().accounts[0].mfaEnabled=false;
    if(condition==="version")f.proof.securityVersion--;
    await expect(f.service.prepare(f.proof,f.preparation())).rejects.toMatchObject({code:"DEMO_REVIEWER_REQUIRED"});
  });
  test("self-grant is forbidden",async()=>{
    const f=fixture();await expect(f.service.prepare(f.proof,{...f.preparation(),targetUserId:"reviewer"})).rejects.toMatchObject({code:"DEMO_SELF_GRANT_FORBIDDEN"});
  });
  test("training must be genuine evidence or explicit demo waiver, never manufactured completion",async()=>{
    const f=fixture();f.state().grant=null;const input=f.preparation();delete (input as any).demoTrainingWaiverReason;
    await expect(f.service.prepare(f.proof,input)).rejects.toMatchObject({code:"DEMO_TRAINING_BASIS_REQUIRED"});
    f.state().academy=true;expect((await f.service.prepare(f.proof,input)).trainingBasis).toBe("academy_evidence");
    expect(f.state().independent.academy).toEqual([]);
  });
  test("failed audit rolls back dataset/grant/security transition",async()=>{
    const f=fixture();f.state().grant=null;f.state().failEvent=true;const before=JSON.stringify(f.state());
    await expect(f.service.prepare(f.proof,f.preparation())).rejects.toThrow("event failure");expect(JSON.stringify(f.state())).toBe(before);
  });
  test("activation requires approved Stage 2 identity evidence and expected hash/revision",async()=>{
    const f=fixture();f.state().grant!.state="prepared";const s=f.state();
    const input={revision:s.grant!.revision,identityRequestId:s.grant!.identityRequestId!,reviewedStateHash:identitySnapshotHash(s.accounts[1]),reason:"Activate synthetic demo.",identityOnlyAcknowledged:true as const,sharedDataAcknowledged:true as const};
    s.approved=false;await expect(f.service.activate(f.proof,"demo-actor",input)).rejects.toMatchObject({code:"DEMO_CONTROLLED_IDENTITY_REQUIRED"});
    f.state().approved=true;const activated=await f.service.activate(f.proof,"demo-actor",input);
    expect(activated.state).toBe("active");expect(f.state().accounts[1].authSecurityVersion).toBe(8);
    await expect(f.service.activate(f.proof,"demo-actor",input)).rejects.toMatchObject({status:409});
  });
  test("revocation immediately blocks subsequent requests while retaining demo-only restriction",async()=>{
    const f=fixture();await f.service.context("demo-actor");
    await f.service.revoke(f.proof,"demo-actor",f.state().grant!.revision,"Revoke demonstration access.");
    expect(f.state().grant).toMatchObject({state:"revoked",operatingStatus:"demo_only"});
    await expect(f.service.context("demo-actor")).rejects.toMatchObject({code:"DEMO_GRANT_INACTIVE"});
  });
  test("client flags/free-form patient data cannot define authority or clinical writes",()=>{
    const f=fixture();expect(demoGrantPreparationInput.safeParse({...f.preparation(),demo:true,verified:true}).success).toBe(false);
    expect(demoPlanInput.safeParse({nutritionFocus:"balanced_meals",followupDays:7,userId:"real-patient",notes:"real clinical data"}).success).toBe(false);
  });
});

describe("Permanent founder grant — fixture-only, no shared activation", () => {
  function permanentFixture(targetId = founder.userId) {
    const f = fixture(targetId);
    f.state().grant = null;
    const input = { ...f.preparation(), expiresAt: null, lifetime: "permanent_founder" as const,
      founderAuthorizationAcknowledged: true as const };
    return { ...f, input };
  }
  test("MFA admin authorizes the exact existing Clinic with an audited demo-only waiver", async () => {
    const f = permanentFixture(), before = JSON.stringify(f.state().independent);
    f.state().academy = true; // Real education evidence is neither required nor fabricated.
    const grant = await f.service.prepare(f.proof, f.input);
    expect(grant).toMatchObject({ authority:"founder_admin", lifetime:"permanent_founder", expiresAt:null,
      clinicId:founder.clinicId, state:"prepared", trainingBasis:"demo_only_waiver" });
    expect(f.state().events).toEqual([expect.objectContaining({ kind:"demo_prepared", actor:"reviewer",
      metadata:expect.objectContaining({ founderAuthorizationAcknowledged:true, authority:"founder_admin",
        lifetime:"permanent_founder", clinicId:founder.clinicId, reviewerAuthority:"authenticated_admin_with_current_mfa" }) })]);
    expect(JSON.stringify(f.state().independent)).toBe(before);
  });
  test.each(["wrong-target","missing-consent","missing-waiver","lost-clinic","stale-mfa","no-mfa","non-admin"])("permanent grant rejects %s atomically", async condition => {
    const f = permanentFixture(condition==="wrong-target" ? "other-physician" : founder.userId);
    if(condition==="missing-consent") delete (f.input as any).founderAuthorizationAcknowledged;
    if(condition==="missing-waiver") delete (f.input as any).demoTrainingWaiverReason;
    if(condition==="lost-clinic") f.state().clinicOwned=false;
    if(condition==="stale-mfa") f.proof.securityVersion--;
    if(condition==="no-mfa") f.state().accounts[0].mfaEnabled=false;
    if(condition==="non-admin") f.state().accounts[0].isAdmin=false;
    const before=JSON.stringify(f.state());
    await expect(f.service.prepare(f.proof,f.input)).rejects.toMatchObject({status:403});
    expect(JSON.stringify(f.state())).toBe(before);
  });
  test("ordinary NULL and over-30-day grants stay invalid; founder consent is explicit", async () => {
    const f=fixture(); f.state().grant=null;
    for (const expiresAt of [null,"2026-12-07T18:00:00.000Z"]) {
      await expect(f.service.prepare(f.proof,{...f.preparation(),expiresAt})).rejects.toMatchObject({code:"DEMO_EXPIRY_INVALID"});
    }
    expect(demoGrantPreparationInput.safeParse({...permanentFixture().input,founderAuthorizationAcknowledged:undefined}).success).toBe(false);
    expect(demoGrantPreparationInput.safeParse(permanentFixture().input).success).toBe(true);
    expect(demoGrantPreparationInput.safeParse({...f.preparation(),expiresAt:null}).success).toBe(false);
  });
  test("failed permanent approval audit rolls back all fixture changes", async () => {
    const f=permanentFixture(); f.state().failEvent=true; const before=JSON.stringify(f.state());
    await expect(f.service.prepare(f.proof,f.input)).rejects.toThrow("event failure");
    expect(JSON.stringify(f.state())).toBe(before);
  });
  test("non-expiring grant remains synthetic, reopens, invites, and revokes without real completions", async () => {
    const f=permanentFixture(); const grant=await f.service.prepare(f.proof,f.input);
    const input={revision:grant.revision,identityRequestId:"37e010aa-c441-4881-bf2a-3f402654cd12",
      reviewedStateHash:identitySnapshotHash(f.state().accounts[1]),reason:"Activate fixture-only founder demonstration.",
      identityOnlyAcknowledged:true as const,sharedDataAcknowledged:true as const};
    await f.service.activate(f.proof,founder.userId,input);
    expect(await f.service.context(founder.userId)).toMatchObject({clinic:{id:founder.clinicId},
      realClinicalReadiness:false,credentialVerificationGranted:false,academyCompletionGranted:false,
      realAgreementsGranted:false,paidSubscriptionGranted:false});
    await f.service.acknowledge(founder.userId);
    const s=f.state(), patient=s.patient;
    const invitation=await f.service.invite(founder.userId,s.workspace.id,patient.id);
    expect(Date.parse(invitation.expiresAt)-now.getTime()).toBe(14*86400000);
    await f.service.acceptInvitation(founder.userId,s.workspace.id,patient.id,invitation.code);
    expect(isDemoGrantCurrent(s.grant!,new Date("2040-01-01").getTime())).toBe(true);
    expect(s.independent.academy).toEqual([]); expect(s.independent.billing).toBe("unchanged");
    await f.service.revoke(f.proof,founder.userId,s.grant!.revision,"Revoke fixture founder authority.");
    await expect(f.service.context(founder.userId)).rejects.toMatchObject({code:"DEMO_GRANT_INACTIVE"});
  });
  test("prepared founder grant does not bypass controlled identity approval or active Clinic ownership", async () => {
    const f=permanentFixture(); const grant=await f.service.prepare(f.proof,f.input);
    f.state().accounts[1].professionalRole="business";
    const input={revision:grant.revision,identityRequestId:"37e010aa-c441-4881-bf2a-3f402654cd12",
      reviewedStateHash:identitySnapshotHash(f.state().accounts[1]),reason:"Fixture identity transition.",
      identityOnlyAcknowledged:true as const,sharedDataAcknowledged:true as const};
    await expect(f.service.activate(f.proof,founder.userId,input)).rejects.toMatchObject({code:"DEMO_CONTROLLED_IDENTITY_REQUIRED"});
    f.state().accounts[1].professionalRole="physician"; f.state().clinicOwned=false;
    input.reviewedStateHash=identitySnapshotHash(f.state().accounts[1]);
    await expect(f.service.activate(f.proof,founder.userId,input)).rejects.toMatchObject({code:"DEMO_CLINIC_OWNERSHIP_REQUIRED"});
  });
  test("NULL expiry and client-shaped permanent markers cannot manufacture persisted authority", () => {
    const row={...fixture().state().grant!,userId:founder.userId,expiresAt:null,
      authority:"founder_admin" as const,lifetime:"permanent_founder" as const,clinicId:founder.clinicId};
    expect(isDemoGrantCurrent(normalizeDemoGrantRecord(row)!)).toBe(false);
    const audit={authority:"founder_admin",lifetime:"permanent_founder",clinicId:founder.clinicId,
      founderAuthorizationAcknowledged:true,reviewerAuthority:"authenticated_admin_with_current_mfa",
      reviewerSecurityVersion:7,grantRevision:1};
    expect(isDemoGrantCurrent(normalizeDemoGrantRecord({...row,authorization:audit})!)).toBe(true);
    for (const authorization of [{...audit,founderAuthorizationAcknowledged:false},{...audit,clinicId:"wrong-clinic"},
      {...audit,reviewerSecurityVersion:null},{...audit,reviewerAuthority:"client_claim"}]) {
      expect(isDemoGrantCurrent(normalizeDemoGrantRecord({...row,authorization})!)).toBe(false);
    }
    expect(isDemoGrantCurrent(normalizeDemoGrantRecord({...row,userId:"other-physician",authorization:audit})!)).toBe(false);
  });
});

describe("Stage 3 global live-data fence",()=>{
  const livePaths=[
    "/api/procare/clients/real-patient","/api/care-team","/api/physician/clients/real-patient",
    "/api/clinical/records/real","/api/glucose-logs/real","/api/biometrics/labs",
    "/api/studios/real/messages","/api/messages/real","/api/media/real","/api/users/real/profile",
    "/api/exports/real","/api/patients/search","/api/admin/users","/api/business",
    "/api/studio-private-token?demo=true","/api/unknown-data-route?userId=real",
    "/objects/private-file","/public-objects/private-file","/uploads/private-file","/API/GLUCOSE-LOGS/real",
  ];
  function app(f=fixture(), ordinary=false) {
    const result=express();result.use(express.json());
    result.use(createDemoDataBoundary({actor:async()=>({id:"demo-actor",username:"Demo",email:"synthetic.invalid",role:"client",professionalRole:"physician",isProCare:false,planLookupKey:null}),
      restriction:async()=>ordinary?null:f.state().grant}));
    result.use((_req,res)=>res.json({handlerExecuted:true}));return result;
  }
  test.each(livePaths)("demo actor cannot read/write/export/search live data: %s",async path=>{
    for(const method of ["get","post","put","delete"] as const){
      const res=await request(app())[method](path).send({demo:true,userId:"real"});
      expect(res.status).toBe(403);expect(res.body.code).toBe("DEMO_LIVE_DATA_DENIED");expect(res.body.handlerExecuted).toBeUndefined();
    }
  });
  test.each(["prepared","revoked"] as const)("%s status remains restrictive, not live fallback",async state=>{
    const f=fixture();f.state().grant!.state=state;expect((await request(app(f)).get("/api/patients/search")).status).toBe(403);
  });
  test("expired grant still denies live data",async()=>{
    const f=fixture();f.state().grant!.expiresAt="2020-01-01";expect((await request(app(f)).get("/api/messages/real")).status).toBe(403);
  });
  test("ordinary actors are unchanged; demo=true does not supply a grant",async()=>{
    expect((await request(app(fixture(),true)).get("/api/patients/search?demo=true")).body.handlerExecuted).toBe(true);
  });
  test("own bootstrap profile is a minimal server projection, not live health/credential data",async()=>{
    const response=await request(app()).get("/api/user/profile");expect(response.body).toMatchObject({operatingStatus:"demo_only",id:"demo-actor"});
    for(const key of ["medicalConditions","glucose","credentialNumber","studioMembership","attestationText"])expect(response.body[key]).toBeUndefined();
  });
  test("only bounded demo endpoints pass, and arbitrary demo prefix does not exempt live routes",async()=>{
    expect((await request(app()).get("/api/demo-professional/context")).body.handlerExecuted).toBe(true);
    expect((await request(app()).get("/api/demo-professional/real-patient-search")).status).toBe(403);
  });
  test("scope-storage errors fail closed, not next()",async()=>{
    const result=express();result.use(createDemoDataBoundary({actor:async()=>{throw new Error("DB failure");},restriction:async()=>null}));
    result.use((_req,res)=>res.json({handlerExecuted:true}));expect((await request(result).get("/api/messages")).status).toBe(503);
  });
  test("authentication/logout remains usable even when scope storage is down",async()=>{
    const result=express();result.use(createDemoDataBoundary({actor:async()=>{throw new Error("DB failure");},restriction:async()=>null}));
    result.use((_req,res)=>res.json({handlerExecuted:true}));expect((await request(result).post("/api/auth/logout")).body.handlerExecuted).toBe(true);
  });
  test("obsolete credentials cannot fall through as anonymous or return own profile",async()=>{
    const result=express();result.use(createDemoDataBoundary({actor:async()=>{throw {code:"AUTH_REAUTHENTICATION_REQUIRED"};},restriction:async()=>null}));
    result.use((_req,res)=>res.json({handlerExecuted:true}));
    for(const path of ["/api/user/profile","/api/messages/real","/objects/private-file"]){
      const response=await request(result).get(path);expect(response.status).toBe(401);expect(response.body.handlerExecuted).toBeUndefined();
    }
  });
  test("new-table migration is bounded and never writes existing identity/clinical tables",()=>{
    const source=readFileSync("server/db/migrations/runDemoProfessionalMigration.ts","utf8");
    expect(source).toContain("SET LOCAL lock_timeout");
    expect(source).toContain("SET LOCAL statement_timeout");
    expect(source).not.toMatch(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:users|studios|organizations|care_team|glucose_logs|professional_identity_requests)\b/i);
    expect(source).toContain("preserve_demo_professional_history");
    expect(source).toContain("classification='synthetic'");
  });
  test("demo client shell never mounts consumer trial or live-client chrome",()=>{
    const source=readFileSync("client/src/App.tsx","utf8");
    const shell=source.split("function DemoOperatingShell")[1].split("function ")[0];
    expect(shell).toContain('user?.operatingStatus !== "demo_only"');
    expect(shell).not.toContain("<TrialMilestoneModal");
    expect(shell).not.toContain("<ProClientProvider");
    expect(source.indexOf("<DemoOperatingShell>")).toBeLessThan(source.indexOf("<TrialMilestoneModal"));
  });
  test("both runtime fences precede all session/data route registration; writes remain locked",()=>{
    for(const path of ["server/index.ts","server/prod.ts"]){
      const source=readFileSync(path,"utf8");expect(source.indexOf("app.use(demoDataBoundary)")).toBeGreaterThan(source.indexOf("app.use(session("));
      expect(source.indexOf("app.use(demoDataBoundary)")).toBeLessThan(source.indexOf("await registerRoutes(app)"));
    }
    const routes=readFileSync("server/routes/demoProfessionalRoutes.ts","utf8");
    expect(routes.indexOf("DEMO_ACCOUNT_TRANSITION_NOT_APPROVED")).toBeLessThan(routes.indexOf('demoProfessionalAdminRouter.post("/prepare"'));
  });
});
