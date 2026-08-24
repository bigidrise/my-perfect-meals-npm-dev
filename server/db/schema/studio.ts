import { pgTable, uuid, text, timestamp, pgEnum, jsonb, index, uniqueIndex, boolean, integer } from "drizzle-orm/pg-core";

export const professionalSpaceTypeEnum = pgEnum("professional_space_type", ["studio", "clinic"]);

export const noteTypeEnum = pgEnum("note_type", ["session", "progress", "goal", "recommendation", "general"]);

export const noteVisibilityEnum = pgEnum("note_visibility", ["professional_only", "shared_with_client"]);

export const entryTypeEnum = pgEnum("entry_type", ["message", "note"]);

export const senderTypeEnum = pgEnum("sender_type", ["client", "pro"]);

export const activityActionEnum = pgEnum("activity_action", [
  "membership_created",
  "membership_activated", 
  "membership_paused",
  "membership_disconnected",
  "builder_assigned",
  "board_created",
  "board_updated",
  "board_deleted",
  "program_updated",
  "macros_updated",
  "settings_changed",
  "invite_sent",
  "invite_accepted",
  "note_added",
  "message_sent",
  "message_deleted",
  "note_deleted",
  "message_blocked",
  "message_flagged",
  "cycle_protocol_updated",
  "nutrition_strategy_viewed",
  "nutrition_strategy_acknowledged",
  "board_access_changed"
]);

export const studios = pgTable("studios", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  orgId: uuid("org_id"),
  type: professionalSpaceTypeEnum("type").notNull().default("studio"),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  themeColor: text("theme_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("active"),
  verificationStatus: text("verification_status").$type<"pending" | "verified" | "rejected">().default("pending"),
  providerSource: text("provider_source").$type<"internal" | "external">().default("external"),
  availabilityStatus: text("availability_status").$type<"available" | "away">().default("available"),
  awayStartDate: timestamp("away_start_date", { withTimezone: true }),
  awayEndDate: timestamp("away_end_date", { withTimezone: true }),
  awayMessage: text("away_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studioBilling = pgTable("studio_billing", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }).unique(),
  stripeAccountId: text("stripe_account_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCode: text("plan_code").notNull().default("studio_59"),
  status: text("status").notNull().default("trialing"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studioMemberships = pgTable("studio_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull().unique(),
  status: text("status").notNull().default("invited"),
  assignedBuilder: text("assigned_builder"),
  builderSource: text("builder_source").$type<"clinical" | "trainer" | "manual">().notNull().default("manual"),
  activeBoardId: uuid("active_board_id"),
  workspace: text("workspace").notNull().default("trainer"),
  isArchived: boolean("is_archived").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioIdx: index("idx_studio_memberships_studio").on(table.studioId),
}));

export const studioInvites = pgTable("studio_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  urlToken: text("url_token").unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioIdx: index("idx_studio_invites_studio").on(table.studioId),
  emailIdx: index("idx_studio_invites_email").on(table.email),
}));

export const clientSubscriptions = pgTable("client_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planCode: text("plan_code").notNull().default("client_2999"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioIdx: index("idx_client_subscriptions_studio").on(table.studioId),
}));

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull(),
  authorUserId: text("author_user_id").notNull(),
  noteType: noteTypeEnum("note_type").notNull().default("general"),
  visibility: noteVisibilityEnum("visibility").notNull().default("professional_only"),
  title: text("title"),
  body: text("body").notNull(),
  sessionDate: timestamp("session_date", { withTimezone: true }),
  tags: jsonb("tags").$type<string[]>().default([]),
  entryType: entryTypeEnum("entry_type").notNull().default("note"),
  sender: senderTypeEnum("sender").notNull().default("pro"),
  contentType: text("content_type").$type<"text" | "voice">().notNull().default("text"),
  audioObjectKey: text("audio_object_key"),
  audioMimeType: text("audio_mime_type"),
  audioDurationSec: integer("audio_duration_sec"),
  transcript: text("transcript"),
  transcriptStatus: text("transcript_status").$type<"pending" | "completed" | "failed" | "blocked">(),
  moderationStatus: text("moderation_status").$type<"pending" | "approved" | "blocked">(),
  transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioClientIdx: index("idx_client_notes_studio_client").on(table.studioId, table.clientUserId),
  authorIdx: index("idx_client_notes_author").on(table.authorUserId),
}));

