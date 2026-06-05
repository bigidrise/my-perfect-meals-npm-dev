import { Express } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const COACH_PASSWORD = "CoachSandbox2026!";
const CLIENT_PASSWORD = "ClientSandbox2026!";

export function registerSandboxReset(app: Express) {
  app.post("/api/internal/sandbox-pw-reset", async (req, res) => {
    const token = req.headers["x-reset-token"];
    const expected = process.env.SANDBOX_RESET_TOKEN;

    if (!expected || !token || token !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const sandboxUsers = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.isSandbox, true));

      if (sandboxUsers.length === 0) {
        return res.json({ message: "No sandbox users found", updated: 0 });
      }

      const coachHash = await bcrypt.hash(COACH_PASSWORD, 12);
      const clientHash = await bcrypt.hash(CLIENT_PASSWORD, 12);

      const results: { email: string; role: string; status: string }[] = [];

      for (const u of sandboxUsers) {
        const isCoach = u.role === "coach" || u.role === "admin";
        const newHash = isCoach ? coachHash : clientHash;
        await db
          .update(users)
          .set({ password: newHash })
          .where(eq(users.id, u.id));
        results.push({
          email: u.email,
          role: u.role,
          status: `reset to ${isCoach ? "CoachSandbox2026!" : "ClientSandbox2026!"}`,
        });
      }

      console.log(
        `[sandbox-pw-reset] Reset ${results.length} sandbox account(s)`,
      );
      return res.json({ message: "Sandbox passwords reset", updated: results.length, results });
    } catch (err: any) {
      console.error("[sandbox-pw-reset] Error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
}
