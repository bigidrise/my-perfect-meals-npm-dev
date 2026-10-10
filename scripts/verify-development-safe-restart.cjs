// Offline verification only: no application imports, sockets, providers or DB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const parse = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
const transpile = (source, file) => ts.transpileModule(source, {
  fileName: file,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const policyModule = { exports: {} };
vm.runInNewContext(transpile(read("server/bootstrap/developmentStartupMaintenance.ts"), "policy.ts"), {
  module: policyModule, exports: policyModule.exports, process: { env: {} },
});
const policy = policyModule.exports.startupMaintenanceEnabled;
const dev = { NODE_ENV: "development", DEVELOPMENT_SAFE_RESTART: "true" };
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`PASS: ${name}`);
}
check("explicit Development opt-in suppresses startup maintenance", () => assert.equal(policy(dev), false));
check("ordinary Development retains maintenance", () => assert.equal(policy({ NODE_ENV: "development" }), true));
check("Production cannot opt out", () => assert.equal(policy({ ...dev, NODE_ENV: "production" }), true));
check("a deployed process cannot opt out even with Development NODE_ENV", () =>
  assert.equal(policy({ ...dev, REPLIT_DEPLOYMENT: "1" }), true));
check("Production-project marker cannot opt out", () =>
  assert.equal(policy({ ...dev, VITE_IS_PRODUCTION_PROJECT: "true" }), true));
check("alternate Production-project marker spellings cannot opt out", () => {
  assert.equal(policy({ ...dev, VITE_IS_PRODUCTION_PROJECT: "TRUE" }), true);
  assert.equal(policy({ ...dev, VITE_IS_PRODUCTION_PROJECT: "1" }), true);
});
check("test and missing NODE_ENV cannot opt out", () => {
  assert.equal(policy({ ...dev, NODE_ENV: "test" }), true);
  assert.equal(policy({ DEVELOPMENT_SAFE_RESTART: "true" }), true);
});

function guarded(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isIfStatement(parent) && parent.expression.getText().includes("startupMaintenanceEnabled()") &&
        !parent.expression.getText().includes("!startupMaintenanceEnabled()")) return true;
    if (ts.isCallExpression(parent) && parent.expression.getText() === "withBootRetry") return true;
    if (ts.isFunctionDeclaration(parent) && parent.name?.text === "withBootRetry") return true;
  }
  return false;
}
const indexAst = parse("server/index.ts");
let guardedTimers = 0;
let guardedWriters = 0;
function inspect(node) {
  if (ts.isCallExpression(node)) {
    const name = node.expression.getText();
    if (name === "setTimeout" || name === "setInterval") {
      if (guarded(node)) guardedTimers++;
      else assert.match(node.arguments[0]?.getText() || "", /warmupService\.start\(\)/,
        `Unexpected unguarded startup timer: ${node.getText().slice(0, 160)}`);
    }
    if (/^(?:run[A-Za-z]+Migration|seedDefaultOrganizations|seedCoachKnowledgePatterns|start[A-Za-z]+Worker)$/.test(name)) {
      assert.ok(guarded(node), `Unguarded automatic writer: ${name}`);
      guardedWriters++;
    }
  }
  ts.forEachChild(node, inspect);
}
check("every Development entrypoint writer and non-read-only timer is guarded", () => inspect(indexAst));
check("read-only readiness checks remain outside maintenance suppression", () => {
  const found = [];
  function visit(node) {
    if (ts.isCallExpression(node) &&
        ["assertStripeBillingSchema", "assertCorrelationIdColumn", "assertColumnsExist"].includes(node.expression.getText())) {
      assert.equal(guarded(node), false);
      found.push(node.expression.getText());
    }
    ts.forEachChild(node, visit);
  }
  visit(indexAst);
  assert.equal(found.length, 3);
});
check("SMS import and reminder scheduler import are guarded before module evaluation", () => {
  let count = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        /workers\/smsWorker|services\/reminderScheduler/.test(node.arguments[0]?.getText() || "")) {
      assert.ok(guarded(node));
      count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(indexAst);
  assert.equal(count, 2);
});
check("import-triggered voice worker is guarded without changing its request handlers", () => {
  let count = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText() === "startVoiceJobWorker") {
      assert.ok(guarded(node));
      count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(parse("server/routes/proTabletRoutes.ts"));
  assert.equal(count, 1);
});
check("database keepalive is SELECT-only; safety-token expiration remains active", () => {
  assert.match(read("server/db.ts"), /pool\.query\("SELECT 1"\)/);
  assert.doesNotMatch(read("server/db.ts"), /startupMaintenanceEnabled/);
  assert.doesNotMatch(read("server/services/safetyPinService.ts"), /startupMaintenanceEnabled/);
});