export const tabletVoiceJobs = pgTable("tablet_voice_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  noteId: uuid("note_id").notNull().references(() => clientNotes.id, { onDelete: "cascade" }),
  status: text("status").$type<"pending" | "processing" | "completed" | "failed">().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => ({
  statusIdx: index("idx_tablet_voice_jobs_status").on(table.status),
}));

/**
 * Private Studio video messages use their own parent/media records so the
 * permanent communication record can retain a transcript after the temporary
 * media object is purged. Do not add public URL columns here.
 */
export const studioVideoMessages = pgTable("studio_video_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull(),
  authorUserId: text("author_user_id").notNull(),
  recipientUserId: text("recipient_user_id").notNull(),
  sender: senderTypeEnum("sender").notNull(),
  visibility: noteVisibilityEnum("visibility").notNull().default("shared_with_client"),
  contentType: text("content_type").$type<"video">().notNull().default("video"),
  body: text("body").notNull().default("Video message"),
  transcript: text("transcript"),
  transcriptStatus: text("transcript_status").$type<"pending" | "completed" | "failed" | "blocked">().notNull().default("completed"),
  transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioClientIdx: index("idx_studio_video_messages_studio_client").on(table.studioId, table.clientUserId),
  authorIdx: index("idx_studio_video_messages_author").on(table.authorUserId),
  createdIdx: index("idx_studio_video_messages_created").on(table.createdAt),
}));

export const studioVideoMedia = pgTable("studio_video_media", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").notNull().references(() => studioVideoMessages.id, { onDelete: "cascade" }).unique(),
  state: text("state").$type<
    "draft" | "uploading" | "uploaded" | "processing" | "ready" |
    "upload_failed" | "transcription_failed" | "moderation_failed" |
    "expiration_pending" | "expired" | "deleting" | "deletion_failed" | "deleted"
  >().notNull().default("draft"),
  objectKey: text("object_key"),
  mimeType: text("mime_type").notNull(),
  durationSec: integer("duration_sec").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  temporaryDerivativeKeys: jsonb("temporary_derivative_keys").$type<string[]>().notNull().default([]),
  watchProgress: jsonb("watch_progress").$type<{
    durationSec: number;
    watchedIntervals: Array<[number, number]>;
    lastPositionSec: number | null;
    lastObservedAtMs: number | null;
    maxVerifiedPositionSec: number;
    rejectedSampleCount: number;
  } | null>(),
  watchCompletedAt: timestamp("watch_completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  moderationStatus: text("moderation_status").$type<"pending" | "approved" | "blocked">().notNull().default("approved"),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  stateIdx: index("idx_studio_video_media_state").on(table.state),
  expiresIdx: index("idx_studio_video_media_expires").on(table.expiresAt),
}));

export type Studio = typeof studios.$inferSelect;
export type InsertStudio = typeof studios.$inferInsert;
export type StudioBilling = typeof studioBilling.$inferSelect;
export type InsertStudioBilling = typeof studioBilling.$inferInsert;
export type StudioMembership = typeof studioMemberships.$inferSelect;
export type InsertStudioMembership = typeof studioMemberships.$inferInsert;
export type StudioInvite = typeof studioInvites.$inferSelect;
export type InsertStudioInvite = typeof studioInvites.$inferInsert;
export type ClientSubscription = typeof clientSubscriptions.$inferSelect;
export type InsertClientSubscription = typeof clientSubscriptions.$inferInsert;
export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = typeof clientNotes.$inferInsert;
export type StudioVideoMessage = typeof studioVideoMessages.$inferSelect;
export type InsertStudioVideoMessage = typeof studioVideoMessages.$inferInsert;
export type StudioVideoMedia = typeof studioVideoMedia.$inferSelect;
export type InsertStudioVideoMedia = typeof studioVideoMedia.$inferInsert;

