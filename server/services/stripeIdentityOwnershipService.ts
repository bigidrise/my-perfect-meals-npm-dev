import { and, eq } from "drizzle-orm";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";

export class StripeIdentityOwnershipConflictError extends Error {
  constructor() {
    super("Stripe identity is already claimed by a different billing subject");
    this.name = "StripeIdentityOwnershipConflictError";
  }
}

export async function claimStripeIdentityOwnership(
  executor: any,
  input: {
    ownerUserId: string;
    businessId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
): Promise<void> {
  const claims = [
    input.stripeCustomerId
      ? { identityType: "customer", identityValue: input.stripeCustomerId }
      : null,
    input.stripeSubscriptionId
      ? { identityType: "subscription", identityValue: input.stripeSubscriptionId }
      : null,
  ].filter((claim): claim is { identityType: string; identityValue: string } => Boolean(claim));

  for (const claim of claims) {
    await executor
      .insert(stripeIdentityOwners)
      .values({
        ...claim,
        ownerUserId: input.ownerUserId,
        businessId: input.businessId ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    const [stored] = await executor
      .select({
        ownerUserId: stripeIdentityOwners.ownerUserId,
        businessId: stripeIdentityOwners.businessId,
      })
      .from(stripeIdentityOwners)
      .where(and(
        eq(stripeIdentityOwners.identityType, claim.identityType),
        eq(stripeIdentityOwners.identityValue, claim.identityValue),
      ))
      .limit(1);

    if (!stored || stored.ownerUserId !== input.ownerUserId) {
      throw new StripeIdentityOwnershipConflictError();
    }
    if (
      (stored.businessId ?? null) !== (input.businessId ?? null)
    ) {
      throw new StripeIdentityOwnershipConflictError();
    }
  }
}