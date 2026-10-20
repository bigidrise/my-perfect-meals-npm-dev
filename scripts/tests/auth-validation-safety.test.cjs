const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync("scripts/test-auth-integration.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture(options = {}) {
  let email;
  const logs = [];
  const response = (status, json = {}) => ({ status, json: async () => json });
  const fetch = jest.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : {};
    if (path === "/api/auth/signup") {
      email = body.email;
      return response(options.signupStatus ?? 201, options.missingToken ? {} : { authToken: "fixture-secret-token" });
    }
    if (path === "/api/auth/login") {
      if (!body.email) return response(400);
      if (body.email.startsWith("no-such-user-") || body.password === "TotallyWrongPassw0rd!") return response(401);
      return response(200, options.missingToken ? {} : { authToken: "fixture-secret-token" });
    }
    if (path === "/api/auth/session")
      return init.headers["x-auth-token"] === "fixture-secret-token" ? response(200, { email }) : response(401);
    if (path === "/api/auth/delete-account" && init.method === "DELETE") {
      if (options.cleanupThrows) throw new Error("fixture-secret-transport-error");
      return response(options.cleanupStatus ?? 204, options.cleanupBody ?? {});
    }
    throw new Error("Unexpected fixture request");
  });
  const process = { argv: ["node", "scripts/test-auth-integration.ts", "--allow-account-mutations"], exitCode: 0, exit: jest.fn() };
  const console = Object.fromEntries(["log", "warn", "error"].map(name => [name, (...args) => logs.push(args.join(" "))]));
  const context = vm.createContext({ fetch, process, console });
  vm.runInContext(compiled, context);
  return { context, process, fetch, logs };
}
test("direct execution fails closed even with a proposed override", () => {
  const f = fixture();
  expect(f.process.exitCode).toBe(1);
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.logs.join("\n")).toContain("shared-database account creation and deletion are not authorized");
});
test.each([200, 204])("mocked lifecycle passes only with successful cleanup (%s)", async cleanupStatus => {
  const f = fixture({ cleanupStatus });
  await f.context.main();
  expect(f.process.exit).toHaveBeenLastCalledWith(0);
  expect(f.fetch.mock.calls.filter(([, init]) => init.method === "DELETE")).toHaveLength(1);
});
test("cleanup failure fails validation and logs only a bounded machine code", async () => {
  const f = fixture({ cleanupStatus: 500, cleanupBody: { code: "DEVELOPMENT_STRIPE_ISOLATION", token: "fixture-private-response" } });
  await f.context.main();
  expect(f.process.exit).toHaveBeenLastCalledWith(1);
  expect(f.logs.join("\n")).toContain("status=500 code=DEVELOPMENT_STRIPE_ISOLATION");
  expect(f.logs.join("\n")).not.toMatch(/All \d+ auth integration checks passed|fixture-private-response|fixture-secret-token/);
});
test("cleanup transport failure cannot pass or leak exceptions", async () => {
  const f = fixture({ cleanupThrows: true });
  await f.context.main();
  expect(f.process.exit).toHaveBeenLastCalledWith(1);
  expect(f.logs.join("\n")).toContain("cleanup request failed");
  expect(f.logs.join("\n")).not.toContain("fixture-secret-transport-error");
});
test("missing cleanup credentials cannot trigger anonymous deletion", async () => {
  const f = fixture({ missingToken: true });
  await f.context.main();
  expect(f.process.exit).toHaveBeenLastCalledWith(1);
  expect(f.fetch.mock.calls.some(([, init]) => init.method === "DELETE")).toBe(false);
});
test("cleanup still runs when a per-account check throws", async () => {
  const f = fixture();
  vm.runInContext('testSessionRestore = async () => { throw new Error("fixture interruption"); }', f.context);
  await expect(f.context.main()).rejects.toThrow("fixture interruption");
  expect(f.fetch.mock.calls.filter(([, init]) => init.method === "DELETE")).toHaveLength(1);
});
test("failed signup never attempts deletion", async () => {
  const f = fixture({ signupStatus: 500 });
  await f.context.main();
  expect(f.process.exit).toHaveBeenLastCalledWith(1);
  expect(f.fetch.mock.calls.some(([, init]) => init.method === "DELETE")).toBe(false);
});
test("arbitrary cleanup response text is not logged", async () => {
  const f = fixture({ cleanupStatus: 500, cleanupBody: { code: "private account and token", error: "fixture-private-response" } });
  await f.context.main();
  expect(f.logs.join("\n")).not.toMatch(/private account and token|fixture-private-response/);
});
test("routine validation uses isolated checks, not live authentication", () => {
  const validator = fs.readFileSync("scripts/validate.sh", "utf8");
  expect(validator).toContain("jest --config scripts/tests/auth-validation-safety.jest.cjs --runInBand");
  expect(validator).not.toContain("tsx scripts/test-auth-integration.ts");
  expect(validator).toContain("Live login/session checks NOT RUN");
  expect(validator).toContain("diagnostic log retained");
});
