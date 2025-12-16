import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export const requireId = z.string().uuid();

export const withSchema = <T extends z.ZodTypeAny>(schema: T) => 
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "ValidationError", 
        issues: parsed.error.issues 
      });
    }
    req.body = parsed.data;
    next();
  };