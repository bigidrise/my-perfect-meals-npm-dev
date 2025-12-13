import { pgTable, varchar, uuid, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export type Permissions = {
  canViewMacros: boolean;
  canAddMeals: boolean;
  canEditPlan: boolean;
};

export const careTeamMember = pgTable("care_team_member", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  proUserId: varchar("pro_user_id", { length: 64 }),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  permissions: jsonb("permissions").$type<Permissions>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const careInvite = pgTable("care_invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  permissions: jsonb("permissions").$type<Permissions>().notNull(),
  inviteCode: varchar("invite_code", { length: 24 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const careAccessCode = pgTable("care_access_code", {
  id: uuid("id").primaryKey().defaultRandom(),
  proUserId: varchar("pro_user_id", { length: 64 }).notNull(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  maxUses: varchar("max_uses", { length: 8 }).notNull().default("1"),
  createdAt: timestamp("created_at").defaultNow(),
});
