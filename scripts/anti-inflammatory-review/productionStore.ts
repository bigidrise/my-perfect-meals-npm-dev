/** Offline SQL fixture. No database client, credentials, provider or network.
 * Unexpected SQL fails rather than falling back to application storage. */
export function createProductionSupportStore() {
  type Source = {
    id: string; subject_user_id: string; protocol_key: string; source_kind: string;
    evidence_ref: string; status: string; owner_user_id: string | null;
  };
  const sources: Source[] = [];
  const events: { sourceId: string; reason: string }[] = [];
  const preferences = new Map<string, boolean>([["synthetic-a", false], ["synthetic-b", false]]);
  const calls: { sql: string; args: unknown[] }[] = [];
  let snapshot: { sources: Source[]; events: typeof events; preferences: [string, boolean][] } | undefined;
  const store = {
    sources, events, preferences, calls, failPreferenceWrite: false,
    async query(sql: string, args: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
      calls.push({ sql, args });
      const result = (rows: any[] = []) => ({ rows, rowCount: rows.length });
      if (sql === "BEGIN") {
        snapshot = { sources: structuredClone(sources), events: structuredClone(events), preferences: [...preferences] };
        return result();
      }
      if (sql === "ROLLBACK") {
        if (!snapshot) throw new Error("No fixture transaction");
        sources.splice(0, sources.length, ...snapshot.sources);
        events.splice(0, events.length, ...snapshot.events);
        preferences.clear(); snapshot.preferences.forEach(([key, value]) => preferences.set(key, value));
        snapshot = undefined; return result();
      }
      if (sql === "COMMIT") { snapshot = undefined; return result(); }
      if (sql.startsWith("SET LOCAL") || sql.includes("pg_advisory_xact_lock")) return result();
      if (sql.includes("FROM users u")) {
        return result(preferences.has(args[0]) ? [{ legacy_preference: String(preferences.get(args[0])) }] : []);
      }
      if (sql.includes("SELECT DISTINCT s.protocol_key")) {
        return result(sources.filter(row => row.subject_user_id === args[0] &&
          row.source_kind === "user" && row.evidence_ref === "personal_support" && row.status === "active")
          .map(row => ({ ...row, explicit_opt_in: events.some(e => e.sourceId === row.id && e.reason === args[1]) })));
      }
      if (sql.includes("SELECT id, status, owner_user_id FROM health_protocol_sources")) {
        return result(sources.filter(row => row.subject_user_id === args[0] && row.protocol_key === args[1] &&
          row.source_kind === args[2] && row.evidence_ref === args[3]));
      }
      if (sql.includes("INSERT INTO health_protocol_sources")) {
        if (!preferences.has(args[0])) throw new Error("Unknown synthetic subject");
        const row: Source = {
          id: `fixture-source-${sources.length + 1}`, subject_user_id: args[0], protocol_key: args[1],
          source_kind: args[2], evidence_ref: args[3], status: args[4], owner_user_id: args[5],
        };
        sources.push(row); return result([{ id: row.id }]);
      }
      if (sql.includes("UPDATE health_protocol_sources SET status=$1")) {
        const row = sources.find(item => item.id === args[5]);
        if (!row || row.source_kind !== "user") throw new Error("Not a personal source");
        row.status = args[0]; row.owner_user_id = args[1]; return result([{ id: row.id }]);
      }
      if (sql.includes("INSERT INTO health_protocol_events")) {
        events.push({ sourceId: args[0], reason: args[4] }); return result();
      }
      if (sql.includes("UPDATE users SET app_preferences")) {
        if (store.failPreferenceWrite) throw new Error("Synthetic preference write failure");
        if (!preferences.has(args[1])) throw new Error("Unknown synthetic subject");
        preferences.set(args[1], args[0]); return result();
      }
      throw new Error(`Unexpected isolated-fixture SQL: ${sql.slice(0, 120)}`);
    },
    async connect() { return { query: store.query, release() {} }; },
  };
  return store;
}
