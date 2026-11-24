/** @jest-environment node */
import path from "node:path";
import ts from "typescript";

test("Shopping List has no undefined names that can crash its render", () => {
  const filename = path.resolve("client/src/pages/ShoppingListMasterView.tsx");
  // Check this page's bindings without loading its providers, database,
  // application state, or the full project's unrelated type-checking debt.
  const program = ts.createProgram([filename], {
    noEmit: true,
    noResolve: true,
    skipLibCheck: true,
    types: [],
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
  });
  const source = program.getSourceFile(filename)!;
  const missingNames = program.getSemanticDiagnostics(source)
    .filter((diagnostic) => diagnostic.code === 2304)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  expect(missingNames).toEqual([]);
});
