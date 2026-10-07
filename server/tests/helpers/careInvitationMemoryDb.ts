import { getTableColumns, getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

export let records: Record<string, any[]> = {};
const dialect = new PgDialect();
let transactionTail = Promise.resolve();
function matches(table: any, row: any, where: any) {
  if (!where) return true;
  const query = dialect.sqlToQuery(where);
  const columns = getTableColumns(table);
  const nameToKey = Object.fromEntries(Object.entries(columns).map(([key, column]: any) => [column.name, key]));
  const checks: boolean[] = [];
  const pattern = /"[^"]+"\."([^"]+)"(?:::text)?\s*(=|>|is null)\s*(?:\$(\d+))?/gi;
  for (const match of query.sql.matchAll(pattern)) {
    const value = row[nameToKey[match[1]]];
    const expected = query.params[Number(match[3]) - 1];
    checks.push(match[2].toLowerCase() === "is null" ? value == null
      : match[2] === ">" ? new Date(value).getTime() > new Date(expected as any).getTime()
      : value === expected);
  }
  // The auto-accept email predicate is intentionally normalization-aware.
  const normalized = /lower\(trim\("[^"]+"\."email"\)\)\s*=\s*\$(\d+)/i.exec(query.sql);
  if (normalized) checks.push(String(row.email).trim().toLowerCase() === query.params[Number(normalized[1]) - 1]);
  return /\bor\b/i.test(query.sql) ? checks.some(Boolean) : checks.every(Boolean);
}
function query(operation: "select" | "insert" | "update" | "delete", selection?: any, initialTable?: any) {
  let table = initialTable, where: any, value: any, limit: number | undefined;
  const builder: any = {
    from(next: any) { table = next; return builder; },
    where(next: any) { where = next; return builder; },
    values(next: any) { value = next; return builder; },
    set(next: any) { value = next; return builder; },
    limit(next: number) { limit = next; return builder; },
    for() { return builder; }, orderBy() { return builder; }, innerJoin() { return builder; },
    returning() { return builder; },
    then(resolve: any, reject: any) {
      try {
        const name = getTableName(table);
        const rows = records[name] ?? (records[name] = []);
        let result: any[];
        if (operation === "insert") {
          const inserted = { id: randomUUID(), status: "active", isArchived: false,
            organizationId: null, locationId: null, sourceBusinessId: null, partnerRecordId: null, ...value };
          rows.push(inserted); result = [inserted];
        } else {
          result = rows.filter(row => matches(table, row, where));
          if (operation === "update") result.forEach(row => Object.assign(row, value));
          if (operation === "delete") records[name] = rows.filter(row => !result.includes(row));
        }
        if (limit !== undefined) result = result.slice(0, limit);
        if (selection && operation === "select") {
          const columns = getTableColumns(table);
          result = result.map(row => Object.fromEntries(Object.entries(selection).map(([key, column]: any) => {
            const source = Object.entries(columns).find(([, candidate]: any) => candidate.name === column.name)?.[0];
            return [key, row[source ?? key]];
          })));
        }
        return Promise.resolve(structuredClone(result)).then(resolve, reject);
      } catch (error) { return Promise.reject(error).then(resolve, reject); }
    },
  };
  return builder;
}
export const mockInvitationDb: any = {
  select: (selection?: any) => query("select", selection),
  insert: (table: any) => query("insert", undefined, table),
  update: (table: any) => query("update", undefined, table),
  delete: (table: any) => query("delete", undefined, table),
  execute: async () => ({ rows: [] }),
  async transaction(work: any) {
    const previous = transactionTail;
    let unlock!: () => void;
    transactionTail = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    const before = structuredClone(records);
    try { return await work(mockInvitationDb); }
    catch (error) { records = before; throw error; }
    finally { unlock(); }
  },
};
export function resetInvitationRecords(data: Record<string, any[]>) {
  records = structuredClone(data);
}
