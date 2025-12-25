import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  const email =
    "https://my-perfect-meals-production-do-not-touch--bigidrise.replit.app";

  const result = await client.query(
    `
    UPDATE users
    SET password = $1
    WHERE email = $2
    RETURNING email;
    `,
    ["$2b$10$D2o66v0UZ.CxGY.vrCu7ierVlKYvKvWgDUnJDm0pevBtsalIbW8l6", email],
  );

  console.log("Updated rows:", result.rowCount);
  console.log("Result:", result.rows);

  await client.end();
}

run().catch(console.error);
