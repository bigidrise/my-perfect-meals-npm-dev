import { and, eq, or } from "drizzle-orm";
import { db } from "../db";
import { businesses } from "../db/schema/business";
import { organizations } from "../db/schema/organizations";
import { organizationMemberships } from "../db/schema/workspaces";

export class OrganizationOwnerAttachmentError extends Error {
  constructor(message: string, public readonly status: number = 409) {
    super(message);
  }
}

/** Changes only the owner's attachment flag; never the tenant, membership, or billing. */
export async function changeOrganizationOwnerAttachment(
  ownerUserId: string,
  businessId: string,
  action: "disconnect" | "reconnect",
): Promise<{ businessId: string; organizationId: string; connected: boolean }> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({
      id: businesses.id,
      status: businesses.status,
      organizationId: businesses.organizationId,
      disconnectedAt: businesses.ownerWorkspaceDisconnectedAt,
    }).from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
      .for("update").limit(1);
    if (!business) throw new OrganizationOwnerAttachmentError("Organization not found for this owner.", 404);
    if (action === "disconnect" && business.status !== "active") {
      throw new OrganizationOwnerAttachmentError("This Organization is not active. Its billing or access needs review.");
    }
    const linked = await tx.select({ id: organizations.id })
      .from(organizations)
      .where(or(eq(organizations.sourceBusinessId, business.id),
        ...(business.organizationId ? [eq(organizations.id, business.organizationId)] : [])))
      .limit(2);
    if (linked.length !== 1) {
      throw new OrganizationOwnerAttachmentError("Organization workspace linkage needs review. No access was changed.");
    }
    const [owner] = await tx.select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, linked[0].id),
        eq(organizationMemberships.userId, ownerUserId),
        eq(organizationMemberships.role, "owner"),
        eq(organizationMemberships.status, "active")))
      .limit(1);
    if (!owner) throw new OrganizationOwnerAttachmentError("Organization ownership needs review. No access was changed.");
    const connected = action === "reconnect";
    if (connected === (business.disconnectedAt === null)) {
      return { businessId: business.id, organizationId: linked[0].id, connected };
    }
    await tx.update(businesses)
      .set({ ownerWorkspaceDisconnectedAt: connected ? null : new Date(), updatedAt: new Date() })
      .where(and(eq(businesses.id, business.id), eq(businesses.ownerUserId, ownerUserId)));
    return { businessId: business.id, organizationId: linked[0].id, connected };
  });
}