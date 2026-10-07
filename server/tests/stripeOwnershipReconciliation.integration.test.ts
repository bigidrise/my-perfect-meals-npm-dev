import { Client } from "pg";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { getDatabaseTlsConfig } from "../lib/databaseTls";
import { runStripeOwnershipReconciliation } from "../db/migrations/runStripeBillingMigration";
import { claimStripeIdentityOwnership } from "../services/stripeIdentityOwnershipService";
import { handleStripeMigrationFailure } from "../services/stripeMigrationReview";

describe("Stripe ownership reconciliation (isolated PostgreSQL; always rollback)",()=>{
  let client:Client;
  const dialect=new PgDialect();
  const reconcile=()=>runStripeOwnershipReconciliation({execute: async query=>{
    const q=dialect.sqlToQuery(query); return client.query(q.sql,q.params);
  }});
  beforeEach(async()=>{
    if(!process.env.DATABASE_URL)throw new Error("PostgreSQL required for ownership integration tests");
    client=new Client({connectionString:process.env.DATABASE_URL,ssl:getDatabaseTlsConfig(process.env.DATABASE_URL)});
    await client.connect();await client.query("BEGIN");
    const schema="billing_test_"+randomUUID().replace(/-/g,"");
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path="${schema}",pg_catalog;
      CREATE TABLE users(id text PRIMARY KEY,stripe_customer_id text,stripe_subscription_id text);
      CREATE TABLE businesses(id text PRIMARY KEY,owner_user_id text,stripe_customer_id text,stripe_subscription_id text,status text);
      CREATE TABLE stripe_identity_owners(identity_type text,identity_value text,owner_user_id text,business_id text,
        created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),PRIMARY KEY(identity_type,identity_value));
      INSERT INTO businesses VALUES ('fictional-business','fictional-owner','cus_fictional','sub_fictional','active');`);
  },30000);
  afterEach(async()=>{if(client){try{await client.query("ROLLBACK");}finally{await client.end();}}});

  test("same owner in personal and Business scopes still conflicts; no silent transfer",async()=>{
    await client.query("INSERT INTO users VALUES ('fictional-owner','cus_fictional','sub_fictional')");
    await client.query("SAVEPOINT scope_check");
    await expect(reconcile()).rejects.toThrow("Conflicting Stripe identity ownership requires manual review");
    await client.query("ROLLBACK TO SAVEPOINT scope_check");
    expect((await client.query("SELECT * FROM businesses")).rows[0]).toMatchObject({
      status:"active",owner_user_id:"fictional-owner",stripe_customer_id:"cus_fictional",stripe_subscription_id:"sub_fictional",
    });
    expect((await client.query("SELECT * FROM users")).rows[0].stripe_subscription_id).toBe("sub_fictional");
  });
  test("organization ownership remains intact and does not confer a personal billing claim",async()=>{
    await reconcile();
    await expect(claimStripeIdentityOwnership(drizzle(client),{
      ownerUserId:"fictional-owner",stripeCustomerId:"cus_fictional",stripeSubscriptionId:"sub_fictional",
    })).rejects.toThrow("different billing subject");
    const registry=(await client.query("SELECT * FROM stripe_identity_owners")).rows;
    expect(registry).toHaveLength(2);
    expect(registry.every(row=>row.business_id==="fictional-business")).toBe(true);
    expect((await client.query("SELECT * FROM businesses")).rows[0].status).toBe("active");
  });
  test("repeat reconciliation and exact Business claims are idempotent",async()=>{
    await reconcile();await reconcile();
    await claimStripeIdentityOwnership(drizzle(client),{
      ownerUserId:"fictional-owner",businessId:"fictional-business",stripeCustomerId:"cus_fictional",stripeSubscriptionId:"sub_fictional",
    });
    expect((await client.query("SELECT count(*) AS n FROM stripe_identity_owners")).rows[0].n).toBe("2");
  });
  test("only the real known conflict is downgraded after a schema check; unexpected errors stop startup",async()=>{
    await client.query("INSERT INTO users VALUES ('fictional-owner','cus_fictional','sub_fictional')");
    await client.query("SAVEPOINT conflict");
    let error:unknown;
    try{await reconcile();}catch(e){error=e;}
    await client.query("ROLLBACK TO SAVEPOINT conflict");
    const guard=jest.fn(async()=>{}),warning=jest.fn();
    await handleStripeMigrationFailure(error,guard,warning);
    expect(guard).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledTimes(1);
    const unexpected=Object.assign(new Error("fictional unexpected failure"),{code:"XX000"});
    await expect(handleStripeMigrationFailure(unexpected,guard,warning)).rejects.toBe(unexpected);
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
