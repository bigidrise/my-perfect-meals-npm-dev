jest.mock("../db", () => ({ db: {
  transaction: jest.fn(),
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ conditions: [], primary: null }] }) }) }),
} }));
jest.mock("../services/labProtocolOwnership", () => ({ getPhysicianLockStatus: jest.fn(async () => false) }));
import fs from "fs";
import path from "path";
import ts from "typescript";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { normalizeClinicalProtocols } from "@shared/clinicalProtocolIdentity";
import { PREGNANCY_CUSTOMER_AVAILABLE, PREGNANCY_PAUSE_MESSAGE, retainPregnancySupport } from "@shared/pregnancyAvailability";
import { getPhysicianLockStatus } from "../services/labProtocolOwnership";
import {
  ConsumerOncologyError,
  SELF_SELECTABLE_SPECIALTY_CONDITIONS,
  saveConsumerSpecialtySupport,
  saveConsumerSpecialtyConditions,
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
    db, users, eq, normalizeClinicalProtocols, PREGNANCY_CUSTOMER_AVAILABLE, PREGNANCY_PAUSE_MESSAGE, retainPregnancySupport,
    ConsumerOncologyError, SELF_SELECTABLE_SPECIALTY_CONDITIONS, saveConsumerSpecialtySupport, saveConsumerSpecialtyConditions,
    oncologySymptomPriorityEnabled: () => development,
    getPhysicianLockStatus,
    // If the old automatic lab merge returns, the expected explicit list fails.
    getLabDrivenConditions: async () => ["cardiac"],
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
    insert: () => ({ values: async () => undefined }),
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
    insert: () => ({ values: async () => undefined }),
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

describe("Production specialty saves with authoritative support retention", () => {
  beforeEach(() => {
    (getPhysicianLockStatus as jest.Mock).mockResolvedValue(false);
    (db.transaction as jest.Mock).mockReset();
  });

  function storedSubject(conditions = ["therapeutic-support", "performance-nutrition"], primaryCondition: string | null = null) {
    let record = {
      conditions, primaryCondition,
      context: {
        enabled: true, source: "self", locked: false,
        symptoms: ["mouth_sensitivity"], updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const write = jest.fn(async (value: any) => {
      record = {
        ...record, conditions: value.specialtyConditions,
        primaryCondition: value.specialtyCondition,
        ...(Object.prototype.hasOwnProperty.call(value, "oncologySupportContext") ? { context: value.oncologySupportContext } : {}),
      };
    });
    const lockedRead = jest.fn(async () => [record]);
    const audit = jest.fn(async () => undefined);
    const tx = {
      insert: () => ({ values: audit }),
      select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: lockedRead }) }) }) }),
      update: () => ({ set: (value: any) => ({ where: () => write(value) }) }),
    };
    (db.transaction as jest.Mock).mockImplementation(async fn => fn(tx));
    return { write, lockedRead, audit, current: () => record };
  }

  async function save(body: unknown) {
    const res = response();
    await specialtyHandler(false)({ authUser: { id: "mock-subject" }, body }, res);
    return res;
  }

  test.each(SELF_SELECTABLE_SPECIALTY_CONDITIONS.filter(condition =>
    condition !== "pregnancy-support" && condition !== "alpha-gal-syndrome",
  ))("saves and removes %s while retaining established supports and leaving Oncology context untouched", async condition => {
    const fixture = storedSubject();
    const oncology = structuredClone(fixture.current().context);
    const selected = await save({ conditions: [...fixture.current().conditions, condition] });
    expect(selected.statusCode).toBe(200);
    expect(selected.body.specialtyConditions).toEqual(["therapeutic-support", "performance-nutrition", condition]);
    expect(fixture.lockedRead).toHaveBeenCalled();
    const cleared = await save({ conditions: [] });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.specialtyConditions).toEqual(["therapeutic-support", "performance-nutrition"]);
    expect(fixture.current().context).toEqual(oncology);
    for (const [value] of fixture.write.mock.calls) expect(value).not.toHaveProperty("oncologySupportContext");
    expect(fixture.audit).toHaveBeenCalledTimes(2);
  });

  test.each([{ condition: "renal" }, { condition: null }, { conditions: ["renal"] }, { conditions: [] }])(
    "preserves omitted supports including legacy primary-only storage: %j", async body => {
      const fixture = storedSubject(["performance-nutrition"], "therapeutic-support");
      const res = await save(body);
      expect(res.statusCode).toBe(200);
      expect(res.body.specialtyConditions).toEqual([
        ...(("condition" in body && body.condition === "renal") ||
          ("conditions" in body && body.conditions.includes("renal")) ? ["renal"] : []),
        "performance-nutrition", "therapeutic-support",
      ]);
      expect(fixture.current().primaryCondition).toBe(res.body.specialtyConditions[0]);
    },
  );

  test.each(["therapeutic-support", "performance-nutrition", "unknown-condition"])(
    "rejects new or stale client activation of %s without any write", async condition => {
      const fixture = storedSubject([]);
      for (const body of [{ conditions: ["renal", condition] }, { condition }]) {
        const res = await save(body);
        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({ error: "invalid_specialty_condition" });
      }
      expect(fixture.write).not.toHaveBeenCalled();
      expect(fixture.audit).not.toHaveBeenCalled();
    },
  );

  test("checks physician authority again before writing the locked row", async () => {
    const fixture = storedSubject();
    (getPhysicianLockStatus as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const res = await save({ conditions: ["renal"] });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("clinical_review_required");
    expect(fixture.write).not.toHaveBeenCalled();
    expect(fixture.audit).not.toHaveBeenCalled();
  });

  test("retains the existing physician lock response before starting a transaction", async () => {
    const fixture = storedSubject();
    (getPhysicianLockStatus as jest.Mock).mockResolvedValue(true);
    const res = await save({ conditions: [] });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("physician_locked");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(fixture.write).not.toHaveBeenCalled();
  });

  test("still requires Alpha-gal setup before activating the protocol", async () => {
    const fixture = storedSubject();
    const res = await save({ conditions: ["alpha-gal-syndrome"] });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("alpha_gal_profile_required");
    expect(fixture.write).not.toHaveBeenCalled();
  });

  test("rejects malformed condition arrays without writing", async () => {
    const fixture = storedSubject();
    const res = await save({ conditions: "renal" });
    expect(res.statusCode).toBe(400);
    expect(fixture.write).not.toHaveBeenCalled();
  });

  test("keeps new Pregnancy activation paused without writing", async () => {
    const fixture = storedSubject();
    const res = await save({ conditions: ["pregnancy-support"] });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("pregnancy_coming_soon");
    expect(fixture.write).not.toHaveBeenCalled();
  });
});
