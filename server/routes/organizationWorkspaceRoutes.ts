import { Router } from "express";
import {
  discoverAuthorizedWorkspaces,
  persistWorkspaceSelection,
  resolveActiveWorkspace,
  WorkspaceContextError,
} from "../services/organizationWorkspaceService";
import { getWorkspaceAvailability } from "../services/workspaceAvailabilityService";

const router = Router();

router.get("/availability", async (req, res) => {
  try {
    const availability = await getWorkspaceAvailability((req as any).authUser.id);
    return res.json({ availability });
  } catch (error) {
    console.error("[workspace-availability] error:", error);
    return res.status(500).json({ error: "Could not load workspace availability." });
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