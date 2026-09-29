import { Router } from "express";
import {
  discoverAuthorizedWorkspaces,
  persistWorkspaceSelection,
  resolveActiveWorkspace,
  WorkspaceContextError,
} from "../services/organizationWorkspaceService";
import { getStudioAccessStatus, getWorkspaceAvailability } from "../services/workspaceAvailabilityService";
import { getOrganizationAccessStatus } from "../services/organizationAccessStatus";
import Stripe from "stripe";
import { requireAuth } from "../middleware/requireAuth";
import { assertStripeBillingOwnership, getStripeKeyMode } from "../services/stripeRuntimePolicy";
import { changeStudioRenewal, StudioBillingReviewError } from "../services/studioRenewalService";
import {
  changeOrganizationRenewal,
  OrganizationBillingReviewError,
} from "../services/organizationBillingLifecycleService";
import { changeStudioAddonAttachment, StudioAddonAttachmentError } from "../services/studioAddonAttachment";

const router = Router();

router.get("/availability", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const availability = await getWorkspaceAvailability((req as any).authUser.id);
    return res.json({ availability });
  } catch (error) {
    console.error("[workspace-availability] error:", error);
    return res.status(500).json({ error: "Could not load workspace availability." });
  }
});

router.get("/studio-access", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  try {
    return res.json({ studioAccess: await getStudioAccessStatus((req as any).authUser.id) });
  } catch (error) {
    console.error("[studio-access] error:", error);
    return res.status(500).json({ error: "Could not load Studio access." });
  }
});

router.post("/studio-access/addon/:action", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.params.action !== "disconnect" && req.params.action !== "reconnect") {
    return res.status(404).json({ error: "Unknown Studio action." });
  }
  try {
    const studio = await changeStudioAddonAttachment((req as any).authUser.id, req.params.action);
    return res.json({ studio });
  } catch (error) {
    if (error instanceof StudioAddonAttachmentError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[studio-addon] unable to change attachment", error);
    return res.status(503).json({ error: "Unable to verify Studio access right now. No change was confirmed." });
  }
});

router.post("/studio-access/:action", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.params.action !== "end" && req.params.action !== "keep") {
    return res.status(404).json({ error: "Unknown Studio action." });
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  // The running Development app must not operate on live Production billing,
  // even if a shared environment accidentally configures an owner override.
  const deployed = process.env.REPLIT_DEPLOYMENT === "1" ||
    process.env.REPLIT_DEPLOYMENT === "true";
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true" || !stripeKey ||
      (!deployed && getStripeKeyMode(stripeKey) !== "TEST")) {
    return res.status(503).json({ error: "Studio billing changes are not available." });
  }
  try {
    assertStripeBillingOwnership(stripeKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-10-29.clover" });
    const billing = await changeStudioRenewal({
      userId: (req as any).authUser.id,
      action: req.params.action,
      stripe,
    });
    return res.json({ billing });
  } catch (error) {
    if (error instanceof StudioBillingReviewError) {
      return res.status(409).json({ error: error.message, code: "STUDIO_BILLING_NEEDS_REVIEW" });
    }
    console.error("[studio-renewal] unable to verify requested change", error);
    return res.status(503).json({
      error: "Unable to confirm the Studio renewal change. Please refresh before trying again.",
    });
  }
});

router.get("/organization-access", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  try {
    return res.json({ organizationAccess: await getOrganizationAccessStatus((req as any).authUser.id) });
  } catch (error) {
    console.error("[organization-access] error:", error);
    return res.status(500).json({ error: "Could not load Organization access." });
  }
});

router.post("/organization-access/:businessId/:action", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const { businessId, action } = req.params;
  if (action !== "end" && action !== "keep") {
    return res.status(404).json({ error: "Unknown Organization action." });
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const deployed = process.env.REPLIT_DEPLOYMENT === "1" ||
    process.env.REPLIT_DEPLOYMENT === "true";
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true" || !stripeKey ||
      (!deployed && getStripeKeyMode(stripeKey) !== "TEST")) {
    return res.status(503).json({ error: "Organization billing changes are not available." });
  }
  try {
    assertStripeBillingOwnership(stripeKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-10-29.clover" });
    const billing = await changeOrganizationRenewal({
      ownerUserId: (req as any).authUser.id,
      businessId,
      action,
      stripe,
    });
    return res.json({ billing });
  } catch (error) {
    if (error instanceof OrganizationBillingReviewError) {
      return res.status(409).json({
        error: error.message,
        code: "ORGANIZATION_BILLING_NEEDS_REVIEW",
      });
    }
    console.error("[organization-renewal] unable to verify requested change", error);
    return res.status(503).json({
      error: "Unable to confirm the Organization renewal change. Please refresh before trying again.",
    });
  }
});

function sessionSelection(req: any) {
  const organizationId = req.session?.activeOrganizationId;
  const locationId = req.session?.activeLocationId;
  return typeof organizationId === "string" && typeof locationId === "string"
    ? { organizationId, locationId }
    : null;
}

function handleWorkspaceError(res: any, error: unknown) {
  if (error instanceof WorkspaceContextError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error("[organization-workspace] error:", error);
  return res.status(500).json({ error: "Server error." });
}

router.get("/options", async (req, res) => {
  try {
    const organizations = await discoverAuthorizedWorkspaces(
      (req as any).authUser.id,
    );
    return res.json({ organizations });
  } catch (error) {
    return handleWorkspaceError(res, error);
  }
});

router.get("/active", async (req, res) => {
  try {
    const context = await resolveActiveWorkspace(
      (req as any).authUser.id,
      sessionSelection(req),
    );
    req.session.activeOrganizationId = context.organizationId;
    req.session.activeLocationId = context.locationId;
    return res.json({ workspace: context });
  } catch (error) {
    if (
      error instanceof WorkspaceContextError
      && error.code === "INVALID_WORKSPACE_SELECTION"
    ) {
      delete req.session.activeOrganizationId;
      delete req.session.activeLocationId;
    }
    return handleWorkspaceError(res, error);
  }
});

router.post("/select", async (req, res) => {
  const organizationId =
    typeof req.body?.organizationId === "string" ? req.body.organizationId : "";
  const locationId =
    typeof req.body?.locationId === "string" ? req.body.locationId : "";
  if (!organizationId || !locationId) {
    return res.status(400).json({
      error: "organizationId and locationId are required.",
      code: "WORKSPACE_SELECTION_REQUIRED",
    });
  }

  try {
    const context = await persistWorkspaceSelection(
      (req as any).authUser.id,
      organizationId,
      locationId,
    );
    req.session.activeOrganizationId = context.organizationId;
    req.session.activeLocationId = context.locationId;
    return res.json({ workspace: context });
  } catch (error) {
    return handleWorkspaceError(res, error);
  }
});

export default router;