import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const whiteLabelInquiries = pgTable("white_label_inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  businessName: text("business_name").notNull(),
  audienceSize: text("audience_size"),
  useCase: text("use_case").notNull(),
  checkboxesAcknowledged: jsonb("checkboxes_acknowledged").notNull(),
  stagesAcknowledged: jsonb("stages_acknowledged").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});
