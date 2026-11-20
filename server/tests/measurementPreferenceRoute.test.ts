/** @jest-environment node */
// Execute the actual registered handler with in-memory transport/storage.
// No app bootstrap, database module, account, environment secret or provider.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.createSourceFile("routes.ts", fs.readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
let registration: ts.CallExpression | undefined;
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "patch" && node.arguments[0]?.getText(source) === '"/api/user/preferences"') {
    registration = node;
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!registration) throw new Error("Existing preferences route not found");
const callback = registration.arguments[registration.arguments.length - 1].getText(source);
const javascript = ts.transpileModule(`module.exports = ${callback}`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup() {
  const writes: any[] = [];
  const where = jest.fn().mockResolvedValue(undefined);
  const db = { update: jest.fn(() => ({ set: (updates: any) => { writes.push(updates); return { where }; } })) };
  const context = {
    module: { exports: undefined as any }, db, users: { id: "id-column" },
    eq: (column: string, id: string) => ({ column, id }),
    console: { log: jest.fn(), error: jest.fn() },
  };
  vm.runInNewContext(javascript, context);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return { handler: context.module.exports, db, writes, where, res };
}

test("the existing route remains guarded by requireAuth", () => {
  expect(registration!.arguments[1].getText(source)).toBe("requireAuth");
});
test.each(["US", "CA", "AU", "UK", "NZ"])("stores exact Auto intent/country %s for the authenticated account, never language or canonical data", async countryCode => {
  for (const measurementSystem of ["auto", "imperial", "metric"]) {
    const f = setup();
    await f.handler({ authUser: { id: "fixture-owner" }, body: {
      userId: "untrusted-other", measurementSystem, countryCode, weight: 999, dailyCalorieTarget: 999,
    } }, f.res);
    expect(f.res.status).not.toHaveBeenCalled();
    expect(f.writes).toEqual([{ measurementSystem, countryCode }]);
    expect(f.where).toHaveBeenCalledWith({ column: "id-column", id: "fixture-owner" });
    expect(f.res.json).toHaveBeenCalledWith({ success: true, measurementSystem, countryCode });
  }
});
test.each([{ measurementSystem: "unknown" }, { countryCode: "GB" }, { countryCode: null }, {}])(
  "invalid preference %p does not write", async body => {
    const f = setup();
    await f.handler({ authUser: { id: "fixture-owner" }, body }, f.res);
    expect(f.res.status).toHaveBeenCalledWith(400);
    expect(f.writes).toHaveLength(0);
  },
);
test("language updates cannot rewrite country, measurement intent or original saved values", async () => {
  const f = setup();
  await f.handler({ authUser: { id: "fixture-owner" }, body: { preferredLanguage: "es" } }, f.res);
  expect(f.writes).toEqual([{ preferredLanguage: "es" }]);
});
test("a storage failure returns HTTP 500 instead of claiming success", async () => {
  const f = setup();
  f.where.mockRejectedValueOnce(new Error("offline"));
  await f.handler({ authUser: { id: "fixture-owner" }, body: { measurementSystem: "auto" } }, f.res);
  expect(f.res.status).toHaveBeenCalledWith(500);
  expect(f.res.json).not.toHaveBeenCalledWith(expect.objectContaining({ success: true }));
});
