import type { User } from "@/lib/auth";
import { hasActivePaidSubscription } from "@/lib/subscriptionCheck";
import type { JourneySnapshot } from "../../../../shared/guidedJourney";
import { manualJourneyDestination } from "./dashboardModel";

export type JourneyDashboardAccount = Pick<User,
  "id" | "role" | "professionalRole" | "isSandbox" | "activeBoard"
  | "selectedMealBuilder" | "accessTier" | "planLookupKey" | "builderSwitchUnlimited" | "studioMembership">;
export interface JourneyDashboardContext {
  development: boolean;
  path: string;
  workspace: string | null;
  householdProfileId: string | null;
}
export function isPersonalJourneyDashboard(
  account: JourneyDashboardAccount | null, context: JourneyDashboardContext,
): boolean {
  return context.development && context.path.split("?")[0] === "/dashboard"
    && (context.workspace === null || context.workspace === "personal")
    && !context.householdProfileId && !!account?.id && account.role === "client"
    && !account.professionalRole && !account.isSandbox
    && !account.id.startsWith("guest-") && !["anon", "anonymous"].includes(account.id)
    && account.id !== "00000000-0000-0000-0000-000000000001";
}
/** Include authority-affecting fields so changed accounts/access hide stale state immediately. */
export function journeyDashboardContextKey(
  account: JourneyDashboardAccount | null, context: JourneyDashboardContext,
): string {
  return JSON.stringify([context, account?.id, account?.role, account?.professionalRole,
    account?.isSandbox, account?.activeBoard, account?.selectedMealBuilder,
    account?.accessTier, account?.planLookupKey, account?.builderSwitchUnlimited,
    account?.studioMembership?.assignedBuilder]);
}
export function journeyDestinationAllowed(
  snapshot: JourneySnapshot, account: JourneyDashboardAccount | null,
): boolean {
  if (!account || snapshot.scope.actorId !== account.id || snapshot.scope.subjectId !== account.id
    || account.role !== "client" || account.professionalRole || account.isSandbox) return false;
  const route = manualJourneyDestination(snapshot);
  if (!route) return false;
  if (route !== "/general-nutrition-builder/build") return true;
  return journeyMealBuilderAllowed(account);
}

export function journeyMealBuilderAllowed(account: JourneyDashboardAccount): boolean {
  // Match the existing BuilderAccessGuard; additionally decline a conflicting
  // professional assignment rather than adding an unapproved Builder adapter.
  const assigned = account.studioMembership?.assignedBuilder;
  return hasActivePaidSubscription(account)
    && (!account.activeBoard || account.activeBoard === "general_nutrition" || account.builderSwitchUnlimited === true)
    && (!assigned || assigned === "general_nutrition");
}
