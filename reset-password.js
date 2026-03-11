import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const email = process.argv[2];
  const hash = process.argv[3];

  if (!email || !hash) {
    console.error('Usage: node reset-password.js <email> <bcrypt-hash>');
    process.exit(1);
  }

  await client.connect();

  const db = await client.query('select current_database() as db;');
  console.log('Database:', db.rows[0].db);

  const result = await client.query(
    `UPDATE users SET password = $1 WHERE email = $2 RETURNING email;`,
    [hash, email]
  );

  console.log('Updated rows:', result.rowCount);
  console.log('Result:', result.rows);

  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
