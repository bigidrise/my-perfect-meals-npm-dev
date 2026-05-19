import { pgTable, serial, varchar, timestamp, numeric, text, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clinicalLabs = pgTable("clinical_labs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  recordedById: varchar("recorded_by_id", { length: 64 }),
  a1c: numeric("a1c", { precision: 5, scale: 2 }),
  ldl: numeric("ldl", { precision: 6, scale: 1 }),
  hdl: numeric("hdl", { precision: 6, scale: 1 }),
  bloodPressureSystolic: numeric("blood_pressure_systolic", { precision: 5, scale: 1 }),
  bloodPressureDiastolic: numeric("blood_pressure_diastolic", { precision: 5, scale: 1 }),
  ejectionFraction: numeric("ejection_fraction", { precision: 5, scale: 1 }),
  creatinine: numeric("creatinine", { precision: 5, scale: 2 }),
  bun: numeric("bun", { precision: 5, scale: 1 }),
  inr: numeric("inr", { precision: 5, scale: 2 }),
  // Liver panel — drives liver-support and liver-disease protocol resolution
  alt:       numeric("alt",       { precision: 6, scale: 1 }),
  ast:       numeric("ast",       { precision: 6, scale: 1 }),
  bilirubin: numeric("bilirubin", { precision: 5, scale: 2 }),
  albumin:   numeric("albumin",   { precision: 4, scale: 2 }),
  // Thyroid panel — drives thyroid-support adaptive modifier activation
  tsh:                      numeric("tsh",                       { precision: 6, scale: 3 }), // mIU/L
  freeT4:                   numeric("free_t4",                   { precision: 5, scale: 2 }), // ng/dL
  freeT3:                   numeric("free_t3",                   { precision: 5, scale: 2 }), // pg/mL
  tpoAntibodies:            numeric("tpo_antibodies",            { precision: 8, scale: 2 }), // IU/mL
  thyroglobulinAntibodies:  numeric("thyroglobulin_antibodies",  { precision: 8, scale: 2 }), // IU/mL
  // Metabolic / Insulin Resistance — drives metabolic-support protocol
  fastingInsulin: numeric("fasting_insulin", { precision: 7, scale: 2 }),  // µIU/mL
  glucose:        numeric("glucose",         { precision: 6, scale: 1 }),  // mg/dL (fasting)
  triglycerides:  numeric("triglycerides",   { precision: 6, scale: 1 }),  // mg/dL
  // Inflammation — drives inflammation-support protocol escalation
  crp: numeric("crp", { precision: 6, scale: 2 }),  // mg/L — C-Reactive Protein
  // Hormonal / Stress — drives metabolic-stress protocol
  cortisol: numeric("cortisol", { precision: 6, scale: 2 }), // µg/dL
  // Oncology & Recovery support — nutrition status markers
  prealbumin: numeric("prealbumin", { precision: 5, scale: 2 }), // mg/dL (transthyretin — short-term nutrition status)
  notes: text("notes"),
  labDate: date("lab_date"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index("clinical_labs_user_idx").on(t.userId, t.recordedAt),
}));

export const insertClinicalLabsSchema = createInsertSchema(clinicalLabs, {
  a1c: z.string().or(z.number()).optional().nullable(),
  ldl: z.string().or(z.number()).optional().nullable(),
  hdl: z.string().or(z.number()).optional().nullable(),
  bloodPressureSystolic: z.string().or(z.number()).optional().nullable(),
  bloodPressureDiastolic: z.string().or(z.number()).optional().nullable(),
  ejectionFraction: z.string().or(z.number()).optional().nullable(),
  creatinine: z.string().or(z.number()).optional().nullable(),
  bun: z.string().or(z.number()).optional().nullable(),
  inr: z.string().or(z.number()).optional().nullable(),
  alt:       z.string().or(z.number()).optional().nullable(),
  ast:       z.string().or(z.number()).optional().nullable(),
  bilirubin: z.string().or(z.number()).optional().nullable(),
  albumin:   z.string().or(z.number()).optional().nullable(),
  tsh:                     z.string().or(z.number()).optional().nullable(),
  freeT4:                  z.string().or(z.number()).optional().nullable(),
  freeT3:                  z.string().or(z.number()).optional().nullable(),
  tpoAntibodies:           z.string().or(z.number()).optional().nullable(),
  thyroglobulinAntibodies: z.string().or(z.number()).optional().nullable(),
  fastingInsulin: z.string().or(z.number()).optional().nullable(),
  glucose:        z.string().or(z.number()).optional().nullable(),
  triglycerides:  z.string().or(z.number()).optional().nullable(),
  crp:            z.string().or(z.number()).optional().nullable(),
  cortisol:       z.string().or(z.number()).optional().nullable(),
  prealbumin:     z.string().or(z.number()).optional().nullable(),
  notes: z.string().optional().nullable(),
  recordedAt: z.string().or(z.date()),
}).omit({ id: true, createdAt: true });

export type InsertClinicalLabs = z.infer<typeof insertClinicalLabsSchema>;
export type ClinicalLabs = typeof clinicalLabs.$inferSelect;
