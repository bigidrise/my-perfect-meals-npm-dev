/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";
import { mockupPreviewPlugin } from "../mockupPreviewPlugin";

let mockAllowed = false;
jest.mock("../prototypeIsolation", () => ({
  ...jest.requireActual("../prototypeIsolation"),
  prototypeDevelopmentAllowed: () => mockAllowed,
}));

const roots: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pairing-private-preview-"));
  roots.push(root);
  const publicFile = "src/components/mockups/Existing.tsx";
  const privateFile = "src/components/mockups/_development/pairing-advisor/PairingAdvisor.tsx";
  for (const file of [publicFile, privateFile]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "export function Example() { return null; }");
  }
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
test.each([true, false])("actual registry discovers private preview only when allowed: %s", async allowed => {
  mockAllowed = allowed;
  const root = fixture();
  const plugin = mockupPreviewPlugin() as any;
  const config = plugin.config({}, { command: allowed ? "serve" : "build", mode: allowed ? "development" : "production" });
  expect(config.define.__PAIRING_SYNTHETIC_PREVIEW__).toBe(JSON.stringify(allowed));
  plugin.configResolved({ root, command: allowed ? "serve" : "build", mode: allowed ? "development" : "production" });
  await plugin.buildStart();
  const registry = fs.readFileSync(path.join(root, "src/.generated/mockup-components.ts"), "utf8");
  expect(registry).toContain("Existing.tsx");
  expect(registry.includes("_development/pairing-advisor")).toBe(allowed);
});
test("denied private URL and source requests return 404 before the Vite pipeline", async () => {
  mockAllowed = false;
  const plugin = mockupPreviewPlugin() as any;
  plugin.configResolved({ root: fixture(), command: "serve", mode: "development" });
  const use = jest.fn();
  try {
    await plugin.configureServer({ middlewares: { use }, watcher: { on: jest.fn() } });
    const guard = use.mock.calls[0][0];
    for (const url of ["/preview/_development/pairing-advisor/PairingAdvisor", "/@fs/x/%255fdevelopment/PairingAdvisor.tsx"]) {
      const res = { statusCode: 0, end: jest.fn() }, next = jest.fn();
      guard({ url }, res, next);
      expect(res.statusCode).toBe(404);
      expect(next).not.toHaveBeenCalled();
    }
    const next = jest.fn();
    guard({ url: "/preview/Existing" }, { end: jest.fn() }, next);
    expect(next).toHaveBeenCalledTimes(1);
  } finally { await plugin.closeWatcher?.(); }
});
test("prototype source has no transport, persistence, auth, clinical authority or application dependencies", () => {
  const folder = path.resolve(__dirname, "../src/pairing-advisor");
  const inspect = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (/\.[jt]sx?$/.test(entry.name)) {
        const source = fs.readFileSync(file, "utf8");
        expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|\/api\/|strictOwnerProtocolResolution|from\s+["'][^"']*(?:server\/|AuthContext|apiRequest)/);
      }
    }
  };
  inspect(folder);
});
test("existing customer screens do not import or expose the prototype", () => {
  const unchanged = [
    "client/src/pages/lifestyle/PairingsAI.tsx", "client/src/pages/lifestyle/WineListHelper.tsx",
    "client/src/pages/ChefPairings.tsx", "client/src/components/Router.tsx",
  ];
  for (const file of unchanged) {
    expect(fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8"))
      .not.toMatch(/PairingAdvisor|AdvisorPanel|_development\/pairing-advisor/);
  }
});
