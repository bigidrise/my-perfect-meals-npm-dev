import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const stripeIdentityOwners = pgTable("stripe_identity_owners", {
  identityType: varchar("identity_type", { length: 32 }).notNull(),
  identityValue: varchar("identity_value", { length: 255 }).notNull(),
  ownerUserId: varchar("owner_user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.identityType, table.identityValue] }),
  ownerIdx: index("stripe_identity_owners_owner_idx")
    .on(table.ownerUserId, table.businessId),
}));

export const stripeBillingEvents = pgTable("stripe_billing_events", {
  eventId: varchar("event_id", { length: 255 }).primaryKey(),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  eventCreatedAt: timestamp("event_created_at", { withTimezone: true }).notNull(),
  customerId: varchar("customer_id", { length: 255 }),
  subscriptionId: varchar("subscription_id", { length: 255 }),
  userId: varchar("user_id", { length: 255 }),
  source: varchar("source", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("processing"),
  attempts: integer("attempts").notNull().default(1),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  subscriptionEventIdx: index("stripe_billing_events_subscription_idx")
    .on(table.subscriptionId, table.eventCreatedAt),
  statusUpdatedIdx: index("stripe_billing_events_status_idx")
    .on(table.status, table.updatedAt),
}));
