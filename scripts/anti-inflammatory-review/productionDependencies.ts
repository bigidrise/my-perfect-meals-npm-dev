import { createProductionSupportStore } from "./productionStore";
export const fixtureStore = createProductionSupportStore();
export const pool = fixtureStore;

/** Synthetic identity only. This module is substituted ONLY by the offline build. */
export function requireAuth(req: any, res: any, next: () => void) {
  const account = /(?:^|;\s*)fixtureAccount=(synthetic-[ab])(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
  if (!account) return res.status(401).json({ error: "Synthetic fixture authentication required" });
  req.authUser = { id: account };
  next();
}
