import { z } from "zod";
import { studioStarchPreferencesSchema } from "./starchPreferences";

const flag = z.enum(["lowSodium", "diabetesFriendly", "glp1", "cardiac", "renal", "postBariatric", "liverDisease", "liverSupport", "thyroidSupport", "oncologySupport", "highProtein", "carbCycling", "antiInflammatory"]);
const advisoryToggle = z.object({ id: z.string().max(100), enabled: z.boolean(), appliedAt: z.string().max(100).optional(), appliedBy: z.string().max(150).optional() }).strict();
export const developmentDashboardInput = z.object({
  targets: z.object({
    protein: z.number().min(0).max(1000), starchyCarbs: z.number().min(0).max(2000),
    fibrousCarbs: z.number().min(0).max(2000), fat: z.number().min(0).max(1000),
    starchStrategy: z.enum(["one", "flex"]).optional(),
    flags: z.record(flag, z.boolean()).optional(),
    allergens: z.array(z.string().max(100)).max(100).optional(),
    carbDirective: z.object({
      starchyCapG: z.number().min(0).max(2000).nullable().optional(),
      fibrousFloorG: z.number().min(0).max(2000).nullable().optional(),
      addedSugarCapG: z.number().min(0).max(2000).nullable().optional(),
    }).strict().optional(),
  }).strict(),
  context: z.object({
    role: z.literal("doctor"), diagnosis: z.string().max(4000).optional(),
    clinicalTags: z.array(z.enum(["GLP-1", "Cardiac", "Renal", "Bariatric", "Post-Op", "Diabetes", "General"])).max(7).optional(),
    followupWeeks: z.union([z.literal(4), z.literal(8), z.literal(12)]).optional(),
    followupDate: z.string().max(40).optional(), patientNote: z.string().max(8000).optional(),
    coachNote: z.string().max(8000).optional(),
    advisory: z.object({ menopause: advisoryToggle.optional(), insulinResistance: advisoryToggle.optional(), highStress: advisoryToggle.optional() }).strict().optional(),
    checkInWeeks: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(12)]).optional(),
    checkInDate: z.string().max(40).optional(), nextCheckInISO: z.string().max(40).optional(),
  }).strict(),
  assignedBuilder: z.enum(["weekly", "diabetic", "glp1", "anti_inflammatory", "beach_body", "general_nutrition", "performance_competition"]).optional(),
  starchPreferences: studioStarchPreferencesSchema.optional(),
  followups: z.array(z.object({
    id: z.string().uuid(), dueAt: z.string().datetime(), done: z.boolean(),
    note: z.string().max(8000).nullable(), coachDisplayName: z.literal("Development physician"),
  }).strict()).max(100),
}).strict();
export type DevelopmentDashboard = z.infer<typeof developmentDashboardInput>;
export const developmentDashboardWrite = z.object({
  revision: z.number().int().min(1), dashboard: developmentDashboardInput,
}).strict();
export function initialDevelopmentDashboard(): DevelopmentDashboard {
  // Deliberately no fabricated prescription, credential, or clinical evidence.
  return { targets: { protein: 0, starchyCarbs: 0, fibrousCarbs: 0, fat: 0 },
    context: { role: "doctor" }, followups: [] };
}
