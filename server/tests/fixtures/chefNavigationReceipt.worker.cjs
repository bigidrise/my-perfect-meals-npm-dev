const { parentPort, workerData } = require("node:worker_threads");
const { PGlite } = require("@electric-sql/pglite");

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE coach_conversations (id text PRIMARY KEY, owner_id text, specialization text, status text);
      CREATE TABLE coach_messages (id text PRIMARY KEY, conversation_id text, role text,
        structured_payload jsonb, created_at timestamptz DEFAULT now());
      INSERT INTO coach_conversations VALUES ('own', 'synthetic-owner', 'corner', 'open'),
        ('other', 'other-owner', 'corner', 'open');
    `);
    const time = new Date().toISOString();
    for (const [id, conversationId, offeredAt, button] of [
      ["synthetic-message", "own", time, true], ["preserved", "own", time, false],
      ["superseding", "own", new Date(Date.now() + 1).toISOString(), true],
      ["foreign", "other", time, true],
    ]) {
      await db.query("INSERT INTO coach_messages (id, conversation_id, role, structured_payload) VALUES ($1,$2,'assistant',$3)", [
        id, conversationId, JSON.stringify({ presentation: {
          ...(button ? { destinationId: "beverage_creator" } : {}),
          navigation: { state: "navigation_confirmed", destinationId: "beverage_creator", offeredAt },
        } }),
      ]);
    }
    // Changing only the owner must never mutate another member's handoff.
    const wrongOwner = workerData.params.map(value => value === "synthetic-owner" ? "other-owner" : value);
    const rejected = await db.query(workerData.sql, wrongOwner);
    const accepted = await db.query(workerData.sql, workerData.params);
    const state = await db.query("SELECT id, structured_payload #>> '{presentation,navigation,performedAt}' AS performed FROM coach_messages ORDER BY id");
    parentPort.postMessage({ rejected: rejected.rows.length, updated: accepted.rows.map(row => row.id).sort(), state: state.rows });
  } finally { await db.close(); }
})().catch(error => { parentPort.postMessage({ error: String(error) }); });
