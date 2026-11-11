import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { ShoppingSelectionValidationError } from "../../shared/mealShoppingSelection";
import {
  shoppingTransferSchemaReady, transferShoppingSelections, clearShoppingTransferCycle,
  ShoppingTransferConflict, type ShoppingSqlPool,
} from "../services/shopping-list/selectionTransfers";

type Dependencies = { authenticate: RequestHandler; pool: () => Promise<ShoppingSqlPool>; enabled: () => boolean };
export function createShoppingClearHandler(deps: Dependencies, destinationOnly = false): RequestHandler {
  return async (req: any, res, next) => {
    if (!deps.enabled()) return next();
    if (destinationOnly && ((req.query.scopeType && req.query.scopeType !== "adhoc") ||
        (req.query.scopeKey && req.query.scopeKey !== "inbox"))) return next();
    try {
      const pool = await deps.pool();
      if (!await shoppingTransferSchemaReady(pool)) return res.status(503).json({ ok: false, message: "Shopping is not ready; the list was not cleared." });
      if (!req.authUser?.id) return res.status(401).json({ ok: false, message: "Sign in first." });
      await clearShoppingTransferCycle(pool, req.authUser.id, destinationOnly);
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, message: "The shopping list was not cleared. Please retry." }); }
  };
}
/** No database module import, schema creation, or activation at module evaluation. */
export function createMealShoppingSelectionsRouter(deps: Dependencies) {
  const router = Router();
  const ready = async () => deps.enabled() && await shoppingTransferSchemaReady(await deps.pool());
  router.get("/selections/capabilities", deps.authenticate, async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.json({ available: await ready(), reason: "Shopping transfers await reviewed migration and activation." }); }
    catch { res.status(503).json({ ok: false, message: "Shopping readiness could not be confirmed. No groceries were changed." }); }
  });
  router.post("/selections", deps.authenticate, async (req: any, res) => {
    try {
      if (!await ready()) return res.status(503).json({ ok: false, code: "SHOPPING_NOT_ACTIVATED",
        message: "Shopping transfers await reviewed migration and activation. No groceries were changed." });
      if (!req.authUser?.id) return res.status(401).json({ ok: false, message: "Sign in before Shopping." });
      const result = await transferShoppingSelections(await deps.pool(), req.authUser.id, req.body);
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ ok: true, ...result });
    } catch (error) {
      const status = error instanceof z.ZodError || error instanceof ShoppingSelectionValidationError
        ? 400 : error instanceof ShoppingTransferConflict ? 409 : 503;
      return res.status(status).json({ ok: false, message: status === 400 ? "Review recipe quantities and selection details."
        : status === 409 ? (error as Error).message : "Shopping was not saved. Please retry; no partial recipe was added." });
    }
  });
  // Only full clear: item-level edits/deletions continue through their existing handlers.
  router.delete("/", deps.authenticate, createShoppingClearHandler(deps));
  return router;
}
