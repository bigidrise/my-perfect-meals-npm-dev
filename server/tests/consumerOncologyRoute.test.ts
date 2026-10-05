jest.mock("../db", () => ({ db: { transaction: jest.fn() } }));
import fs from "fs";
import path from "path";
import ts from "typescript";
import { db } from "../db";
import {
  ConsumerOncologyError,
  SELF_SELECTABLE_SPECIALTY_CONDITIONS,
  saveConsumerSpecialtySupport,
} from "../services/consumerOncologySupport";

// Execute the actual registered callback without booting unrelated services or
// using a real database, session, or patient account.
function specialtyHandler(development: boolean) {
  const source = ts.createSourceFile("routes.ts",
    fs.readFileSync(path.join(__dirname, "../routes.ts"), "utf8"), ts.ScriptTarget.Latest, true);
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.patch"
      && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === "/api/user/specialty-condition") {
      callback = node.arguments[node.arguments.length - 1];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!callback) throw new Error("Specialty condition route was not found.");
  const compiled = ts.transpileModule(callback.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const dependencies = {
    ConsumerOncologyError, SELF_SELECTABLE_SPECIALTY_CONDITIONS, saveConsumerSpecialtySupport,
    oncologySymptomPriorityEnabled: () => development,
    getPhysicianLockStatus: async () => false,
    getLabDrivenConditions: async () => [],
  };
  return new Function(...Object.keys(dependencies), `return ${compiled}`)(...Object.values(dependencies));
}

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

test("actual Development endpoint saves Mouth sensitivity with established legacy supports", async () => {
  let record: any = { conditions: ["therapeutic-support", "performance-nutrition"], context: null };
  const write = jest.fn(async (value: any) => {
    record = { conditions: value.specialtyConditions, context: value.oncologySupportContext };
  });
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => [record] }) }) }) }),
    update: () => ({ set: (value: any) => ({ where: () => write(value) }) }),
  };
  (db.transaction as jest.Mock).mockImplementation(async fn => fn(tx));
  const res = response();
  await specialtyHandler(true)({
    authUser: { id: "mock-subject" },
    body: { conditions: [...record.conditions, "oncology-support"], oncologySupport: { symptoms: ["mouth_sensitivity"] } },
  }, res);
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({
    ok: true,
    specialtyConditions: ["therapeutic-support", "performance-nutrition", "oncology-support"],
    oncologySupportContext: { enabled: true, source: "self", symptoms: ["mouth_sensitivity"] },
  });
  expect(record.context).toEqual(res.body.oncologySupportContext);
  expect(write).toHaveBeenCalledTimes(1);
});

test("actual Development endpoint rejects newly requested legacy support without writing", async () => {
  const write = jest.fn();
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => [{ conditions: [], context: null }] }) }) }) }),
    update: () => ({ set: (value: any) => ({ where: () => write(value) }) }),
  };
  (db.transaction as jest.Mock).mockImplementation(async fn => fn(tx));
  const res = response();
  await specialtyHandler(true)({
    authUser: { id: "mock-subject" },
    body: { conditions: ["performance-nutrition", "oncology-support"], oncologySupport: { symptoms: ["mouth_sensitivity"] } },
  }, res);
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe("invalid_specialty_condition");
  expect(write).not.toHaveBeenCalled();
});

test("non-Development symptom editing remains blocked before any database write", async () => {
  (db.transaction as jest.Mock).mockClear();
  const res = response();
  await specialtyHandler(false)({
    authUser: { id: "mock-subject" },
    body: { conditions: ["oncology-support"], oncologySupport: { symptoms: ["mouth_sensitivity"] } },
  }, res);
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toMatch(/Development only/);
  expect(db.transaction).not.toHaveBeenCalled();
});
