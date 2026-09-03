import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type {
  HumanFoodContext,
  HumanFoodContextReceipt,
  HumanFoodCreator,
} from "../../../shared/humanFoodContext";

const RECEIPT_TTL_MS = 15 * 60 * 1000;
const MAX_RECEIPTS = 2_000;

interface StoredReceipt {
  context: HumanFoodContext;
  actorUserId: string;
  subjectUserId: string;
  creator: HumanFoodCreator;
  generationChainId: string;
  expiresAtMs: number;
}

const receipts = new Map<string, StoredReceipt>();

function digest(receipt: string): string {
  return createHash("sha256").update(receipt).digest("hex");
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function prune(now = Date.now()): void {
  for (const [key, value] of receipts) {
    if (value.expiresAtMs <= now) receipts.delete(key);
  }
  while (receipts.size >= MAX_RECEIPTS) {
    const oldest = receipts.keys().next().value;
    if (!oldest) break;
    receipts.delete(oldest);
  }
}

export function issueHumanFoodContextReceipt(
  context: HumanFoodContext,
): HumanFoodContextReceipt {
  prune();
  const receipt = randomBytes(32).toString("base64url");
  const expiresAtMs = Math.min(
    Date.parse(context.expiresAt),
    Date.now() + RECEIPT_TTL_MS,
  );
  receipts.set(digest(receipt), {
    context,
    actorUserId: context.actorUserId,
    subjectUserId: context.subjectUserId,
    creator: context.creator,
    generationChainId: context.generationChainId,
    expiresAtMs,
  });
  return {
    receipt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    generationChainId: context.generationChainId,
    correlationId: context.correlationId,
  };
}

export function redeemHumanFoodContextReceipt(input: {
  receipt: string;
  actorUserId: string;
  subjectUserId: string;
  creator: HumanFoodCreator;
  generationChainId?: string | null;
}): HumanFoodContext | null {
  prune();
  if (!input.receipt || input.receipt.length < 32 || input.receipt.length > 128) return null;
  const stored = receipts.get(digest(input.receipt));
  if (!stored) return null;

  const bound =
    same(stored.actorUserId, input.actorUserId) &&
    same(stored.subjectUserId, input.subjectUserId) &&
    stored.creator === input.creator &&
    (!input.generationChainId || same(stored.generationChainId, input.generationChainId));
  if (!bound || stored.expiresAtMs <= Date.now()) return null;
  return stored.context;
}

export function recordRejectedHumanFoodCandidate(
  context: HumanFoodContext,
  signature: string,
): HumanFoodContext {
  const normalized = signature.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 240);
  if (!normalized || context.rejectedCandidateSignatures.includes(normalized)) return context;
  context.rejectedCandidateSignatures.push(normalized);
  return context;
}
