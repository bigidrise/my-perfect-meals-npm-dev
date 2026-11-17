import pg from "pg";

// Existing external application database, SELECT only. Never logs addresses or credentials.
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout='15000ms'");
  const { rows } = await client.query(
    "SELECT id,email,stripe_customer_id,stripe_subscription_id FROM users ORDER BY id",
  );
  const groups = new Map();
  let noncanonicalRows = 0;
  for (const row of rows) {
    const key = row.email.trim().toLowerCase();
    if (key !== row.email) noncanonicalRows++;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const collisions = [...groups.values()].filter(group => group.length > 1);
  console.log(JSON.stringify({
    accountCount: rows.length, noncanonicalRows, duplicateGroups: collisions.length,
    duplicateAccounts: collisions.reduce((total, group) => total + group.length, 0),
    groups: collisions.map(group => ({
      userIds: group.map(row => row.id),
      usersWithSelectedStripeSubscription: group.filter(row => row.stripe_subscription_id).length,
      requiresIndividualOwnershipReview: true,
    })),
  }, null, 2));
  await client.query("ROLLBACK");
} finally { await client.end(); }
