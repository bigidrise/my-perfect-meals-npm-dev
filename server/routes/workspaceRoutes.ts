import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireWorkspaceAccess, WorkspaceAccessRequest } from "../middleware/requireWorkspaceAccess";

const router = Router();

router.get("/:clientId", requireWorkspaceAccess, async (req, res) => {
  try {
    const { workspaceClientId } = req as WorkspaceAccessRequest;

    const [client] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        selectedMealBuilder: users.selectedMealBuilder,
        activeBoard: users.activeBoard,
        dailyCalorieTarget: users.dailyCalorieTarget,
        dailyProteinTarget: users.dailyProteinTarget,
        dailyCarbsTarget: users.dailyCarbsTarget,
        dailyFatTarget: users.dailyFatTarget,
        height: users.height,
        weight: users.weight,
        age: users.age,
        medicalConditions: users.medicalConditions,
        healthConditions: users.healthConditions,
      })
      .from(users)
      .where(eq(users.id, workspaceClientId))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    res.json({ client });
  } catch (error) {
    console.error("[Workspace] Error fetching client workspace:", error);
    res.status(500).json({ error: "Failed to load workspace" });
  }
});

export default router;
