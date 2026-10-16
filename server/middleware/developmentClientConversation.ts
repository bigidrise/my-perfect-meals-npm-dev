import type { Request, RequestHandler } from "express";
import { requireClientWorkspaceAccess, type WorkspaceRequest } from "./requireWorkspaceAccess";

/** Preview-only correction. Deployed builds keep the existing release boundary. */
export function developmentClientConversationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT;
}

export const requireDevelopmentClientConversation: RequestHandler = (req, res, next) => {
  if (!developmentClientConversationEnabled()) return next();
  return requireClientWorkspaceAccess(req, res, next);
};

/** No second lookup or legacy fallback after the Development authorization check. */
export function authorizedDevelopmentStudio(req: Request): string | null {
  return (req as WorkspaceRequest).workspace?.studioId ?? null;
}
