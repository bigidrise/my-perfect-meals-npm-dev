import type { OrgContext } from "../lib/orgContext";
import type { AuthenticatedUser } from "../middleware/requireAuth";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      orgContext?: OrgContext;
    }
  }
}

export {};
