import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const userDocumentAcceptance = pgTable("user_document_acceptance", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  documentType: text("document_type").notNull(),
  version: integer("version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => [
  index("idx_uda_user_doc").on(table.userId, table.documentType),
]);
