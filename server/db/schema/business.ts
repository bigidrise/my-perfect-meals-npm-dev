import { pgTable, uuid, text, timestamp, integer, unique } from "drizzle-orm/pg-core";

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("clinical_business_monthly"),
  seatLimit: integer("seat_limit").notNull().default(4),
  status: text("status").$type<"active" | "cancelled" | "past_due">().notNull().default("active"),
  /**
   * FK to the organizations table — links this commercial team product to
   * the enterprise tenant backbone. Nullable: not all businesses have a
   * full org record yet. Phase 2 will enforce this relationship.
   */
  organizationId: uuid("organization_id"),
  /**
   * Controls whether providers in this business may maintain independently-
   * sourced clients alongside organization-assigned clients.
   *   "org_only"                  – org clients only; no independent practice
   *   "allowed"                   – independent clients permitted (silent)
   *   "allowed_with_disclosure"   – independent clients permitted; owner sees
   *                                 counts but NOT clinical data of those clients
   * Default is "allowed_with_disclosure" — safest for launch.
   */
  independentClientPolicy: text("independent_client_policy")
    .$type<"org_only" | "allowed" | "allowed_with_disclosure">()
    .default("allowed_with_disclosure"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;

export const businessMembers = pgTable("business_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").$type<"owner" | "coach" | "trainer" | "physician" | "staff">().notNull().default("staff"),
  status: text("status").$type<"active" | "removed">().notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqBusinessUser: unique().on(t.businessId, t.userId),
}));

export type BusinessMember = typeof businessMembers.$inferSelect;
export type InsertBusinessMember = typeof businessMembers.$inferInsert;

export const businessInvitations = pgTable("business_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  role: text("role").$type<"coach" | "trainer" | "physician" | "staff">().notNull().default("staff"),
  status: text("status").$type<"pending" | "accepted" | "cancelled" | "expired">().notNull().default("pending"),
  invitedByUserId: text("invited_by_user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByUserId: text("accepted_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BusinessInvitation = typeof businessInvitations.$inferSelect;
export type InsertBusinessInvitation = typeof businessInvitations.$inferInsert;
