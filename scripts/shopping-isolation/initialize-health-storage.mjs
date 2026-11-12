// Applies the exact SQL from existing migration scripts without importing their
// external-database launchers, backfills, or application modules.
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { verifyIsolatedDatabase } from "./target.mjs";

const allFiles = [
  "scripts/migrate-health-protocols-dev.ts",
  "scripts/migrate-clinical-directives-dev.ts",
  "scripts/migrate-phase1-clinical-studio.ts",
];
const files = process.argv.includes("--clinical-studio-only") ? allFiles.slice(2) : allFiles;
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return literal(node.left) + literal(node.right);
  }
  throw new Error("Dynamic SQL requires review; refusing execution.");
}
const batches = [];
for (const file of files) {
  const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
  const statements = [];
  function visit(node) {
    if (file.endsWith("/migrate-phase1-clinical-studio.ts") &&
        ts.isVariableDeclaration(node) && node.name.getText(source) === "migrations" &&
        node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      const existing = node.initializer.elements.map(literal);
      if (existing.length !== 6 || existing.some(sql =>
        !/^(ALTER TABLE organizations\s+ADD COLUMN IF NOT EXISTS|CREATE (TABLE|INDEX|UNIQUE INDEX))/i.test(sql.trim()))) {
        throw new Error("Clinical Studio schema array changed; inspect before execution.");
      }
      statements.push(...existing);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === "client" && node.expression.name.text === "query") {
      const sql = literal(node.arguments[0]).trim();
      if (!/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT)\b/i.test(sql)) {
        if (!/^(CREATE (TABLE|INDEX|UNIQUE INDEX|OR REPLACE FUNCTION)|DO \$\$)/i.test(sql)) {
          throw new Error(`Unaudited operation in ${file}; stopped.`);
        }
        // Both reviewed DO bodies only add protective triggers conditionally.
        if (/\b(DROP|TRUNCATE|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b|\bEXECUTE\s+(?!FUNCTION\b)/i.test(sql)) {
          throw new Error(`Potential data mutation in ${file}; stopped.`);
        }
        statements.push(sql);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!statements.length) throw new Error(`No existing migration SQL identified in ${file}.`);
  batches.push({ file, statements });
}
const client = await verifyIsolatedDatabase();
try {
  for (const table of ["users", "studios", "studio_memberships", "organizations"]) {
    const { rows } = await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${table}`]);
    if (!rows[0].present) throw new Error(`Missing audited dependency ${table}.`);
  }
  for (const batch of batches) {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("SET LOCAL statement_timeout='30s'");
      for (const sql of batch.statements) await client.query(sql);
      await client.query("COMMIT");
      console.log(`Applied ${batch.statements.length} exact schema-only statements from ${batch.file}.`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
} finally { await client.end(); }
