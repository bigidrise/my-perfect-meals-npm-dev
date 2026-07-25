import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { studioMemberships, studios } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      studioMembership?: {
        studioId: string;
        clientUserId: string;
        status: string;
        assignedBuilder: string | null;
        activeBoardId: string | null;
        studioName?: string;
        studioOwnerUserId?: string;
      };
    }
  }
}

function getUserId(req: Request): string | null {
  if ((req as any).authUser?.id) return (req as any).authUser.id as string;
  if ((req as any).session?.userId) return (req as any).session.userId as string;
  return null;
}

export async function loadStudioMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) { next(); return; }

    const rows = await db
      .select({
        membershipId: studioMemberships.id,
        studioId: studioMemberships.studioId,
        clientUserId: studioMemberships.clientUserId,
        status: studioMemberships.status,
        activeBoardId: studioMemberships.activeBoardId,
        // Authoritative builder: users.activeBoard (client-owned).
        // studioMemberships.assignedBuilder is a follower cache — not read here.
        activeBoard: users.activeBoard,
        studioName: studios.name,
        studioOwnerUserId: studios.ownerUserId,
      })
      .from(studioMemberships)
      .leftJoin(users, eq(users.id, studioMemberships.clientUserId))
      .leftJoin(studios, eq(studios.id, studioMemberships.studioId))
      .where(
        and(
          eq(studioMemberships.clientUserId, userId),
          eq(studioMemberships.status, "active"),
          eq(studioMemberships.isArchived, false)
        )
      )
      .limit(1);

    if (rows.length > 0) {
      const row = rows[0];
      req.studioMembership = {
        studioId: row.studioId,
        clientUserId: row.clientUserId,
        status: row.status,
        assignedBuilder: row.activeBoard ?? null,
        activeBoardId: row.activeBoardId,
        studioName: row.studioName ?? undefined,
        studioOwnerUserId: row.studioOwnerUserId ?? undefined,
      };
    }

    next();
  } catch (error) {
    console.error("Error loading studio membership:", error);
    next();
  }
}

export function requireStudioMembership(req: Request, res: Response, next: NextFunction) {
  if (!req.studioMembership) {
    return res.status(403).json({ error: "You are not connected to a studio" });
  }

  if (req.studioMembership.status !== "active") {
    return res.status(403).json({ error: "Your studio membership is not active" });
  }

  next();
}

export function enforceAssignedBuilder(allowedBuilders: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.studioMembership) {
      return next();
    }

    // Studio owner is never blocked by builder assignment — they may be enrolled
    // in their own studio as a test client and need access to all routes.
    const userId = getUserId(req);
    if (userId && req.studioMembership.studioOwnerUserId === userId) {
      return next();
    }

    const { assignedBuilder } = req.studioMembership;
    
    if (!assignedBuilder) {
      return res.status(403).json({ 
        error: "No meal builder has been assigned to you yet. Please contact your coach." 
      });
    }

    if (!allowedBuilders.includes(assignedBuilder)) {
      return res.status(403).json({ 
        error: `You are assigned to the ${assignedBuilder} builder. Please use that instead.`,
        assignedBuilder 
      });
    }

    next();
  };
}

export function getClientAssignedBuilder(req: Request): string | null {
  return req.studioMembership?.assignedBuilder || null;
}

export function isStudioClient(req: Request): boolean {
  return !!req.studioMembership;
}

export function getStudioInfo(req: Request): { studioId: string; studioName: string; coachUserId: string } | null {
  if (!req.studioMembership) return null;
  
  return {
    studioId: req.studioMembership.studioId,
    studioName: req.studioMembership.studioName || "Your Coach's Studio",
    coachUserId: req.studioMembership.studioOwnerUserId || "",
  };
}

export function enforceBuilderFromParam(paramName: string = "program") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.studioMembership) {
      return next();
    }

    const userId = getUserId(req);
    if (userId && req.studioMembership.studioOwnerUserId === userId) {
      return next();
    }

    const { assignedBuilder } = req.studioMembership;
    const requestedBuilder = req.params[paramName];
    
    if (!assignedBuilder) {
      return res.status(403).json({ 
        error: "No meal builder has been assigned to you yet. Please contact your coach." 
      });
    }

    if (requestedBuilder && requestedBuilder !== assignedBuilder) {
      return res.status(403).json({ 
        error: `You are assigned to the ${assignedBuilder} builder. Please use that instead.`,
        assignedBuilder 
      });
    }

    next();
  };
}
