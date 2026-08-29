import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const HANDOFF_TTL_MS = 30 * 60 * 1000;

const handoffPayloadSchema = z.object({
  v: z.literal(1),
  userId: z.string().min(1),
  door: z.enum(["everyday", "athletic", "liquid_nutrition"]),
  description: z.string().trim().min(1).max(1200),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
}).strict();

export type HydrationHandoffPayload = z.infer<typeof handoffPayloadSchema>;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required for Hydration handoffs");
  return value;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function issueHydrationHandoff(input: {
  userId: string;
  door: HydrationHandoffPayload["door"];
  description: string;
  now?: Date;
}): { token: string; payload: HydrationHandoffPayload } {
  const now = input.now ?? new Date();
  const payload = handoffPayloadSchema.parse({
    v: 1,
    userId: input.userId,
    door: input.door,
    description: input.description,
    issuedAt: now.getTime(),
    expiresAt: now.getTime() + HANDOFF_TTL_MS,
  });
  const encodedPayload = encode(JSON.stringify(payload));
  return { token: `${encodedPayload}.${sign(encodedPayload)}`, payload };
}

export function verifyHydrationHandoff(input: {
  token: string;
  userId: string;
  now?: Date;
}): HydrationHandoffPayload {
  const [encodedPayload, signature, extra] = input.token.split(".");
  if (!encodedPayload || !signature || extra) throw new Error("HYDRATION_HANDOFF_INVALID");
  const expected = Buffer.from(sign(encodedPayload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("HYDRATION_HANDOFF_INVALID");
  }
  const payload = handoffPayloadSchema.parse(
    JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
  );
  const now = input.now ?? new Date();
  if (payload.userId !== input.userId) throw new Error("HYDRATION_HANDOFF_WRONG_ACCOUNT");
  if (payload.expiresAt <= now.getTime()) throw new Error("HYDRATION_HANDOFF_EXPIRED");
  return payload;
}