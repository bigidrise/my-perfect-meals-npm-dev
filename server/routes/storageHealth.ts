import { Router } from "express";
import { Client } from "@replit/object-storage";
import { resolveMealImageStorageContext } from "../services/mealImageBucket";

const router = Router();

// Deliberately separate from /health/full's write/read canary. Resolve the same
// authoritative image bucket, then exercise credentials/read access without
// creating, changing, or deleting an object. Empty buckets are valid.
router.get("/", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const context = resolveMealImageStorageContext();
    const result = await new Client({ bucketId: context.bucketId }).list({
      prefix: "health-probe/",
      maxResults: 1,
    });
    if (!result.ok) {
      res.status(503).json({ objectStorage: "unhealthy", probe: "read-only", writeVerified: false });
      return;
    }
    res.json({ objectStorage: "readable", probe: "read-only", writeVerified: false });
  } catch {
    res.status(503).json({ objectStorage: "unhealthy", probe: "read-only", writeVerified: false });
  }
});

export default router;
