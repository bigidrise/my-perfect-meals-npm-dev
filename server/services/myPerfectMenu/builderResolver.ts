import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import {
  builderContextFor,
  isMyPerfectMenuBuilderKey,
  MY_PERFECT_MENU_BUILDERS,
  type MyPerfectMenuBuilderContext,
  type MyPerfectMenuBuilderKey,
} from "@shared/builderNamespaces";
import { db } from "../../db";

export class MyPerfectMenuBuilderError extends Error {
  constructor(public readonly code: "INVALID_BUILDER" | "UNAUTHORIZED_BUILDER", message: string) {
    super(message);
  }
}

export interface BuilderResolutionInput {
  requestedBuilderKey?: unknown;
  requestedNamespace?: unknown;
  builderKey?: unknown;
  builderNamespace?: unknown;
  subjectBuilderKey?: unknown;
}

/** Pure precedence/authorization policy; database access is deliberately outside this function. */
export function resolveMyPerfectMenuBuilder(
  input: BuilderResolutionInput,
  account: { activeBoard?: unknown; selectedMealBuilder?: unknown; builderSwitchUnlimited?: boolean | null; isAdmin?: boolean | null },
): MyPerfectMenuBuilderContext {
  const suppliedNamespace = input.requestedNamespace ?? input.builderNamespace;
  const namespaceKey = suppliedNamespace === undefined
    ? undefined
    : (Object.keys(MY_PERFECT_MENU_BUILDERS) as MyPerfectMenuBuilderKey[]).find(
      (key) => MY_PERFECT_MENU_BUILDERS[key].namespace === suppliedNamespace,
    );
  const requested = input.requestedBuilderKey ?? input.builderKey ?? input.subjectBuilderKey ?? namespaceKey;
  if (requested !== undefined && requested !== null && requested !== "") {
    if (!isMyPerfectMenuBuilderKey(requested)) {
      throw new MyPerfectMenuBuilderError("INVALID_BUILDER", "Unsupported My Perfect Menu builder.");
    }
    const entry = MY_PERFECT_MENU_BUILDERS[requested];
    if (suppliedNamespace !== undefined && suppliedNamespace !== entry.namespace) {
      throw new MyPerfectMenuBuilderError("INVALID_BUILDER", "Builder namespace does not match the requested builder.");
    }
    const assigned = account.activeBoard ?? account.selectedMealBuilder;
    const authorized = account.isAdmin || account.builderSwitchUnlimited ||
      assigned === requested;
    if (!authorized) {
      throw new MyPerfectMenuBuilderError("UNAUTHORIZED_BUILDER", "You are not authorized to use that builder.");
    }
    return builderContextFor(requested, "explicit");
  }

  if (suppliedNamespace !== undefined) {
    throw new MyPerfectMenuBuilderError("INVALID_BUILDER", "Unsupported My Perfect Menu builder namespace.");
  }

  const assigned = account.activeBoard ?? account.selectedMealBuilder;
  // Legacy Performance assignments used beach_body; normalize that stored
  // assignment to the canonical Performance Competition Builder authority.
  if (assigned === "beach_body") return builderContextFor("performance_competition", "assigned");
  if (isMyPerfectMenuBuilderKey(assigned)) return builderContextFor(assigned, "assigned");
  return builderContextFor("general_nutrition", "default");
}

export async function resolveMyPerfectMenuBuilderForActor(
  actorUserId: string,
  input: BuilderResolutionInput = {},
): Promise<MyPerfectMenuBuilderContext> {
  const [account] = await db.select({
    activeBoard: users.activeBoard,
    selectedMealBuilder: users.selectedMealBuilder,
    builderSwitchUnlimited: users.builderSwitchUnlimited,
    isAdmin: users.isAdmin,
  }).from(users).where(eq(users.id, actorUserId)).limit(1);
  if (!account) throw new MyPerfectMenuBuilderError("UNAUTHORIZED_BUILDER", "Account not found.");
  return resolveMyPerfectMenuBuilder(input, account);
}