import { createHmac, timingSafeEqual } from "node:crypto";
import type { PerformanceMenuAuthority } from "./performanceContext";

export interface PerformanceAuthorityTokenPayload {
  actorUserId: string;
  subjectUserId: string;
  conceptId: string;
  destinationDate: string;
  mealSlot: PerformanceMenuAuthority["slot"];
  builderKey: "performance_competition";
  concept: {
    id: string;
    ideaType: string;
    title: string;
    description: string;
    signature?: string;
    primaryIngredients?: string[];
  };
  authority: PerformanceMenuAuthority;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required for Performance authority tokens.");
  return value;
}

export function issuePerformanceAuthorityToken(
  payload: Omit<PerformanceAuthorityTokenPayload, "expiresAt">,
  ttlMs = 5 * 60 * 1000,
): string {
  const body = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + ttlMs })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPerformanceAuthorityToken(
  token: unknown,
  expected: Pick<PerformanceAuthorityTokenPayload, "actorUserId" | "subjectUserId" | "conceptId">,
): PerformanceAuthorityTokenPayload | null {
  if (typeof token !== "string") return null;
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  const expectedSignature = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(supplied);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PerformanceAuthorityTokenPayload;
    if (payload.expiresAt <= Date.now() ||
      payload.actorUserId !== expected.actorUserId ||
      payload.subjectUserId !== expected.subjectUserId ||
      payload.conceptId !== expected.conceptId ||
      payload.concept?.id !== expected.conceptId ||
      payload.builderKey !== "performance_competition") return null;
    return payload;
  } catch {
    return null;
  }
}