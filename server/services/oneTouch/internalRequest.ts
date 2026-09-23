import type { Request } from "express";

// This symbol is set only on an in-process request created by the authenticated
// One-Touch router. JSON clients cannot provide it to the manual Creator route.
const oneTouchDiet = Symbol("oneTouchDiet");

export function setOneTouchDiet(request: Request, diet: string | undefined): void {
  if (diet) (request as any)[oneTouchDiet] = diet;
}

export function getOneTouchDiet(request: Request): string | null {
  const value = (request as any)[oneTouchDiet];
  return typeof value === "string" ? value : null;
}