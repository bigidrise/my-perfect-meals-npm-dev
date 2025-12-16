import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const guardrailAuditLog = pgTable("guardrail_audit_log", {
  id: text("id").primaryKey(),
  doctorId: text("doctor_id").notNull(),
  patientId: text("patient_id").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const glp1AuditLog = pgTable("glp1_audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  clinicianId: text("clinician_id"),
  action: text("action").notNull(),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at").defaultNow(),
});