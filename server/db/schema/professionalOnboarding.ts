import { pgTable, uuid, text, integer, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import type { ProfessionalDraftFields } from "@shared/professionalOnboarding";

// No FK/ALTER on users: Stage 1 must not change existing account deletion or
// authority. Authenticated persisted account lookup binds every operation.
export const professionalIdentityRequests = pgTable("professional_identity_requests", {
  id: uuid("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  requestedRole: text("requested_role").$type<ProfessionalDraftFields["requestedRole"]>(),
  professionalCategory: text("professional_category").$type<ProfessionalDraftFields["professionalCategory"]>(),
  credentialType: text("credential_type"),
  credentialBody: text("credential_body"),
  credentialNumber: text("credential_number"),
  credentialYear: text("credential_year"),
  state: text("state").$type<"draft" | "submitted" | "approved" | "rejected" | "needs_correction">().notNull().default("draft"),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  decisionReason: text("decision_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, table => ({ owner: uniqueIndex("professional_identity_requests_owner_unique").on(table.ownerUserId) }));

export const professionalIdentityEvents = pgTable("professional_identity_events", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id").notNull().references(() => professionalIdentityRequests.id),
  actorUserId: text("actor_user_id").notNull(),
  eventType: text("event_type").$type<"draft_created" | "draft_updated" | "request_submitted" | "correction_resumed" | "identity_approved" | "identity_rejected" | "identity_correction_requested">().notNull(),
  requestRevision: integer("request_revision").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({ revision: uniqueIndex("professional_identity_events_revision_unique").on(table.requestId, table.requestRevision) }));
