import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { DemoCapability } from "@shared/demoProfessional";
// Constraint/trigger authority is the explicit bounded SQL migration.
export const demoProfessionalWorkspaces = pgTable("demo_professional_workspaces", {
  id: uuid("id").primaryKey(), label: text("label").notNull(), classification: text("classification"),
  createdAt: timestamp("created_at", { withTimezone:true }).defaultNow().notNull(),
});
export const demoProfessionalPatients = pgTable("demo_professional_patients", {
  id: uuid("id").primaryKey(), workspaceId:uuid("workspace_id").notNull().references(()=>demoProfessionalWorkspaces.id),
  classification:text("classification"), label:text("label").notNull(), data:jsonb("data").notNull(),
  revision:integer("revision").default(1).notNull(), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
});
export const demoProfessionalGrants = pgTable("demo_professional_grants", {
  id:uuid("id").primaryKey(), userId:text("user_id").unique().notNull(),
  workspaceId:uuid("workspace_id").notNull().references(()=>demoProfessionalWorkspaces.id),
  persona:text("persona").notNull(), operatingStatus:text("operating_status").notNull(), state:text("state").notNull(),
  revision:integer("revision").notNull(), capabilities:jsonb("capabilities").$type<DemoCapability[]>().notNull(),
  expiresAt:timestamp("expires_at",{withTimezone:true}), approverId:text("approver_id"), reason:text("reason").notNull(),
  trainingBasis:text("training_basis").notNull(), trainingWaiverReason:text("training_waiver_reason"),
  acknowledgedAt:timestamp("acknowledged_at",{withTimezone:true}), acknowledgmentVersion:text("acknowledgment_version"),
  identityRequestId:uuid("identity_request_id"), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).defaultNow().notNull(),
});
export const demoProfessionalEvents = pgTable("demo_professional_events", {
  id:uuid("id").primaryKey(), grantId:uuid("grant_id").notNull().references(()=>demoProfessionalGrants.id),
  actorUserId:text("actor_user_id"), eventType:text("event_type").notNull(), metadata:jsonb("metadata").notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
});
