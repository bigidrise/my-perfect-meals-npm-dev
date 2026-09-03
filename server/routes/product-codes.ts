// server/routes/product-codes.ts
// Creator System product code activation endpoint.
// Applies a creator system to the authenticated user and logs the redemption.

import { Router } from "express";
import { db } from "../db";
import { users, productCodeRedemptions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { creatorSystems } from "../services/creatorSystems/registry";

const router = Router();

// Map of product codes → system IDs
const PRODUCT_CODE_MAP: Record<string, string> = {
  TESTCREATOR: "test_system",
};

router.post("/apply", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;
  const { code } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing or invalid code" });
  }

  const normalizedCode = code.trim().toUpperCase();
  const systemId = PRODUCT_CODE_MAP[normalizedCode];

  if (!systemId) {
    return res.status(404).json({ error: "Invalid product code" });
  }

  if (!creatorSystems[systemId]) {
    return res.status(500).json({ error: "System not found in registry" });
  }

  try {
    await db
      .update(users)
      .set({ activeSystem: systemId })
      .where(eq(users.id, userId));

    await db.insert(productCodeRedemptions).values({
      userId,
      code: normalizedCode,
      system: systemId,
    });

    console.log(`[CreatorSystem] User ${userId} activated system "${systemId}" via code "${normalizedCode}"`);

    return res.json({ success: true, system: systemId, name: creatorSystems[systemId].name });
  } catch (err: any) {
    console.error("[product-codes] activation failed:", err?.stack || err);
    return res.status(500).json({ error: "Activation failed" });
  }
});

export default router;
