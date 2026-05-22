import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { clientLinks } from "../db/schema/procare";
import { studios, studioMemberships } from "../db/schema/studio";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";
import { assertSameOrg, OrgIsolationError, handleOrgIsolationError } from "../lib/orgIsolation";

export interface WorkspaceAccessRequest extends Request {
  authUser: AuthenticatedRequest["authUser"];
  workspaceClientId: string;
}

export interface WorkspaceRequest extends Request {
  authUser: AuthenticatedRequest["authUser"];
  workspace: {
    actorUserId: string;
    workspaceUserId: string;
    boardLocked: boolean;
  };
}

/**
 * Workspace Context Middleware
 *
 * Validates that the logged-in professional has an active relationship with
 * the target client (via clientLinks or studio membership), then attaches
 * workspace context to the request:
 *
 *   req.workspace.actorUserId    — the logged-in pro's user ID
 *   req.workspace.workspaceUserId — the client's real user UUID (:clientId param)
 *   req.workspace.boardLocked    — true if mealBoardControl === 'professional'
 *
 * Architecture rule: actorUserId ≠ workspaceUserId.
 * Every endpoint using this middleware operates inside a client's workspace,
 * not on behalf of the pro themselves.
 *
 * Returns 401 if not authenticated, 400 if clientId param missing,
 * 403 if no active relationship exists.
 */
export async function requireWorkspaceAccess(
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

  // Org isolation — reject cross-tenant workspace access before any DB query
  try {
    await assertSameOrg(authUser.id, clientId);
  } catch (err) {
    if (handleOrgIsolationError(err, res)) return;
    res.status(500).json({ error: "Failed to verify workspace access" });
    return;
  }

  try {
    const [activeLink] = await db
      .select({ mealBoardControl: clientLinks.mealBoardControl })
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
      (req as WorkspaceAccessRequest).workspaceClientId = clientId;
      (req as WorkspaceRequest).workspace = {
        actorUserId: authUser.id,
        workspaceUserId: clientId,
        boardLocked: activeLink.mealBoardControl === "professional",
      };
      next();
      return;
    }

    const [studioMember] = await db
      .select({ id: studioMemberships.id })
      .from(studioMemberships)
      .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
      .where(
        and(
          eq(studios.ownerUserId, authUser.id),
          eq(studioMemberships.clientUserId, clientId)
        )
      )
      .limit(1);

    if (studioMember) {
      (req as WorkspaceAccessRequest).workspaceClientId = clientId;
      (req as WorkspaceRequest).workspace = {
        actorUserId: authUser.id,
        workspaceUserId: clientId,
        boardLocked: false,
      };
      next();
      return;
    }

    res.status(403).json({ error: "No active workspace access for this client" });
  } catch (error) {
    console.error("[requireWorkspaceAccess]", error);
    res.status(500).json({ error: "Failed to verify workspace access" });
  }
}
