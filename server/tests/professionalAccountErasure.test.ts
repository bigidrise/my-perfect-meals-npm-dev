jest.mock("../db", () => ({ db: {} }));
import { eraseAccount } from "../services/professionalAccountErasure";
import { readFileSync } from "node:fs";

describe("authorized account erasure entry point", () => {
  function fixture(ready: boolean, failure?: Error) {
    const where=jest.fn(async () => { if(failure) throw failure; });
    const remove=jest.fn(() => ({where}));
    const tx={execute:jest.fn(async()=>({rows:[{ready}]})),delete:remove};
    const transaction=jest.fn(async(work:any)=>work(tx));
    return { database:{transaction},transaction,where,remove,tx };
  }
  test("account deletion and erasure readiness are in one transaction", async()=>{
    const f=fixture(true);
    await eraseAccount("fictional-authenticated-subject",f.database as any);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.tx.execute).toHaveBeenCalledTimes(1);
    expect(f.where).toHaveBeenCalledTimes(1);
  });
  test("missing erasure protection fails closed before account deletion", async()=>{
    const f=fixture(false);
    await expect(eraseAccount("fictional-authenticated-subject",f.database as any)).rejects.toThrow("not ready");
    expect(f.remove).not.toHaveBeenCalled();
  });
  test("account failure propagates to the transaction owner", async()=>{
    const f=fixture(true,new Error("fictional FK failure"));
    await expect(eraseAccount("fictional-authenticated-subject",f.database as any)).rejects.toThrow("fictional FK failure");
  });
  test("the HTTP route uses authenticated subject, not a supplied target; success audit follows erasure",()=>{
    const file=readFileSync("server/routes/auth.session.ts","utf8");
    const route=file.slice(file.indexOf('router.delete("/api/auth/delete-account"'),file.indexOf('router.post("/api/auth/forgot-password"'));
    expect(route).toContain("requireAuth");
    expect(route).toContain("authReq.authUser.id");
    expect(route).toContain("await eraseAccount(userId)");
    expect(route).not.toMatch(/req\.body|req\.params/);
    expect(route.indexOf("await eraseAccount(userId)")).toBeLessThan(route.indexOf('action: "AUTH_ACCOUNT_DELETED"'));
  });
});
