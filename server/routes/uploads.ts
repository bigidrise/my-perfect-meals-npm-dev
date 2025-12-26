import { Router } from "express";

export const uploadsRouter = Router();

uploadsRouter.post("/uploads/sign", async (_req, res) => {
  res.status(501).json({ 
    error: "Legacy upload endpoint deprecated. Use /api/uploads/request-url instead." 
  });
});
