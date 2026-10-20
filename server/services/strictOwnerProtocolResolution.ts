import { pool } from "../db";
import { loadUserProtocolEnvelope, type UserProtocolEnvelope } from "./protocolEnvelope";
import { resolveDailyNutritionPrescription } from "./prescriptionResolver";
import type { DailyNutritionPrescription } from "../../shared/dailyNutritionPrescription";
import { withDevelopmentNoSaveDatabase, assertNoDevelopmentTestWrites } from "./myPerfectMenu/developmentNoSave";
import {
  SafetyResolutionRecorder, type SafetySourceKey, type StrictOwnerScope,
} from "./nutritionResolutionContext";
import { strictOwnerDevelopmentEnabled } from "./strictOwnerRuntime";

export type StrictOwnerResult =
  | {
    status: "complete"; ownerId: string; subjectId: string; scope: "account_owner";
    envelope: UserProtocolEnvelope; prescription: DailyNutritionPrescription | null;
    sources: ReturnType<SafetyResolutionRecorder["snapshot"]>; persistence: "none";
  }
  | { status: "unavailable"; reasonCode: "STRICT_OWNER_UNAVAILABLE"; failedSources: SafetySourceKey[] };

/**
 * DISCONNECTED server-only entry. No route, registrar or advisor adapter imports it.
 * The caller must supply the existing authenticated identity, never a chat/body ID.
 * Offline verification installs storage/provider stubs BEFORE importing this module.
 */
export async function resolveStrictOwnerProtocolEnvelope(authenticatedOwnerId: string): Promise<StrictOwnerResult> {
  const resolution = new SafetyResolutionRecorder();
  const unavailable = (): StrictOwnerResult => ({
    status: "unavailable", reasonCode: "STRICT_OWNER_UNAVAILABLE",
    failedSources: resolution.incompleteSources(),
  });
  if (!strictOwnerDevelopmentEnabled() || !authenticatedOwnerId) {
    resolution.fail("owner_profile", "unsupported");
    return unavailable();
  }
  const scope: StrictOwnerScope = {
    mode: "pairing_advisor_owner", ownerId: authenticatedOwnerId, now: new Date(), resolution,
  };
  try {
    return await withDevelopmentNoSaveDatabase(pool, async () => {
      const envelope = await loadUserProtocolEnvelope(authenticatedOwnerId, undefined, {
        personalSubject: true, strictOwner: scope,
      });
      if (!envelope || envelope.userId !== authenticatedOwnerId) {
        if (envelope) resolution.fail("owner_profile", "invalid_data");
        return unavailable();
      }
      let prescription: DailyNutritionPrescription | null = null;
      if (resolution.get("prescription")?.status !== "not_applicable") {
        const day = resolution.get("timezone");
        if (day?.status !== "success") {
          resolution.fail("timezone", "missing_required");
          return unavailable();
        }
        prescription = await resolveDailyNutritionPrescription({
          userId: authenticatedOwnerId, dateISO: day.value.localDate,
        }, { strictOwner: { ...scope, day: day.value } });
      }
      assertNoDevelopmentTestWrites();
      resolution.record("write_boundary", { status: "success", value: "none", basis: "calculated" });
      if (resolution.incompleteSources().length) return unavailable();
      return {
        status: "complete", ownerId: authenticatedOwnerId, subjectId: authenticatedOwnerId,
        scope: "account_owner", envelope, prescription, sources: resolution.snapshot(), persistence: "none",
      };
    });
  } catch {
    // The result intentionally contains neither clinical values nor driver messages.
    // A write-boundary or unobserved resolver error cannot issue a completion receipt.
    if (!resolution.incompleteSources().length) resolution.fail("write_boundary", "read_failed");
    return unavailable();
  }
}
