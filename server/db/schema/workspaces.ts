import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const organizationLocations = pgTable("organization_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").$type<"active" | "inactive">().notNull().default("active"),
  isDefault: boolean("is_default").notNull().default(false),
  sourceBusinessId: uuid("source_business_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sourceBusinessUnique: uniqueIndex("organization_locations_source_business_uniq")
    .on(t.sourceBusinessId),
}));

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role")
    .$type<"owner" | "admin" | "billing_admin" | "member">()
    .notNull()
    .default("member"),
  status: text("status").$type<"active" | "revoked">().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  organizationUserUnique: uniqueIndex("organization_memberships_org_user_uniq")
    .on(t.organizationId, t.userId),
}));

export const locationMemberships = pgTable("location_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  locationId: uuid("location_id")
    .notNull()
    .references(() => organizationLocations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role")
    .$type<"owner" | "admin" | "coach" | "trainer" | "physician" | "nurse" | "staff" | "member">()
    .notNull()
    .default("member"),
  status: text("status").$type<"active" | "revoked">().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  locationUserUnique: uniqueIndex("location_memberships_location_user_uniq")
    .on(t.locationId, t.userId),
}));

export const userWorkspaceSelections = pgTable("user_workspace_selections", {
  userId: text("user_id").primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  locationId: uuid("location_id")
    .notNull()
    .references(() => organizationLocations.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationLocation = typeof organizationLocations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type LocationMembership = typeof locationMemberships.$inferSelect;