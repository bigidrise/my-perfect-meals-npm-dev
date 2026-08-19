/**
 * ProCare Invite Routes — token-based deep-link acceptance.
 *
 * GET  /api/procare-invite/token/:token   — public, returns invite preview metadata
 * POST /api/procare-invite/token/:token/accept — authenticated, accepts the invite
 *
 * These routes are mounted without ProCare-professional middleware because the
 * CLIENT (not the trainer) calls them. The service enforces subscription gates.
 */

import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { getInviteMetadata, acceptInviteByToken, type AcceptError } from "../services/procareInviteService";

const router = Router();

// ── GET /token/:token — public invite preview ─────────────────────────────────
router.get("/token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const metadata = await getInviteMetadata(token);
    if (!metadata) {
      return res.status(404).json({ error: "Invitation not found or has expired." });
    }
    // Strip the raw invited email — callers only need the masked form.
    // Returning the full address from an unauthenticated endpoint would let
    // anyone with the URL token enumerate account emails.
    const { invitedEmail: _omit, ...publicMetadata } = metadata;
    res.json(publicMetadata);
  } catch (err) {
    console.error("❌ [ProCareInvite] metadata lookup failed:", err);
    res.status(500).json({ error: "Failed to look up invitation." });
  }
});

// ── POST /token/:token/accept — authenticated, accepts the invite ─────────────
router.post("/token/:token/accept", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;
    const authUser = (req as AuthenticatedRequest).authUser;

    const result = await acceptInviteByToken(
      token,
      authUser.id,
      authUser.planLookupKey ?? null,
      authUser.accessTier,
    );

    if (result.ok) {
      return res.json({ success: true, membership: result.result });
    }

    // strictNullChecks is off in tsconfig.server.json, so discriminated union
    // narrowing doesn't fire. We've already returned in the ok:true branch above,
    // so a cast here is safe and correct at runtime.
    const err = (result as { ok: false; error: AcceptError }).error;
    switch (err.code) {
      case "NOT_FOUND":
        return res.status(404).json({ error: "Invitation not found or has expired." });
      case "EXPIRED":
        return res.status(410).json({
          error: "EXPIRED",
          message: "This invitation has expired. Ask your trainer to send a new one.",
        });
      case "ALREADY_ACCEPTED":
        return res.status(409).json({
          error: "ALREADY_ACCEPTED",
          message: "This invitation has already been used.",
        });
      case "EMAIL_MISMATCH":
        return res.status(403).json({
          error: "EMAIL_MISMATCH",
          message: `This invitation was sent to ${err.maskedEmail}. Please sign in with that account to continue.`,
          maskedEmail: err.maskedEmail,
        });
      case "EMAIL_IDENTITY_REVIEW_REQUIRED":
        return res.status(409).json({
          error: "EMAIL_IDENTITY_REVIEW_REQUIRED",
          message: "This email address is linked to more than one legacy account. An administrator must review the account before it can accept an invitation.",
        });
      case "CLINICAL_REQUIRED":
        return res.status(403).json({
          error: "CLINICAL_REQUIRED",
          message: "A Clinical (Ultimate) subscription is required to connect with a ProCare provider.",
        });
      case "COACH_NOT_SUBSCRIBED":
        return res.status(403).json({
          error: "COACH_NOT_SUBSCRIBED",
          message: "Your trainer does not have an active ProCare subscription.",
        });
      case "LEGAL_REQUIRED":
        return res.status(409).json({
          error: "LEGAL_REACCEPT_REQUIRED",
          missing: err.missing,
          flow: err.flow,
        });
      case "ALREADY_HAS_PROFESSIONAL":
        return res.status(409).json({
          error: "ALREADY_HAS_PROFESSIONAL",
          message: "You already have an active ProCare professional.",
        });
      case "SELF_ACTIVATION":
        return res.status(400).json({
          error: "SELF_ACTIVATION",
          message: "You cannot connect to your own studio.",
        });
      default:
        return res.status(500).json({ error: "Failed to accept invitation. Please try again." });
    }
  } catch (err) {
    console.error("❌ [ProCareInvite] accept failed:", err);
    res.status(500).json({ error: "Failed to accept invitation." });
  }
});

export default router;