export const coachingInvites = pgTable("coaching_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull(),
  coachSlug: text("coach_slug").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  source: text("source").notNull().default("coach_invite"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, (table) => ({
  tokenIdx: index("idx_coaching_invites_token").on(table.token),
  emailIdx: index("idx_coaching_invites_email").on(table.email),
  studioIdx: index("idx_coaching_invites_studio").on(table.studioId),
}));

export type CoachingInvite = typeof coachingInvites.$inferSelect;
export type InsertCoachingInvite = typeof coachingInvites.$inferInsert;

export const clientActivityLog = pgTable("client_activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  action: activityActionEnum("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioClientIdx: index("idx_activity_log_studio_client").on(table.studioId, table.clientUserId),
  actorIdx: index("idx_activity_log_actor").on(table.actorUserId),
  actionIdx: index("idx_activity_log_action").on(table.action),
}));

export type ClientActivityLog = typeof clientActivityLog.$inferSelect;
export type InsertClientActivityLog = typeof clientActivityLog.$inferInsert;

export const STRATEGY_TYPES = [
  "Lower Carb Phase",
  "Higher Carb Push",
  "Carb Refeed",
  "Lower Fat Phase",
  "Higher Fat Adjustment",
  "Maintenance Hold",
  "Custom Strategy",
] as const;

export type StrategyType = typeof STRATEGY_TYPES[number];

export const clientCycleProtocols = pgTable("client_cycle_protocols", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull().unique(),
  strategyType: text("strategy_type").notNull().default("Custom Strategy"),
  coachInstructions: text("coach_instructions"),
  watchFor: text("watch_for"),
  strategyVersion: integer("strategy_version").notNull().default(1),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedByRole: text("updated_by_role").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  lastViewedByUserId: text("last_viewed_by_user_id"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedByUserId: text("acknowledged_by_user_id"),
  acknowledgedVersion: integer("acknowledged_version"),
}, (table) => ({
  studioIdx: index("idx_cycle_protocols_studio").on(table.studioId),
  clientIdx: index("idx_cycle_protocols_client").on(table.clientUserId),
}));

export type ClientCycleProtocol = typeof clientCycleProtocols.$inferSelect;
export type InsertClientCycleProtocol = typeof clientCycleProtocols.$inferInsert;

// ─── Check-in Schedules ──────────────────────────────────────────────────────
// Persists the follow-up dates the coach sets so the server background job
// can fire alerts to both the coach and the client at the right time.

export const checkInSchedules = pgTable("check_in_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  clientUserId: text("client_user_id").notNull(),
  proUserId: text("pro_user_id").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  note: text("note"),
  done: boolean("done").notNull().default(false),
  alertsSent: jsonb("alerts_sent").$type<Record<string, boolean>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studioClientIdx: index("idx_checkin_studio_client").on(table.studioId, table.clientUserId),
  dueAtIdx: index("idx_checkin_due_at").on(table.dueAt),
}));

export type CheckInSchedule = typeof checkInSchedules.$inferSelect;
export type InsertCheckInSchedule = typeof checkInSchedules.$inferInsert;

// ─── Check-in Alert Preferences ──────────────────────────────────────────────
// Stored per studio (coach/physician). Intervals are: "2h" | "24h" | "48h" | "1w"

export const checkInAlertPrefs = pgTable("check_in_alert_prefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  studioId: uuid("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }).unique(),
  intervals: jsonb("intervals").$type<string[]>().notNull().default(["24h", "1w"]),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CheckInAlertPrefs = typeof checkInAlertPrefs.$inferSelect;
export type InsertCheckInAlertPrefs = typeof checkInAlertPrefs.$inferInsert;
