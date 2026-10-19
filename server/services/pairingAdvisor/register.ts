import type { Express } from "express";
import { ADVISOR_PATH, createAdvisorRouter, type AdvisorRouterOptions } from "../../routes/pairingAdvisor";
import { developmentAdvisorAllowed } from "./policy";

export function registerPairingAdvisor(app: Express, options: AdvisorRouterOptions): boolean {
  // Outside undeployed Development, add NO route, preserving existing Production behavior.
  if (!developmentAdvisorAllowed(options.getRuntime())) return false;
  app.use(ADVISOR_PATH, createAdvisorRouter(options));
  return true;
}
