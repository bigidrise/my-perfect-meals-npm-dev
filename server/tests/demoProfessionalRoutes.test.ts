import express from "express";
import request from "supertest";
import { DEMO_ACKNOWLEDGMENT_VERSION, DEMO_CAPABILITIES, type DemoGrant, type DemoPatient } from "@shared/demoProfessional";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as founder } from "../config/developmentFounderPhysicianDemo";
import { createDemoDataBoundary } from "../middleware/demoDataBoundary";
let mockGrant: DemoGrant | null = null;
let mockPatient: DemoPatient | null = null;
let mockAuthenticated = true;
function mockTransaction(work:any) {
  return work({
    accounts:async(ids:string[])=>ids.includes(founder.userId)
      ? [{id:founder.userId,professionalRole:"physician",isAdmin:false,mfaEnabled:false,authSecurityVersion:1}]
      : [{id:"synthetic-actor",professionalRole:"physician"}],
    grant:async(id:string)=>mockGrant?.userId===id?mockGrant:null,
    workspace:async(id:string)=>mockGrant?.workspaceId===id?{id,label:"Synthetic fixture workspace",classification:"synthetic"}:null,
    ownedClinic:async()=>({id:founder.clinicId,name:"Existing fixture Clinic",type:"clinic",syntheticOnly:true}),
    patients:async()=>mockPatient?[mockPatient]:[],
    patient:async(workspaceId:string,id:string)=>mockPatient?.workspaceId===workspaceId&&mockPatient.id===id?mockPatient:null,
    saveGrant:async(grant:DemoGrant)=>{mockGrant=grant;},
    saveInvitation:async(patient:DemoPatient,connectionInvitation:DemoPatient["connectionInvitation"])=>{
      mockPatient={...patient,connectionInvitation,revision:patient.revision+1};return mockPatient;
    },
    savePlan:async(patient:DemoPatient,plan:DemoPatient["plan"])=>{
      mockPatient={...patient,plan,revision:patient.revision+1};return mockPatient;
    },
    event:async()=>{},
  });
}
jest.mock("../middleware/requireAuth",()=>({requireAuth:(req:any,res:any,next:any)=>{
  if(!mockAuthenticated)return res.status(401).json({code:"AUTH_REQUIRED"});
  req.authUser={id:req.headers["x-fixture-user"]??"synthetic-actor"};next();
}}));
jest.mock("../middleware/requireProfessionalIdentityReviewer",()=>({requireProfessionalIdentityReviewer:(req:any,_res:any,next:any)=>{req.identityReviewer={id:"synthetic-reviewer",securityVersion:1,mfaVerified:true};next();}}));
jest.mock("../services/demoProfessionalRepository",()=>({
  demoProfessionalRepository:{transaction:(work:any)=>mockTransaction(work)},
  demoRepositoryForActor:async()=>({transaction:(work:any)=>mockTransaction(work)}),
  readDemoRestriction:async()=>mockGrant,readDemoGrantHistory:async()=>[],
}));
import {demoProfessionalRouter,demoProfessionalAdminRouter} from "../routes/demoProfessionalRoutes";
describe("Stage 3 HTTP release/authority gates",()=>{
  const previous=process.env.NODE_ENV;beforeAll(()=>{process.env.NODE_ENV="development";});afterAll(()=>{process.env.NODE_ENV=previous;});
  const app=express();app.use(express.json());app.use("/api/demo-professional",demoProfessionalRouter);app.use("/api/admin/demo-professional",demoProfessionalAdminRouter);
  test.each(["/prepare","/accounts/synthetic-actor/activate"])("actual account activation remains locked even for MFA admin: %s",async path=>{
    const response=await request(app).post("/api/admin/demo-professional"+path).send({demo:true,approved:true});
    expect(response.status).toBe(423);expect(response.body.code).toBe("DEMO_ACCOUNT_TRANSITION_NOT_APPROVED");
  });
  test("canonical physician with no explicit grant gets no demo authority",async()=>{
    const response=await request(app).get("/api/demo-professional/context");expect(response.status).toBe(403);expect(response.body.code).toBe("DEMO_AUTHORITY_REQUIRED");
  });
  test.each(["demo=true","userId=real-patient","workspaceId=another-workspace"])("client-selected authority is rejected: %s",async query=>{
    expect((await request(app).get("/api/demo-professional/context?"+query)).status).toBe(400);
  });
  test("production denies ordinary users without grants and keeps activation locked",async()=>{
    process.env.NODE_ENV="production";try{
      expect((await request(app).get("/api/demo-professional/context")).status).toBe(403);
      expect((await request(app).post("/api/admin/demo-professional/prepare").send({})).status).toBe(423);
    }finally{process.env.NODE_ENV="development";}
  });
  test("revocation remains reachable, but malformed client authorization is rejected",async()=>{
    const response=await request(app).post("/api/admin/demo-professional/accounts/synthetic-actor/revoke").send({demo:true});
    expect(response.status).toBe(400);expect(response.body.code).toBe("DEMO_INVALID_GRANT");
  });
});

