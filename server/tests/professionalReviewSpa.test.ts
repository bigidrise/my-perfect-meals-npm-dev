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
