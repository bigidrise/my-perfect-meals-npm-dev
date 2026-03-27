import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { careTeamMember, type Permissions } from "../db/schema/careTeam";
import { clientLinks } from "../db/schema/procare";
import { studios, studioMemberships } from "../db/schema/studio";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";

export interface BoardAccessRequest extends Request {
  authUser: AuthenticatedRequest["authUser"];
  boardAccess?: {
    clientUserId: string;
    proUserId: string;
    role: string;
    permissions: Permissions;
    clientCanEdit: boolean;
    clientEditLastChangedAt: Date | null;
    clientEditLastChangedByRole: string | null;
  };
}

export async function requireBoardAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const clientId = req.params.clientId;
  if (!clientId) {
    res.status(400).json({ error: "Missing clientId" });
    return;
  }

  if (authUser.id === clientId) {
    const activeRelations = await db
      .select({
        clientCanEdit: careTeamMember.clientCanEdit,
        clientEditLastChangedAt: careTeamMember.clientEditLastChangedAt,
        clientEditLastChangedByRole: careTeamMember.clientEditLastChangedByRole,
      })
      .from(careTeamMember)
      .where(
        and(
          eq(careTeamMember.userId, clientId),
          eq(careTeamMember.status, "active")
        )
      );

    const anyLocked = activeRelations.some((r) => !r.clientCanEdit);
    const lockedRelation = activeRelations.find((r) => !r.clientCanEdit) ?? null;

    const clientCanEdit = !anyLocked;
    const clientEditLastChangedAt = lockedRelation?.clientEditLastChangedAt ?? null;
    const clientEditLastChangedByRole = lockedRelation?.clientEditLastChangedByRole ?? null;

    (req as BoardAccessRequest).boardAccess = {
      clientUserId: clientId,
      proUserId: authUser.id,
      role: "client",
      permissions: {
        canViewMacros: true,
        canAddMeals: clientCanEdit,
        canEditPlan: clientCanEdit,
      },
      clientCanEdit,
      clientEditLastChangedAt,
      clientEditLastChangedByRole,
    };
    return next();
  }

  const [relation] = await db
    .select()
    .from(careTeamMember)
    .where(
      and(
        eq(careTeamMember.userId, clientId),
        eq(careTeamMember.proUserId, authUser.id),
        eq(careTeamMember.status, "active")
      )
    )
    .limit(1);

  if (relation) {
    const permissions = relation.permissions as Permissions;
    (req as BoardAccessRequest).boardAccess = {
      clientUserId: clientId,
      proUserId: authUser.id,
      role: relation.role === "trainer" ? "trainer" : "physician",
      permissions,
      clientCanEdit: relation.clientCanEdit,
      clientEditLastChangedAt: relation.clientEditLastChangedAt ?? null,
      clientEditLastChangedByRole: relation.clientEditLastChangedByRole ?? null,
    };
    return next();
  }

  const [activeLink] = await db
    .select()
    .from(clientLinks)
    .where(
      and(
        eq(clientLinks.clientUserId, clientId),
        eq(clientLinks.proUserId, authUser.id),
        eq(clientLinks.active, true)
      )
    )
    .limit(1);

  if (activeLink) {
    (req as BoardAccessRequest).boardAccess = {
      clientUserId: clientId,
      proUserId: authUser.id,
      role: "professional",
      permissions: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
      clientCanEdit: true,
      clientEditLastChangedAt: null,
      clientEditLastChangedByRole: null,
    };
    return next();
  }

  const studioRows = await db
    .select({ ownerUserId: studios.ownerUserId })
    .from(studioMemberships)
    .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
    .where(
      and(
        eq(studioMemberships.clientUserId, clientId),
        eq(studioMemberships.status, "active"),
        eq(studios.status, "active"),
      )
    )
    .limit(1);

  if (studioRows.length > 0 && studioRows[0].ownerUserId === authUser.id) {
    (req as BoardAccessRequest).boardAccess = {
      clientUserId: clientId,
      proUserId: authUser.id,
      role: "professional",
      permissions: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
      clientCanEdit: true,
      clientEditLastChangedAt: null,
      clientEditLastChangedByRole: null,
    };
    return next();
  }

  res.status(403).json({ error: "No active relationship with this client" });
  return;
}
