import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const proAccounts = pgTable("pro_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeAccountId: text("stripe_account_id").notNull(),
  status: text("status").notNull().default("pending"), // pending|active|disabled
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clientLinks = pgTable("client_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientUserId: text("client_user_id").notNull(),
  proUserId: text("pro_user_id").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientUserId: text("client_user_id").notNull(),
  proUserId: text("pro_user_id").notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  planCode: text("plan_code").notNull().default("mpm_pro_2999"),
  status: text("status").notNull().default("active"), // active|canceled|past_due
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").notNull(),
  proUserId: text("pro_user_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  stripeTransferId: text("stripe_transfer_id"),
  status: text("status").notNull().default("succeeded"), // pending|succeeded|failed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
