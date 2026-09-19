import { createHmac } from "node:crypto";
import type { MyPerfectMenuCategory, MyPerfectMenuContextStamp } from "@shared/myPerfectMenu";
import type { MyPerfectMenuBuilderContext } from "@shared/builderNamespaces";

export interface MyPerfectMenuAuthorityMaterial {
  subject: { kind: "user" | "household"; id: string };
  effectiveDiet: string[];
  allergies: string[];
  avoidances: string[];
  dislikes: string[];
  cuisine: string | null;
  foodsIEnjoy: string[];
  diabetes: {
    applicable: boolean;
    state: string;
    activePreferences: string[];
    producePreferences: string[];
  };
  protocol: { classification: string[]; active: boolean; conditionKeys: string[] };
  glp1: { active: boolean; escalation: boolean; adaptationState: string };
  targetPresence: Record<string, boolean>;
  builder: Pick<MyPerfectMenuBuilderContext, "key" | "namespace">;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  }
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

/** Server-only, deterministic authority stamp. It deliberately accepts only
 * coarse clinical state; callers must never pass values, medication, labs, or dates. */
export function buildMyPerfectMenuContextStamp(
  material: MyPerfectMenuAuthorityMaterial,
  category: MyPerfectMenuCategory,
  generatedAt = new Date(),
): MyPerfectMenuContextStamp {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to build My Perfect Menu context stamps.");
  const authority = normalize({ ...material, category });
  const digest = createHmac("sha256", secret)
    .update(JSON.stringify(authority))
    .digest("base64url");
  return {
    version: 1, digest, generatedAt: generatedAt.toISOString(), subjectId: material.subject.id, category,
    builderKey: material.builder.key, builderNamespace: material.builder.namespace,
  };
}

export function isMyPerfectMenuContextStampFresh(
  persisted: MyPerfectMenuContextStamp | undefined,
  current: MyPerfectMenuContextStamp,
): boolean {
  return Boolean(persisted && persisted.version === 1 &&
    persisted.subjectId === current.subjectId &&
    persisted.category === current.category &&
    persisted.digest === current.digest);
}