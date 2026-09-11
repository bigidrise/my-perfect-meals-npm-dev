import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { businessMembers, businesses } from "../db/schema/business";
import { organizations } from "../db/schema/organizations";
import { organizationalPilots, businessPilotGuidance, businessPilotCompletions, organizationalPilotEvents } from "../db/schema/pilotProgram";
import { resolveAuthoritativeBusinessPilotWindow } from "./businessCommercialAccessService";
import { getPilotReviewConfiguration } from "../config/pilotReviewConfig";

export const BUSINESS_PILOT_PROGRAM_VERSION = "business-pilot-2026-01";
export type BusinessAssignmentPack = "general_business" | "diabetes_clinical" | "glp1_weight_management" | "trainer_performance";
export const BUSINESS_ASSIGNMENT_PACKS: readonly BusinessAssignmentPack[] = ["general_business", "diabetes_clinical", "glp1_weight_management", "trainer_performance"];

export type Assignment = { key: string; label: string; feature?: string };
type Week = { title: string; goal: string; assignments: Assignment[] };
const UNIVERSAL: Assignment[][] = [
  [{ key: "w1_setup", label: "Complete setup" }, { key: "w1_app_library", label: "Explore the App Library" }, { key: "w1_academy_quick_start", label: "Complete Academy or Quick Start" }, { key: "w1_build_meal", label: "Build a meal for yourself" }, { key: "w1_food_facing_tool", label: "Try a food-facing tool" }, { key: "w1_workspace", label: "Review your organization workspace" }, { key: "w1_schedule_review", label: "Schedule the pilot review" }],
  [{ key: "w2_invite_onboard", label: "Invite and onboard your first appropriate client or user" }, { key: "w2_studio", label: "Open that person’s workspace or Studio where available" }, { key: "w2_create_adapt", label: "Create or adapt something for them" }, { key: "w2_restaurant_grocery_planning", label: "Try a restaurant, grocery, or meal-planning scenario" }, { key: "w2_record_friction", label: "Record what worked or was confusing" }, { key: "w2_schedule_review", label: "Schedule the pilot review" }],
  [{ key: "w3_multiple_scenarios", label: "Use My Perfect Meals in more than one real-world scenario" }, { key: "w3_relevant_feature_set", label: "Use your organization’s most relevant feature set" }, { key: "w3_partner_revenue", label: "Review Partner & Revenue where appropriate" }, { key: "w3_team_workspace", label: "Review team and workspace setup" }, { key: "w3_identify_fit", label: "Identify where My Perfect Meals fits into your normal process" }, { key: "w3_schedule_review", label: "Schedule the pilot review" }],
  [{ key: "w4_review_org_team_use", label: "Review what the organization and team used" }, { key: "w4_user_experience", label: "Review the client or user experience" }, { key: "w4_what_worked", label: "Identify what worked" }, { key: "w4_concerns_questions", label: "Identify concerns, missing capabilities, or questions" }, { key: "w4_submit_feedback", label: "Submit pilot feedback" }, { key: "w4_schedule_review", label: "Schedule the pilot review" }],
];
const PACK_SUBSTITUTIONS: Record<BusinessAssignmentPack, Record<number, Assignment[]>> = {
  general_business: {},
  diabetes_clinical: { 2: [{ key: "w2_clinical_workflow", label: "Review the diabetes clinical workflow", feature: "diabetes" }] },
  glp1_weight_management: { 2: [{ key: "w2_glp1_workflow", label: "Review the GLP-1 weight-management workflow", feature: "glp1" }] },
  trainer_performance: { 3: [{ key: "w3_performance_workflow", label: "Run the trainer performance workflow", feature: "performance" }] },
};
export const WEEKS: Week[] = [
  { title: "Learn My Perfect Meals", goal: "Champion learns personally before clients.", assignments: UNIVERSAL[0] },
  { title: "Use It With Real People", goal: "Use My Perfect Meals with real people.", assignments: UNIVERSAL[1] },
  { title: "Put It Into Your Workflow", goal: "Put My Perfect Meals into your workflow.", assignments: UNIVERSAL[2] },
  { title: "Evaluate and Prepare for Review", goal: "Evaluate the pilot and prepare for review.", assignments: UNIVERSAL[3] },
];

export function getBusinessPilotWeek(day: number): number {
  if (day < 1) return 1;
  return Math.min(4, Math.floor((day - 1) / 7) + 1);
}
export function getPilotAssignmentPack(value?: string | null): BusinessAssignmentPack {
  return (Object.keys(PACK_SUBSTITUTIONS).includes(value ?? "") ? value : "general_business") as BusinessAssignmentPack;
}

async function resolvePilot(userId: string, businessId: string) {
  const [row] = await db.select({ pilot: organizationalPilots, business: businesses, organization: organizations })
    .from(organizationalPilots).innerJoin(businesses, eq(businesses.id, organizationalPilots.businessId))
    .leftJoin(organizations, eq(organizations.id, businesses.organizationId))
    .innerJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
    .where(and(eq(organizationalPilots.businessId, businessId), eq(businessMembers.userId, userId), eq(businessMembers.status, "active"), sql`${businessMembers.role} IN ('owner','admin')`)).limit(1);
  return row ?? null;
}

