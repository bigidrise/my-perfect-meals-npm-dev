import { ACCENTS, Accent } from "@/lib/accents";

export const ROUTE_ACCENT: Record<string, Accent> = {
  "/weekly-meal-board": "emerald",
  "/weekly": "emerald",
  "/macro-counter": "sky",
  "/plan/beverage-hub": "sky",
  "/fast-food": "orange",
  "/diabetic": "green",
  "/diabetic-menu-builder": "green",
  "/diabetic-menu-board": "green",
  "/medical-diet": "red",
  "/clinical-lifestyle-hub": "sky",
  "/smart-menu": "purple",
  "/smart-menu-builder": "purple",
  "/glp1": "teal",
  "/glp1-meal-builder": "teal",
  "/specialty-diets": "emerald",
  "/plan-builder-hub": "indigo",
  "/dashboard": "indigo",
};

export function getAccentForPath(pathname: string) {
  return ACCENTS[ROUTE_ACCENT[pathname] ?? "emerald"];
}
