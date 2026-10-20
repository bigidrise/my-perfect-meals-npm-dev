// Memory-only replacement loaded BEFORE every module that imports application db.
// Nothing in this file constructs a database driver, session store, or connection.
const calls = { direct: [], client: [], clients: [], inserts: 0, selects: [], executions: 0, connects: 0, releases: 0 };
const state = { rows: [], executeRows: null, allowMaterialization: false };
async function query(text, values) {
  calls.direct.push([text, values]);
  return { rows: [] };
}
const pool = {
  query,
  async connect() {
    calls.connects++;
    const queries = [];
    calls.clients.push(queries);
    return {
      query(text, values, callback) {
        queries.push(String(text));
        calls.client.push([text, values]);
        const done = typeof values === "function" ? values : callback;
        if (String(text).includes("synthetic_write_function")) {
          const error = Object.assign(new Error("Synthetic READ ONLY rejection"), { code: "25006" });
          if (done) { queueMicrotask(() => done(error)); return; }
          return Promise.reject(error);
        }
        const result = { rows: [] };
        if (done) { queueMicrotask(() => done(null, result)); return; }
        return Promise.resolve(result);
      },
      release() { calls.releases++; },
    };
  },
};
const db = {
  select(selection) {
    calls.selects.push(selection);
    const run = async () => {
      await pool.query("SELECT synthetic_fixture");
      const rows = state.rows.shift();
      if (!rows) throw new Error("Unexpected synthetic read; no live fallback");
      return selection
        ? rows.map(row => Object.fromEntries(Object.keys(selection).map(key => [key, row[key]])))
        : rows;
    };
    const chain = {
      from() { return chain; }, where() { return chain; },
      orderBy() { return chain; }, limit() { return run(); },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return chain;
  },
  insert() {
    calls.inserts++;
    const chain = {
      values() { return chain; },
      onConflictDoUpdate() {
        // Baseline materialization is recorded only when explicitly allowed by the test.
        // Inside no-save execution this branch must never run.
        return state.allowMaterialization ? Promise.resolve() : pool.query("INSERT INTO synthetic_prescriptions DEFAULT VALUES");
      },
      then(resolve, reject) { return pool.query("INSERT INTO synthetic_audit DEFAULT VALUES").then(resolve, reject); },
      catch(reject) { return pool.query("INSERT INTO synthetic_audit DEFAULT VALUES").catch(reject); },
    };
    return chain;
  },
  async execute() {
    calls.executions++;
    await pool.query("SELECT synthetic_guardrails");
    if (!state.executeRows) throw new Error("Unexpected synthetic execute; no live fallback");
    return { rows: state.executeRows };
  },
  update() { return pool.query("UPDATE synthetic_fixture SET value=1"); },
  delete() { return pool.query("DELETE FROM synthetic_fixture"); },
};
function reset() {
  calls.direct.length = calls.client.length = calls.selects.length = 0;
  calls.clients.length = 0;
  calls.inserts = calls.executions = calls.connects = calls.releases = 0;
  state.rows = [];
  state.executeRows = null;
  state.allowMaterialization = false;
}
module.exports = { pool, db, calls, state, reset };
