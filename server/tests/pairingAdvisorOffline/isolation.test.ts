import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import * as tls from "node:tls";
import * as dns from "node:dns";
import * as childProcess from "node:child_process";

// Fail at suite load, before any test can attempt I/O through a different Jest config.
if (!(globalThis as typeof globalThis & { __PAIRING_ADVISOR_OFFLINE__?: boolean }).__PAIRING_ADVISOR_OFFLINE__) {
  throw new Error("Use server/tests/pairingAdvisorOffline/jest.config.cjs; offline guards are required.");
}

describe("offline harness (cross-cutting acceptance boundary)", () => {
  test.each([
    ["fetch", () => globalThis.fetch("https://example.invalid")],
    ["http", () => http.request("http://example.invalid")],
    ["https", () => https.get("https://example.invalid")],
    ["net", () => net.connect(443, "example.invalid")],
    ["socket", () => new net.Socket().connect(443, "example.invalid")],
    ["tls", () => tls.connect(443, "example.invalid")],
    ["dns", () => dns.lookup("example.invalid", () => undefined)],
    ["dns promises", () => dns.promises.resolve("example.invalid")],
    ["subprocess", () => childProcess.execFileSync("node", ["-e", "process.exit(0)"])],
    ["WebSocket", () => new WebSocket("wss://example.invalid")],
  ])("%s is blocked locally before external I/O", (_name, attempt) => {
    expect(attempt).toThrow("PAIRING_ADVISOR_OFFLINE");
  });

  test.each(["openai", "pg", "@neondatabase/serverless", "axios", "undici", "@aws-sdk/client-s3"])(
    "%s import cannot instantiate a provider or database client", moduleName => {
      expect(() => require(moduleName)).toThrow("PAIRING_ADVISOR_OFFLINE");
    },
  );

  test("production sources have a closed pure import graph with no runtime adapters", () => {
    const root = process.cwd();
    // Preserve Increment 1's pure closure; Increment 2's separate suite checks its router graph.
    const ownFiles = [
      "shared/pairingAdvisor/contracts.ts", "shared/pairingAdvisor/conversation.ts",
      "server/services/pairingAdvisor/policy.ts", "server/services/pairingAdvisor/prompts.ts",
      "server/services/pairingAdvisor/validation.ts",
    ].map(file => path.join(root, file));
    const identityFile = path.join(root, "server/services/pairings/wineListIdentity.ts");
    const allowed = new Set([...ownFiles, identityFile]);
    for (const file of allowed) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          const specifier = node.moduleSpecifier;
          if (specifier && ts.isStringLiteral(specifier)) {
            const moduleName = specifier.text;
            if (moduleName === "zod") {
              // Only approved external runtime dependency; no application entrypoint.
            } else {
              expect(moduleName.startsWith(".")).toBe(true);
              expect(allowed.has(path.resolve(path.dirname(file), `${moduleName}.ts`))).toBe(true);
            }
          }
        }
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
          if (ts.isIdentifier(node.expression)) {
            expect(["require", "eval", "Function", "fetch"]).not.toContain(node.expression.text);
          }
        }
        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
          expect(["Function", "WebSocket", "Worker"]).not.toContain(node.expression.text);
        }
        if (ts.isIdentifier(node)) {
          expect(["process", "globalThis", "localStorage", "sessionStorage", "XMLHttpRequest"])
            .not.toContain(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  });
});
