import type { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

// Session validity follows the same cookie-first/security-version/idle-timeout
// boundary as protected APIs. Native bearer credentials remain supported.
export function registerSessionProbeRoutes(router: Router): void {
  router.get("/api/auth/session", requireAuth, (req, res) => {
    const user = (req as AuthenticatedRequest).authUser;
    res.json({
      userId: user.id,
      id: user.id,
      email: user.email,
      username: user.username,
      isTester: user.isTester,
      isFounder: user.isFounder,
      planLookupKey: user.planLookupKey,
      role: user.role,
      isProCare: user.isProCare === true,
    });
  });
}
