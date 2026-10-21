import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import * as net from "node:net";
import { harness } from "./fixtures";

if (!(globalThis as typeof globalThis & { __PAIRING_ADVISOR_OFFLINE__?: boolean }).__PAIRING_ADVISOR_OFFLINE__) {
  throw new Error("The guarded offline readiness configuration is required");
}
describe("A–C: isolation, denied application binding and prohibited execution", () => {
  test.each(["openai", "pg", "@neondatabase/serverless", "@aws-sdk/client-s3", "axios", "undici"])(
    "%s cannot initialize a real client", moduleName => {
      expect(() => require(moduleName)).toThrow("PAIRING_ADVISOR_OFFLINE");
    },
  );
  test("network calls are denied before sockets or fetch can execute", () => {
    expect(() => globalThis.fetch("https://example.invalid")).toThrow("PAIRING_ADVISOR_OFFLINE");
    expect(() => net.connect(443, "example.invalid")).toThrow("PAIRING_ADVISOR_OFFLINE");
  });
  test("the runtime import closure has only approved pure modules, crypto IDs and Zod", () => {
    const visited = new Set<string>();
    const visitFile = (file: string): void => {
      if (visited.has(file)) return;
      visited.add(file);
      const text = fs.readFileSync(file, "utf8");
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return;
          if (ts.isExportDeclaration(node) && node.isTypeOnly) return;
          const specifier = node.moduleSpecifier;
          if (specifier && ts.isStringLiteral(specifier)) {
            if (!["zod", "node:crypto"].includes(specifier.text)) {
              expect(specifier.text.startsWith(".")).toBe(true);
              const resolved = path.resolve(path.dirname(file), `${specifier.text}.ts`);
              expect(resolved).toMatch(/\/(?:shared\/pairingAdvisor|server\/services\/pairingAdvisor|server\/services\/pairings\/wineListIdentity\.ts)/);
              visitFile(resolved);
            }
          }
        }
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
          if (ts.isIdentifier(node.expression)) expect(["require", "eval", "fetch", "Function"]).not.toContain(node.expression.text);
        }
        if (ts.isIdentifier(node)) {
          expect(["process", "localStorage", "sessionStorage", "XMLHttpRequest", "WebSocket"]).not.toContain(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    };
    visitFile(path.resolve("server/services/pairingAdvisor/readiness/controller.ts"));
    expect(visited.size).toBeGreaterThan(10);
    expect([...visited].some(file => /strictOwnerProtocolResolution|\/db\.ts|safetyPinService/.test(file))).toBe(false);
  });
  test("no running application or existing prototype imports the new readiness implementation", () => {
    for (const file of [
      "server/routes.ts", "server/prod.ts", "server/devBootstrap.ts",
      "server/routes/pairingAdvisor.ts", "server/services/pairingAdvisor/register.ts",
      "artifacts/mockup-sandbox/src/pairing-advisor/useSyntheticAdvisor.ts",
    ]) expect(fs.readFileSync(file, "utf8")).not.toContain("/readiness/");
    const text = fs.readFileSync("server/routes.ts", "utf8");
    expect(text).toContain("Advisor integration is deny-by-default");
    expect(text).toContain('process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT');
    const route = fs.readFileSync("server/routes/pairingAdvisor.ts", "utf8");
    expect(route).toContain("ADVISOR_NOT_ACTIVATED");
  });
  test("the offline harness records no customer storage calls", async () => {
    const storage = require("../pairingAdvisorSafety/storageStub.cjs");
    storage.reset();
    expect((await harness().send()).status).toBe("accepted");
    expect(storage.calls.connects).toBe(0);
    expect(storage.calls.direct).toEqual([]);
    expect(storage.calls.client).toEqual([]);
    expect(storage.calls.selects).toEqual([]);
    expect(storage.calls.inserts).toBe(0);
  });
});
