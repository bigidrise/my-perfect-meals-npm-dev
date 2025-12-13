import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";

function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-admin-key");
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function registerAdminSql(app: Express) {
  // One-time route to add Pro subscription columns to users table
  app.post("/api/admin/run-add-pro-columns", requireAdminKey, async (_req, res) => {
    try {
      await db.execute(sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS pro_expires TIMESTAMPTZ;
      `);
      res.json({ ok: true, message: "Pro columns added successfully" });
    } catch (e: any) {
      console.error("ALTER TABLE failed:", e);
      res.status(500).json({ ok: false, error: e?.message || "failed" });
    }
  });
}
