import type { Request, RequestHandler } from "express";
import { requireClientWorkspaceAccess, type WorkspaceRequest } from "./requireWorkspaceAccess";

/** Shared conversation policy for every runtime; the name is retained for callers. */
export function developmentClientConversationEnabled(
  _env?: Record<string, string | undefined>,
): boolean {
  return true;
}

export const requireDevelopmentClientConversation: RequestHandler = (req, res, next) => {
  return requireClientWorkspaceAccess(req, res, next);
};

/** No second lookup or legacy fallback after the relationship authorization check. */
export function authorizedDevelopmentStudio(req: Request): string | null {
  return (req as WorkspaceRequest).workspace?.studioId ?? null;
}
