import { Router, Request, Response } from "express";

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

router.post("/alcohol/log", (req: Request, res: Response) => {
  const { userId, type, quantity, notes } = req.body || {};
  if (!userId || !type || typeof quantity !== "number") {
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

router.get("/alcohol/history", (req: Request, res: Response) => {
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const history = alcoholLog.filter((e) => e.userId === userId);
  res.json(history);
});

router.delete("/alcohol/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = alcoholLog.findIndex((e) => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  alcoholLog.splice(idx, 1);
  res.json({ success: true });
});

export default router;
