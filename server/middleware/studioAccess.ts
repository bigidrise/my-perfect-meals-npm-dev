import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { studioMemberships, studios } from "../db/schema/studio";
import { eq } from "drizzle-orm";

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

function getUserId(req: Request): string {
  if ((req as any).session?.userId) return (req as any).session.userId as string;
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) return headerUserId;
  return "00000000-0000-0000-0000-000000000001";
}

export async function loadStudioMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);

    const [membership] = await db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, userId));

    if (membership) {
      const [studio] = await db
        .select()
        .from(studios)
        .where(eq(studios.id, membership.studioId));

      req.studioMembership = {
        studioId: membership.studioId,
        clientUserId: membership.clientUserId,
        status: membership.status,
        assignedBuilder: membership.assignedBuilder,
        activeBoardId: membership.activeBoardId,
        studioName: studio?.name,
        studioOwnerUserId: studio?.ownerUserId,
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
