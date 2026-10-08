import express from "express";
import request from "supertest";
jest.mock("../middleware/requireAuth",()=>({requireAuth:(req:any,_res:any,next:any)=>{req.authUser={id:"synthetic-actor"};next();}}));
jest.mock("../middleware/requireProfessionalIdentityReviewer",()=>({requireProfessionalIdentityReviewer:(req:any,_res:any,next:any)=>{req.identityReviewer={id:"synthetic-reviewer",securityVersion:1,mfaVerified:true};next();}}));
jest.mock("../services/demoProfessionalRepository",()=>({
  demoProfessionalRepository:{transaction:async(work:any)=>work({accounts:async()=>[{id:"synthetic-actor",professionalRole:"physician"}],grant:async()=>null})},
  demoRepositoryForActor:()=>({transaction:async(work:any)=>work({accounts:async()=>[{id:"synthetic-actor",professionalRole:"physician"}],grant:async()=>null})}),
  readDemoRestriction:async()=>null,readDemoGrantHistory:async()=>[],
}));
import {demoProfessionalRouter,demoProfessionalAdminRouter} from "../routes/demoProfessionalRoutes";
describe("Stage 3 HTTP release/authority gates",()=>{
  const previous=process.env.NODE_ENV;beforeAll(()=>{process.env.NODE_ENV="development";});afterAll(()=>{process.env.NODE_ENV=previous;});
  const app=express();app.use(express.json());app.use("/api/demo-professional",demoProfessionalRouter);app.use("/api/admin/demo-professional",demoProfessionalAdminRouter);
  test.each(["/prepare","/accounts/synthetic-actor/activate","/accounts/synthetic-actor/revoke"])("actual account mutation remains locked even for MFA admin: %s",async path=>{
    const response=await request(app).post("/api/admin/demo-professional"+path).send({demo:true,approved:true});
    expect(response.status).toBe(423);expect(response.body.code).toBe("DEMO_ACCOUNT_TRANSITION_NOT_APPROVED");
  });
  test("canonical physician with no explicit grant gets no demo authority",async()=>{
    const response=await request(app).get("/api/demo-professional/context");expect(response.status).toBe(403);expect(response.body.code).toBe("DEMO_AUTHORITY_REQUIRED");
  });
  test.each(["demo=true","userId=real-patient","workspaceId=another-workspace"])("client-selected authority is rejected: %s",async query=>{
    expect((await request(app).get("/api/demo-professional/context?"+query)).status).toBe(400);
  });
  test("production cannot enable demo endpoints or grant writes",async()=>{
    process.env.NODE_ENV="production";try{
      expect((await request(app).get("/api/demo-professional/context")).status).toBe(404);
      expect((await request(app).post("/api/admin/demo-professional/prepare").send({})).status).toBe(404);
    }finally{process.env.NODE_ENV="development";}
  });
});
