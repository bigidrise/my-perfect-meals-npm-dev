import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, JsxEmit, transpileModule } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
function render(status: string, selfReview = false) {
  let cursor = 0;
  const review = {
    status, selfReview, required: true, revision: 4, reviewedCredentialHash: "a".repeat(64),
    approvalEventId: "bff13b2d-7f33-4ff4-8be3-44a5c67c0d22", latestDecision: null,
    evidence: { accountRole: "physician", accountCredentials: {}, approvedClaims: {} },
  };
  const exports: Record<string, any> = {};
  const source = transpileModule(readFileSync("client/src/components/admin/ProfessionalCredentialReview.tsx", "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(source, { exports, require: (name: string) => {
    if (name === "react") return {
      useState: (initial: unknown) => [({ 0: review, 1: "fictional-clinician", 2: true, 3: false } as Record<number, unknown>)[cursor++] ?? initial, () => {}],
      useEffect: () => {}, useCallback: (fn: unknown) => fn,
    };
    if (name === "@/contexts/AuthContext") return { useAuth: () => ({ user: { id: "fictional-reviewer" } }) };
    if (name === "react/jsx-runtime") return require("react/jsx-runtime");
    return {};
  } });
  return renderToStaticMarkup(createElement(exports.default, { requestId: "fictional-request", onSaved: () => {} }));
}
test("stale prior evidence warns but does not hide the explicit renewal form", () => {
  const html = render("stale");
  expect(html).toContain("Prior credential evidence");
  expect(html).toContain("Issuing authority");
  expect(html).toContain("Save credential decision");
  expect(html).toContain('type="radio"');
  expect(html).not.toContain('type="radio" checked');
});
test.each([["demo_only", false], ["not_eligible", false], ["pending", true]] as const)("blocked status %s cannot expose a decision form", (status, self) => {
  expect(render(status, self)).not.toContain("Save credential decision");
});
