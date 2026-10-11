import express from "express";
import request from "supertest";
import { professionalReviewSpa } from "../lib/professionalReviewSpa";
const qa = jest.fn((_req, res, _next) => res.status(404).end());
const app = express();
app.use("/admin", professionalReviewSpa(qa));
app.get("/admin/professional-requests", (_req, res) => res.send("generic SPA document; no private data"));
beforeEach(() => qa.mockClear());
test("disabled QA does not shadow the professional review SPA GET document", async () => {
  expect((await request(app).get("/admin/professional-requests")).status).toBe(200);
  expect(qa).not.toHaveBeenCalled();
});
test.each(["/admin", "/admin/qa", "/admin/other", "/admin/professional-requests/credentials"])("QA protection is unchanged for %s", async path => {
  expect((await request(app).get(path)).status).toBe(404); expect(qa).toHaveBeenCalled();
});
test("the document exception cannot enable a mutation", async () => {
  expect((await request(app).post("/admin/professional-requests")).status).toBe(404); expect(qa).toHaveBeenCalled();
});

function pilotApp(env: Pick<NodeJS.ProcessEnv, "NODE_ENV" | "REPLIT_DEPLOYMENT">) {
  const isolated = express();
  isolated.use("/admin", professionalReviewSpa(qa, env));
  isolated.get("/admin/pilots", (_req, res) => res.send("generic SPA document; no private data"));
  return isolated;
}

describe("Development-only founder pilot SPA document", () => {
  test.each(["get", "head"] as const)("allows only the %s page document in Development", async method => {
    const response = await request(pilotApp({ NODE_ENV: "development" }))[method]("/admin/pilots");
    expect(response.status).toBe(200);
    if (method === "get") expect(response.text).toBe("generic SPA document; no private data");
    expect(qa).not.toHaveBeenCalled();
  });

  test.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "production", REPLIT_DEPLOYMENT: "1" },
    { NODE_ENV: "development", REPLIT_DEPLOYMENT: "1" },
    { NODE_ENV: "test" },
    {},
  ])("preserves the QA gate outside a non-deployed Development runtime (%j)", async env => {
    const isolated = pilotApp(env);
    expect((await request(isolated).get("/admin/pilots")).status).toBe(404);
    expect((await request(isolated).head("/admin/pilots")).status).toBe(404);
    expect(qa).toHaveBeenCalledTimes(2);
  });

  test.each(["post", "put", "patch", "delete", "options"] as const)(
    "does not exempt %s requests",
    async method => {
      expect((await request(pilotApp({ NODE_ENV: "development" }))[method]("/admin/pilots")).status).toBe(404);
      expect(qa).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["/admin", "/admin/qa", "/admin/other", "/admin/pilots/", "/admin/pilots/issue", "/admin/pilots/credentials"])(
    "does not exempt unrelated or nested route %s",
    async url => {
      expect((await request(pilotApp({ NODE_ENV: "development" })).get(url)).status).toBe(404);
      expect(qa).toHaveBeenCalledTimes(1);
    },
  );
});
