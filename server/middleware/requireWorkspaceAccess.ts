import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { clientLinks } from "../db/schema/procare";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";

export interface WorkspaceAccessRequest extends Request {
  authUser: AuthenticatedRequest["authUser"];
  workspaceClientId: string;
}

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

  if (!activeLink) {
    res.status(403).json({ error: "No active workspace access for this client" });
    return;
  }

  (req as WorkspaceAccessRequest).workspaceClientId = clientId;
  next();
}