function assignmentsFor(week: number, pack: BusinessAssignmentPack): Assignment[] {
  const substitutions = PACK_SUBSTITUTIONS[pack][week] ?? [];
  return UNIVERSAL[week - 1].map((assignment) => assignment).concat(substitutions);
}
export function getBusinessPilotAssignments(week: number, pack: BusinessAssignmentPack) {
  return assignmentsFor(week, pack);
}

export function selectBusinessPilotPack(organization: any, business: any): BusinessAssignmentPack {
  const flags = organization?.featureFlags ?? {};
  if (organization?.organizationType === "healthcare" && flags.diabeticHub) return "diabetes_clinical";
  if (flags.glp1Support) return "glp1_weight_management";
  if (organization?.organizationType === "fitness" || organization?.organizationType === "sports") return "trainer_performance";
  return business?.plan === "clinical_business_monthly" ? "diabetes_clinical" : "general_business";
}

export async function getBusinessPilotGuidance(input: { userId: string; businessId: string; now?: Date }) {
  const resolved = await resolvePilot(input.userId, input.businessId);
  if (!resolved?.business.organizationId) return null;
  const window = resolveAuthoritativeBusinessPilotWindow(resolved.business);
  if (!window || resolved.pilot.status !== "active") return null;
  const now = input.now ?? new Date();
  if (now < window.startedAt || now >= window.endsAt) return { active: false, pilotId: resolved.pilot.id, organizationId: resolved.business.organizationId };
  let [snapshot] = await db.select().from(businessPilotGuidance).where(eq(businessPilotGuidance.pilotId, resolved.pilot.id)).limit(1);
  if (!snapshot) {
    [snapshot] = await db.insert(businessPilotGuidance).values({
      pilotId: resolved.pilot.id, organizationId: resolved.business.organizationId,
      programVersion: BUSINESS_PILOT_PROGRAM_VERSION, assignmentPack: selectBusinessPilotPack(resolved.organization, resolved.business),
    }).onConflictDoNothing().returning();
  }
  if (!snapshot) [snapshot] = await db.select().from(businessPilotGuidance).where(eq(businessPilotGuidance.pilotId, resolved.pilot.id)).limit(1);
  const currentDay = Math.floor((now.getTime() - window.startedAt.getTime()) / 86400000) + 1;
  const currentWeek = getBusinessPilotWeek(currentDay);
  const week = WEEKS[currentWeek - 1];
  const assignments = assignmentsFor(currentWeek, getPilotAssignmentPack(snapshot.assignmentPack));
  const completions = await db.select().from(businessPilotCompletions).where(and(eq(businessPilotCompletions.pilotId, resolved.pilot.id), eq(businessPilotCompletions.organizationId, resolved.business.organizationId), eq(businessPilotCompletions.programVersion, snapshot.programVersion)));
  const byKey = new Map(completions.map((c) => [c.assignmentKey, c]));
  const output = assignments.map((a) => ({ key: a.key, label: a.label, completed: byKey.get(a.key)?.completed === true, completedAt: byKey.get(a.key)?.completedAt ?? null }));
  const next = output.find((a) => !a.completed);
  return { active: true, pilotId: resolved.pilot.id, organizationId: resolved.business.organizationId, programVersion: snapshot.programVersion, assignmentPack: snapshot.assignmentPack, currentDay, currentWeek, title: week.title, goal: week.goal, assignments: output, completedCount: output.filter((a) => a.completed).length, totalCount: output.length, nextAction: next?.label ?? "All current-week assignments are complete.", pilotReview: getPilotReviewConfiguration(), startsAt: window.startedAt, endsAt: window.endsAt };
}

export async function setBusinessPilotAssignment(input: { userId: string; businessId: string; key: string; completed: boolean }) {
  const guidance: any = await getBusinessPilotGuidance({ userId: input.userId, businessId: input.businessId });
  if (!guidance?.active || !("assignments" in guidance)) return null;
  if (!guidance.assignments.some((a: { key: string }) => a.key === input.key)) return undefined;
  const [existing] = await db.select().from(businessPilotCompletions).where(and(
    eq(businessPilotCompletions.pilotId, guidance.pilotId),
    eq(businessPilotCompletions.organizationId, guidance.organizationId),
    eq(businessPilotCompletions.programVersion, guidance.programVersion),
    eq(businessPilotCompletions.assignmentKey, input.key),
  )).limit(1);
  if (existing?.completed === input.completed) return guidance;
  await db.insert(businessPilotCompletions).values({
    pilotId: guidance.pilotId, organizationId: guidance.organizationId, programVersion: guidance.programVersion,
    assignmentKey: input.key, actorUserId: input.userId, completed: input.completed,
    completedAt: input.completed ? new Date() : null,
  }).onConflictDoUpdate({ target: [businessPilotCompletions.organizationId, businessPilotCompletions.pilotId, businessPilotCompletions.programVersion, businessPilotCompletions.assignmentKey], set: { completed: input.completed, completedAt: input.completed ? new Date() : null, actorUserId: input.userId, updatedAt: new Date() } });
  await db.insert(organizationalPilotEvents).values({
    pilotId: guidance.pilotId, actorUserId: input.userId, eventType: input.completed ? "guidance_assignment_completed" : "guidance_assignment_uncompleted",
    entityType: "business_pilot_assignment", entityId: input.key,
    metadata: { organizationId: guidance.organizationId, programVersion: guidance.programVersion },
  });
  return getBusinessPilotGuidance({ userId: input.userId, businessId: input.businessId });
}