describe("Production synthetic API journey — all data is in-memory fixtures",()=>{
  const previous=process.env.NODE_ENV;
  const workspaceId="37e010aa-c441-4881-bf2a-3f402654cd10";
  const patientId="37e010aa-c441-4881-bf2a-3f402654cd11";
  const root="/api/demo-professional";
  const headers={"x-fixture-user":founder.userId};
  beforeEach(()=>{
    process.env.NODE_ENV="production";mockAuthenticated=true;
    mockGrant={id:"37e010aa-c441-4881-bf2a-3f402654cd01",userId:founder.userId,workspaceId,persona:"physician",
      operatingStatus:"demo_only",state:"active",revision:2,capabilities:[...DEMO_CAPABILITIES],expiresAt:null,
      authority:"founder_admin",lifetime:"permanent_founder",clinicId:founder.clinicId,approverId:"fixture-mfa-admin",
      reason:"Fixture-only audited founder authorization",trainingBasis:"demo_only_waiver",
      trainingWaiverReason:"Synthetic demonstration only; no real-world completion.",acknowledgedAt:null,
      acknowledgmentVersion:null,identityRequestId:"37e010aa-c441-4881-bf2a-3f402654cd12"};
    mockPatient={id:patientId,workspaceId,classification:"synthetic",label:"Synthetic Patient 001",
      scenario:"Fictional follow-up",glucose:[],messages:[],media:[],plan:null,revision:1};
  });
  afterEach(()=>{process.env.NODE_ENV=previous;mockGrant=null;mockPatient=null;mockAuthenticated=true;});
  const app=express();app.use(express.json());
  app.use(createDemoDataBoundary({
    actor:async(req)=>mockAuthenticated?{id:String(req.headers["x-fixture-user"]??"synthetic-actor"),username:"Fixture",
      email:"fixture@example.invalid",role:"client",professionalRole:"physician",isProCare:false,planLookupKey:null}:null,
    restriction:async(id)=>mockGrant?.userId===id?mockGrant:null,
  }));
  app.use(root,demoProfessionalRouter);app.use((_req,res)=>res.json({liveHandlerExecuted:true}));
  test("context, acknowledgment, refresh, synthetic plan and simulated Care Team persist across fixture login/logout",async()=>{
    const context=await request(app).get(root+"/context").set(headers);
    expect(context.status).toBe(200);expect(context.body).toMatchObject({clinic:{id:founder.clinicId},
      grant:{expiresAt:null,authority:"founder_admin"},paidSubscriptionGranted:false,academyCompletionGranted:false});
    expect((await request(app).get(`${root}/workspaces/${workspaceId}/patients`).set(headers)).status).toBe(403);
    expect((await request(app).post(root+"/acknowledgment").set(headers)
      .send({version:DEMO_ACKNOWLEDGMENT_VERSION,syntheticOnlyAcknowledged:true})).status).toBe(200);
    expect((await request(app).get(`${root}/workspaces/${workspaceId}/patients`).set(headers)).body.patients).toHaveLength(1);
    expect((await request(app).put(`${root}/workspaces/${workspaceId}/patients/${patientId}/plan`).set(headers)
      .send({nutritionFocus:"balanced_meals",followupDays:7})).status).toBe(200);
    const invitation=await request(app).post(`${root}/workspaces/${workspaceId}/patients/${patientId}/invitation`).set(headers).send({});
    expect(invitation.body.delivery).toBe("synthetic_simulation_only");
    const accepted=await request(app).post(`${root}/workspaces/${workspaceId}/patients/${patientId}/invitation/accept`).set(headers).send({key:invitation.body.invitation.code});
    expect(accepted.body).toMatchObject({synthetic:true,invitation:{state:"accepted"}});
    mockAuthenticated=false;expect((await request(app).get(root+"/context").set(headers)).status).toBe(401);
    mockAuthenticated=true;
    expect((await request(app).get(root+"/context").set(headers)).body.acknowledgmentRequired).toBe(false);
    expect((await request(app).get(`${root}/workspaces/${workspaceId}/patients/${patientId}`).set(headers)).body.plan).toEqual({nutritionFocus:"balanced_meals",followupDays:7});
    expect((await request(app).get(`${root}/workspaces/${workspaceId}/patients/${patientId}/invitation`).set(headers)).body.invitation.state).toBe("accepted");
  });
  test("Production denies real data, messages, exports, organizations, injected subjects and revoked access",async()=>{
    for(const path of ["/api/clinical/records/real","/api/care-team","/api/messages/real","/api/exports/real","/api/business/other-org","/objects/private-file"]){
      const response=await request(app).get(path).set(headers);
      expect(response.status).toBe(403);expect(response.body.code).toBe("DEMO_LIVE_DATA_DENIED");
      expect(response.body.liveHandlerExecuted).toBeUndefined();
    }
    expect((await request(app).get(root+"/context?userId=someone-else").set(headers)).status).toBe(400);
    expect((await request(app).get(root+"/context").set({"x-fixture-user":"ordinary-physician"})).status).toBe(403);
    mockGrant!.state="revoked";
    expect((await request(app).get(root+"/context").set(headers)).status).toBe(403);
    expect((await request(app).get("/api/messages/real").set(headers)).status).toBe(403);
  });
});
