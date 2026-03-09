import type { Request } from "express";

export function getAuthUserId(req: Request): string {
  const authUser = (req as any).authUser;
  if (!authUser?.id) {
    const err: any = new Error("Authentication required");
    err.status = 401;
    throw err;
  }
  return authUser.id as string;
}
