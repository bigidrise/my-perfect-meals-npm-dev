import { Router, Request, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

interface AlcoholEntry {
  id: string;
  userId: string;
  type: string;
  quantity: number;
  notes?: string;
  date: string;
}

// In-memory store for now (swap with DB later)
const alcoholLog: AlcoholEntry[] = [];
const router = Router();

router.post("/alcohol/log", requireAuth, (req: Request, res: Response) => {
  const { type, quantity, notes } = req.body || {};
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (!type || typeof quantity !== "number") {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const entry: AlcoholEntry = {
    id: Date.now().toString(),
    userId,
    type,
    quantity,
    notes,
    date: new Date().toISOString(),
  };
  alcoholLog.push(entry);
  res.status(201).json(entry);
});

router.get("/alcohol/history", requireAuth, (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const history = alcoholLog.filter((e) => e.userId === userId);
  res.json(history);
});

router.delete("/alcohol/:id", requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as AuthenticatedRequest).authUser.id;
  const idx = alcoholLog.findIndex((e) => e.id === id && e.userId === userId);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  alcoholLog.splice(idx, 1);
  res.json({ success: true });
});

export default router;