// Inspect the local import graph without loading any of it. Flag constructors
// and module-scope async launch sites for review; never execute imported code.
const seen = new Set();
const sites = [];
const constructionSites = [];
function automaticallyInvoked(node) {
  let expression = node;
  while (expression.parent && ts.isParenthesizedExpression(expression.parent)) expression = expression.parent;
  const parent = expression.parent;
  return parent && ts.isCallExpression(parent) &&
    (parent.expression === expression ||
      (parent.arguments.includes(expression) &&
        /(?:\.then|\.catch|\.finally|setTimeout|setInterval|\.schedule)$/.test(parent.expression.getText())));
}
function audit(file) {
  if (seen.has(file) || !fs.existsSync(path.join(root, file))) return;
  seen.add(file);
  const ast = parse(file);
  function descend(node, inFunction = false) {
    const callable = ts.isFunctionLike(node);
    if (!inFunction && ts.isCallExpression(node)) {
      const text = node.expression.getText();
      if (/setInterval|setTimeout|\.schedule$|\.then$|^start.*Worker$|^init.*Cron$|^run.*Migration$|^seed|^initialize|^resume|^ensure|^processDue|\.(?:execute|query|insert|update|delete|transaction)$/.test(text)) {
        sites.push(`${file}: ${text}${guarded(node) ? " [guarded]" : ""}`);
      }
    }
    // Local singleton constructors can launch maintenance indirectly.
    if (ts.isConstructorDeclaration(node) &&
        /setInterval|setTimeout|\.schedule\(|\.insert\(|\.update\(|\.delete\(|Migration\(/.test(node.getText())) {
      sites.push(`${file}: constructor requires inspection`);
    }
    if (!inFunction && ts.isNewExpression(node)) {
      const declaration = ast.statements.find(statement =>
        ts.isClassDeclaration(statement) && statement.name?.text === node.expression.getText());
      const constructor = declaration?.members.find(ts.isConstructorDeclaration);
      if (constructor && /\bthis\.[A-Za-z]+\(/.test(constructor.getText())) {
        constructionSites.push(`${file}: ${node.expression.getText()} constructor calls local methods`);
      }
    }
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) ||
        (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      const spec = ts.isImportDeclaration(node) ? node.moduleSpecifier : node.arguments[0];
      if (spec && ts.isStringLiteral(spec)) {
        const value = spec.text;
        let target;
        if (value.startsWith(".")) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), value));
        else if (value.startsWith("@shared/")) target = `shared/${value.slice(8)}`;
        else if (value.startsWith("@/")) target = `client/src/${value.slice(2)}`;
        if (target) {
          for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`]) {
            if (fs.existsSync(path.join(root, candidate)) && fs.statSync(path.join(root, candidate)).isFile()) {
              audit(candidate);
              break;
            }
          }
        }
      }
    }
    ts.forEachChild(node, child => descend(child, inFunction || (callable && !automaticallyInvoked(node))));
  }
  descend(ast);
}
audit("server/index.ts");
console.log(`IMPORT AUDIT: ${seen.size} local modules inspected (parse-only).`);
console.log([...new Set(sites)].join("\n"));
console.log([...new Set(constructionSites)].join("\n"));

async function simulateSafeBoot() {
  const timers = [];
  const calls = [];
  const fakeProcess = {
    env: { ...dev, SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE: "true" },
    version: "synthetic", on: () => {},
    exit: code => { throw Error(`Unexpected exit ${code}`); },
  };
  const noop = () => {};
  const app = {
    use: noop, get: noop, post: noop, options: noop, set: noop, disable: noop,
    listen: (_port, _host, callback) => { calls.push("listen"); callback(); return {}; },
  };
  function express() { return app; }
  Object.assign(express, { __esModule: true, default: express, raw: () => noop,
    json: () => noop, urlencoded: () => noop, static: () => noop });
  const moduleCache = new Map();
  function mockedRequire(spec) {
    if (spec.includes("developmentStartupMaintenance")) {
      return { startupMaintenanceEnabled: () => policy(fakeProcess.env) };
    }
    if (spec === "express") return express;
    if (spec === "path") return { __esModule: true, default: path, ...path };
    if (spec === "fs") return { __esModule: true, default: {}, existsSync: () => false };
    if (moduleCache.has(spec)) return moduleCache.get(spec);
    const proxy = new Proxy(function() {}, {
      get: (_target, key) => {
        if (key === "__esModule") return true;
        if (key === "then") return undefined;
        if (key === "default") return proxy;
        if (key === "CRITICAL_COLUMNS") return [];
        return (...args) => {
          calls.push(String(key));
          if (/^run.*Migration$|^seed|^start.*Worker$|^init.*Cron$|^processDue|loadExistingReminders/.test(String(key))) {
            throw Error(`Prohibited startup work reached: ${String(key)}`);
          }
          return undefined;
        };
      },
      apply: () => noop,
    });
    moduleCache.set(spec, proxy);
    return proxy;
  }
  const source = read("server/index.ts").replaceAll("import.meta.dirname", JSON.stringify(path.join(root, "server")));
  vm.runInNewContext(transpile(source, "index.ts"), {
    require: mockedRequire, module: { exports: {} }, exports: {},
    process: fakeProcess, console: { log: noop, warn: noop, error: (...args) => { throw Error(args.join(" ")); } },
    Date, Buffer, setTimeout: (fn, delay) => { timers.push({ fn, delay }); return 1; },
    setInterval: () => { throw Error("Unexpected background interval registered"); },
    clearTimeout: noop, clearInterval: noop,
  }, { timeout: 10000 });
  await new Promise(resolve => setImmediate(resolve));
  check("mocked safe boot registers only the read-only warmup timer", () => {
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 2000);
  });
  check("mocked safe boot reaches all readiness assertions, billing readiness, routes and listen", () => {
    for (const name of ["assertStripeBillingSchema", "assertCorrelationIdColumn",
      "assertColumnsExist", "markStripeBillingReady", "registerRoutes", "setupVite", "listen"]) {
      assert.ok(calls.includes(name), `Not reached: ${name}`);
    }
  });
}
simulateSafeBoot().then(() => {
  console.log(`RESULT: ${checks} isolated checks passed; ${guardedTimers} guarded timers and ${guardedWriters} guarded writer calls inspected.`);
}).catch(error => { console.error(error); process.exitCode = 1; });
