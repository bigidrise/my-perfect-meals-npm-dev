import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import * as https from "node:https";
import * as net from "node:net";
import * as childProcess from "node:child_process";

if (!(globalThis as typeof globalThis & { __PAIRING_ADVISOR_OFFLINE__?: boolean }).__PAIRING_ADVISOR_OFFLINE__) {
  throw new Error("The guarded integration test configuration is required.");
}

describe("no external I/O and no live application activation", () => {
  test.each([
    () => globalThis.fetch("https://example.invalid"),
    () => https.request("https://example.invalid"),
    () => net.connect(443, "example.invalid"),
    () => childProcess.execFileSync("node", ["-e", "process.exit(0)"]),
  ])("I/O attempt %# is denied before execution", attempt => {
    expect(attempt).toThrow("PAIRING_ADVISOR_OFFLINE");
  });
  test.each([
    "openai", "pg", "@neondatabase/serverless", "@aws-sdk/client-s3",
    "../../db", "../../lib/auditLog", "../../services/safetyPinService",
  ])("%s cannot initialize a provider, database, audit or override store", moduleName => {
    expect(() => require(moduleName)).toThrow("PAIRING_ADVISOR_OFFLINE");
  });

  test("the complete new source graph excludes runtime database and provider dependencies", () => {
    const root = process.cwd();
    const ownFiles = ["shared/pairingAdvisor", "server/services/pairingAdvisor"]
      .flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => name.endsWith(".ts"))
        .map(name => path.join(root, dir, name)));
    const allowed = new Set([
      ...ownFiles,
      path.join(root, "server/routes/pairingAdvisor.ts"),
      path.join(root, "server/services/pairings/wineListIdentity.ts"),
    ]);
    for (const file of allowed) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          const specifier = node.moduleSpecifier;
          if (specifier && ts.isStringLiteral(specifier)) {
            const name = specifier.text;
            if (!["express", "zod"].includes(name)) {
              expect(name.startsWith(".")).toBe(true);
              expect(allowed.has(path.resolve(path.dirname(file), `${name}.ts`))).toBe(true);
            }
          }
        }
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
          if (ts.isIdentifier(node.expression)) {
            expect(["require", "eval", "Function", "fetch"]).not.toContain(node.expression.text);
          }
        }
        if (ts.isIdentifier(node)) {
          expect(["process", "globalThis", "localStorage", "sessionStorage", "WebSocket", "XMLHttpRequest"])
            .not.toContain(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  });

  test("the shared registration is conditional, default-denied and wired to existing security", () => {
    const text = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const source = ts.createSourceFile("routes.ts", text, ts.ScriptTarget.Latest, true);
    const calls: ts.CallExpression[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        && node.expression.text === "registerPairingAdvisor") calls.push(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    let parent: ts.Node | undefined = call.parent;
    while (parent && !ts.isIfStatement(parent)) parent = parent.parent;
    expect(parent && ts.isIfStatement(parent) && parent.expression.getText(source))
      .toBe('process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT');
    const options = call.arguments[1];
    expect(ts.isObjectLiteralExpression(options)).toBe(true);
    const binding = options.getText(source);
    expect(binding).toContain("authenticate: requireAuth");
    expect(binding).toContain("activeAccess: requireActiveAccess");
    expect(binding).toContain("proAccess: requireProAccess");
    expect(binding).not.toMatch(/synthetic|resolveAuthority|generate|classify|review/);
    expect(call.getStart(source)).toBeLessThan(text.indexOf('app.use("/api/ai", requireAuth, requireActiveAccess)'));
    // No top-level advisor import can activate dependencies in Production.
    expect(source.statements.filter(ts.isImportDeclaration)
      .some(node => node.moduleSpecifier.getText(source).includes("pairingAdvisor"))).toBe(false);
  });
});
