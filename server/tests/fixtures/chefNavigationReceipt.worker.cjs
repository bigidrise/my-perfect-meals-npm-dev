const { parentPort, workerData } = require("node:worker_threads");
const { PGlite } = require("@electric-sql/pglite");

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE coach_conversations (id text PRIMARY KEY, owner_id text, specialization text, status text);
      CREATE TABLE coach_messages (id text PRIMARY KEY, conversation_id text, role text,
        structured_payload jsonb, created_at timestamptz DEFAULT now());
      INSERT INTO coach_conversations VALUES ('own','synthetic-owner','corner','open'),
        ('other','other-owner','corner','open');
    `);
    // Use the query's timestamp, not a later wall clock, for deterministic bounds.
    const times = workerData.params.filter(value => typeof value === "string" && /^\d{4}-/.test(value)).sort();
    const time = times[times.length - 2];
    for (const [id, conversationId, offeredAt, button, state] of [
      ["synthetic-message", "own", time, true, "navigation_confirmed"],
      ["preserved", "own", time, false, "navigation_confirmed"],
      ["superseding", "own", new Date(Date.parse(time) - 1).toISOString(), true, "navigation_confirmed"],
      ["foreign", "other", time, true, "navigation_confirmed"],
      ["expired", "own", new Date(Date.parse(time) - 31 * 60_000).toISOString(), true, "navigation_confirmed"],
      ["pending", "own", new Date(Date.parse(time) - 2).toISOString(), true, "recommendation_pending"],
    ]) {
      await db.query("INSERT INTO coach_messages (id,conversation_id,role,structured_payload) VALUES ($1,$2,'assistant',$3)", [
        id, conversationId, JSON.stringify({ presentation: {
          ...(button ? { destinationId: "beverage_creator" } : {}),
          navigation: { state, destinationId: "beverage_creator", offeredAt },
        } }),
      ]);
    }
    const swap = (from, to) => workerData.params.map(value => value === from ? to : value);
    const rejected = [];
    for (const params of [swap("synthetic-owner", "other-owner"), swap("beverage_creator", "restaurant_guide"),
      swap("synthetic-message", "expired"), swap("synthetic-message", "pending")]) {
      rejected.push((await db.query(workerData.sql, params)).rows.length);
    }
    const accepted = await db.query(workerData.sql, workerData.params);
    const state = await db.query("SELECT id,structured_payload #>> '{presentation,navigation,performedAt}' AS performed FROM coach_messages ORDER BY id");
    parentPort.postMessage({ rejected, updated: accepted.rows.map(row => row.id).sort(), state: state.rows });
  } finally { await db.close(); }
})().catch(error => { parentPort.postMessage({ error: String(error) }); });
