import fs from "node:fs";
import ts from "typescript";

test.each([
  [{ quantity: 2, amount: 5 }, 2],
  [{ quantity: "", amount: 250 }, 250],
  [{ quantity: null, amount: 125 }, 125],
  [{ amount: 75 }, 75],
  [{ quantity: 0, amount: 100 }, 0],
  [{ quantity: "", amount: 0 }, 0],
  [{ quantity: "", amount: null }, ""],
])("MealCard preserves ingredient quantity fallback for %j", (ingredient, expected) => {
  const file = "client/src/components/MealCard.tsx";
  const tree = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "qty" &&
        node.initializer?.getText(tree).includes("ing.quantity")) {
      expression = node.initializer;
    }
    ts.forEachChild(node, visit);
  }

  visit(tree);
  if (!expression) throw new Error("MealCard ingredient quantity expression not found");

  const js = ts.transpileModule(`return (${expression.getText(tree)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;

  const actual = new Function("ing", js);
  expect(actual(ingredient)).toBe(expected);
});
