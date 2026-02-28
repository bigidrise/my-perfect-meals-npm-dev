import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { careTeamMember, type Permissions } from "../db/schema/careTeam";
import { clientLinks } from "../db/schema/procare";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";

export interface BoardAccessRequest extends Request {
  authUser: AuthenticatedRequest["authUser"];
  boardAccess?: {
    clientUserId: string;
    proUserId: string;
    role: string;
    permissions: Permissions;
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
    (req as BoardAccessRequest).boardAccess = {
      clientUserId: clientId,
      proUserId: authUser.id,
      role: "client",
      permissions: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
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
    };
    return next();
  }

  res.status(403).json({ error: "No active relationship with this client" });
  return;
}
