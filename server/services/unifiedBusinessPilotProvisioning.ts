import { sql } from "drizzle-orm";
import {
  BusinessPilotActivationError, unifiedBusinessPilotDevelopmentEnabled,
  validateClinicalPilotWindow,
} from "./businessPilotActivationPolicy";

const rows = (result: any): any[] => result.rows ?? result;

export interface PilotWorkspaceInput { businessId?: string; organizationName?: string }

/**
 * Called inside the invitation claim transaction. The bound business ID is also
 * the durable recovery checkpoint for canonical tenant provisioning after commit.
 * No mail, Stripe, Studio, practitioner identity or affiliate writes occur here.
 */
export async function provisionUnifiedPilotBusiness(
  tx: any, userId: string,
  grant: { authorizationId: string; startedAt: Date; endsAt: Date },
  input: PilotWorkspaceInput = {},
) {
  if (!unifiedBusinessPilotDevelopmentEnabled()) return {};
  validateClinicalPilotWindow(grant.startedAt, grant.endsAt);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"business-pilot-owner:" + userId}))`);
  const [link] = rows(await tx.execute(sql`SELECT business_id, organization_consumed
    FROM business_pilot_activation_links WHERE authorization_id = ${grant.authorizationId}
      AND activated_user_id = ${userId} FOR UPDATE`));
  if (!link) throw new BusinessPilotActivationError("Pilot ownership could not be verified.", "PILOT_STATE_INVALID", 503);
  if (link.business_id) {
    if (input.businessId && input.businessId !== link.business_id) {
      throw new BusinessPilotActivationError("This pilot is already attached to another organization.", "PILOT_ORGANIZATION_ALREADY_ATTACHED");
    }
    const [owned] = rows(await tx.execute(sql`SELECT id FROM businesses
      WHERE id = ${link.business_id} AND owner_user_id = ${userId} AND status = 'active'`));
    if (!owned) throw new BusinessPilotActivationError("The pilot organization requires review.", "PILOT_ORGANIZATION_REVIEW_REQUIRED");
    return { businessId: link.business_id as string };
  }
  // An ended grant cannot provision or fund a workspace on a late retry.
  if (grant.endsAt.getTime() <= Date.now()) return {};
  if (link.organization_consumed) throw new BusinessPilotActivationError("Organization reservation requires review.", "PILOT_STATE_INVALID", 503);
  const owned = rows(await tx.execute(sql`SELECT id, name, status, commercial_access_mode,
      commercial_access_started_at, commercial_access_ends_at, stripe_subscription_id
    FROM businesses WHERE owner_user_id = ${userId} ORDER BY id FOR UPDATE`));
  if (owned.length > 1 && !input.businessId) {
    throw new BusinessPilotActivationError("Select the organization for this pilot.", "PILOT_ORGANIZATION_SELECTION_REQUIRED");
  }
  let business = input.businessId ? owned.find(row => row.id === input.businessId) : owned[0];
  if (input.businessId && !business) throw new BusinessPilotActivationError("Organization ownership is required.", "PILOT_ORGANIZATION_FORBIDDEN", 403);
  if (business) {
    if (business.commercial_access_mode === "onboarding_pilot") {
      if (new Date(business.commercial_access_started_at).getTime() !== grant.startedAt.getTime()
          || new Date(business.commercial_access_ends_at).getTime() !== grant.endsAt.getTime()
          || business.status !== "active") {
        throw new BusinessPilotActivationError(
          "This organization already has a pilot period. Its dates were not changed; an approved reconciliation is required.",
          "PILOT_RECONCILIATION_REQUIRED",
        );
      }
    } else if (business.status === "pending_billing" && !business.commercial_access_mode && !business.stripe_subscription_id) {
      await tx.execute(sql`UPDATE businesses SET status = 'active', commercial_access_mode = 'onboarding_pilot',
        commercial_access_started_at = ${grant.startedAt}, commercial_access_ends_at = ${grant.endsAt},
        updated_at = NOW() WHERE id = ${business.id}`);
    } else if (business.status !== "active" || !["paid", "authorized_arrangement"].includes(business.commercial_access_mode)) {
      throw new BusinessPilotActivationError("This organization's commercial history requires review.", "PILOT_ORGANIZATION_REVIEW_REQUIRED");
    }
    const [member] = rows(await tx.execute(sql`SELECT id FROM business_members
      WHERE business_id = ${business.id} AND user_id = ${userId} AND role = 'owner' AND status = 'active'`));
    if (!member) throw new BusinessPilotActivationError("An active owner membership is required.", "PILOT_ORGANIZATION_FORBIDDEN", 403);
  } else {
    const name = input.organizationName?.trim();
    if (!name || name.length < 2 || name.length > 80) {
      throw new BusinessPilotActivationError("Enter an organization name between 2 and 80 characters.", "PILOT_ORGANIZATION_NAME_REQUIRED", 400);
    }
    [business] = rows(await tx.execute(sql`INSERT INTO businesses
      (name, owner_user_id, plan, seat_limit, status, commercial_access_mode,
        commercial_access_started_at, commercial_access_ends_at)
      VALUES (${name}, ${userId}, 'clinical_business_monthly', 1, 'active', 'onboarding_pilot',
        ${grant.startedAt}, ${grant.endsAt}) RETURNING id`));
    await tx.execute(sql`INSERT INTO business_members (business_id, user_id, role, relationship_type, status)
      VALUES (${business.id}, ${userId}, 'owner', 'internal_staff', 'active')`);
  }
  const bound = rows(await tx.execute(sql`UPDATE business_pilot_activation_links
    SET business_id = ${business.id}, organization_consumed = true
    WHERE authorization_id = ${grant.authorizationId} AND activated_user_id = ${userId}
      AND business_id IS NULL AND organization_consumed = false RETURNING authorization_id`));
  if (!bound.length) throw new BusinessPilotActivationError("Organization binding requires review.", "PILOT_STATE_INVALID", 503);
  return { businessId: business.id as string };
}
