// Test-only Vite metadata for CommonJS ts-jest. Does not mock tested modules,
// remove assertions or change application feature gates.
const ts = require("typescript");
module.exports = {
  name: "test-vite-import-meta-env",
  version: 1,
  factory: () => context => source => {
    function visit(node) {
      if (ts.isPropertyAccessExpression(node) && node.name.text === "env" &&
          ts.isMetaProperty(node.expression) &&
          node.expression.keywordToken === ts.SyntaxKind.ImportKeyword) {
        return ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment("DEV", ts.factory.createTrue()),
          ts.factory.createPropertyAssignment("PROD", ts.factory.createFalse()),
          ts.factory.createPropertyAssignment("MODE", ts.factory.createStringLiteral("test")),
        ]);
      }
      return ts.visitEachChild(node, visit, context);
    }
    return ts.visitNode(source, visit);
  },
};
