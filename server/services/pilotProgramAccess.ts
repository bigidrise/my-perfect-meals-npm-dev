import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { pilotParticipants, pilotPrograms } from "../db/schema/pilotProgram";
import {
  normalizeEmailIdentity,
  resolveEmailIdentityForEmail,
} from "./emailIdentityService";
import {
  sendPilotActivationEmail,
  sendPilotParticipantActivatedEmail,
} from "./emailService";

const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PILOT_ENTITLEMENT_KEY = "pilot_full_access";

export interface PilotParticipantInput {
  email: string;
  name?: string | null;
  activateNow?: boolean;
}

export interface PilotProvisioningInput {
  programName: string;
  organizationName: string;
  durationDays?: number;
  participants: PilotParticipantInput[];
  createdByUserId: string | null;
  activationBaseUrl: string;
}

function hashActivationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function splitParticipantName(name?: string | null): { firstName: string | null; lastName: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

async function createProvisionedUser(input: {
  email: string;
  name?: string | null;
}): Promise<{ id: string; email: string; username: string }> {
  const opaquePassword = crypto.randomBytes(48).toString("base64url");
  const password = await bcrypt.hash(opaquePassword, 12);
  const usernameStem = input.email.split("@")[0].replace(/[^a-z0-9._-]/gi, "").slice(0, 35) || "pilot";
  const username = `${usernameStem}-pilot-${crypto.randomBytes(4).toString("hex")}`;
  const { firstName, lastName } = splitParticipantName(input.name);

  const [created] = await db.insert(users).values({
    email: input.email,
    username,
    password,
    firstName,
    lastName,
    planLookupKey: null,
    entitlements: [],
  }).returning({
    id: users.id,
    email: users.email,
    username: users.username,
  });

  return created;
}

export async function getActivePilotFullAccess(userId: string, now: Date = new Date()) {
  const [row] = await db
    .select({
      participantId: pilotParticipants.id,
      programId: pilotPrograms.id,
      programName: pilotPrograms.name,
      organizationName: pilotPrograms.organizationName,
      entitlementKey: pilotParticipants.entitlementKey,
      programStatus: pilotPrograms.status,
      programStartAt: pilotPrograms.pilotStartAt,
      programEndAt: pilotPrograms.pilotEndAt,
      startsAt: pilotParticipants.startsAt,
      expiresAt: pilotParticipants.expiresAt,
    })
    .from(pilotParticipants)
    .innerJoin(pilotPrograms, eq(pilotPrograms.id, pilotParticipants.programId))
    .where(and(
      eq(pilotParticipants.userId, userId),
      eq(pilotParticipants.status, "active"),
      eq(pilotParticipants.entitlementKey, PILOT_ENTITLEMENT_KEY),
      isNull(pilotParticipants.revokedAt),
      or(
        eq(pilotPrograms.status, "preparing"),
        and(
          eq(pilotPrograms.status, "active"),
          gt(pilotPrograms.pilotEndAt, now),
        ),
      ),
    ))
    .orderBy(desc(pilotParticipants.expiresAt))
    .limit(1);

  return row ?? null;
}

async function activateParticipantById(participantId: string, password?: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${participantId}))`);

    const [participant] = await tx
      .select({
        id: pilotParticipants.id,
        userId: pilotParticipants.userId,
        status: pilotParticipants.status,
        requiresPasswordSetup: pilotParticipants.requiresPasswordSetup,
        createdByUserId: pilotParticipants.createdByUserId,
        durationDays: pilotPrograms.durationDays,
        programName: pilotPrograms.name,
        programStatus: pilotPrograms.status,
        programStartAt: pilotPrograms.pilotStartAt,
        programEndAt: pilotPrograms.pilotEndAt,
        email: pilotParticipants.email,
        participantName: pilotParticipants.participantName,
      })
      .from(pilotParticipants)
      .innerJoin(pilotPrograms, eq(pilotPrograms.id, pilotParticipants.programId))
      .where(eq(pilotParticipants.id, participantId))
      .limit(1);

    if (!participant?.userId) throw new Error("Pilot participant account is unavailable");
    if (participant.status === "active") {
      const [active] = await tx
        .select()
        .from(pilotParticipants)
        .where(eq(pilotParticipants.id, participantId))
        .limit(1);
      return { participant: active, alreadyActive: true, programName: participant.programName };
    }
    if (participant.status !== "pending") throw new Error("Pilot participation is not pending");
    if (participant.requiresPasswordSetup) {
      if (!password || password.length < 12 || password.length > 128) {
        throw new Error("Password must be between 12 and 128 characters");
      }
      await tx.update(users)
        .set({ password: await bcrypt.hash(password, 12) })
        .where(eq(users.id, participant.userId));
    }

    const activatedAt = new Date();
    const startsAt = participant.programStartAt;
    const expiresAt = participant.programEndAt;
    const [activated] = await tx.update(pilotParticipants).set({
      status: "active",
      activatedAt,
      startsAt,
      expiresAt,
      activationTokenHash: null,
      activationTokenExpiresAt: null,
      requiresPasswordSetup: false,
      updatedAt: activatedAt,
    }).where(and(
      eq(pilotParticipants.id, participant.id),
      eq(pilotParticipants.status, "pending"),
    )).returning();

    if (!activated) throw new Error("Pilot participation was already activated");

    return { participant: activated, alreadyActive: false, programName: participant.programName };
  });
}

export async function inspectPilotActivationToken(token: string) {
  const tokenHash = hashActivationToken(token);
  const [row] = await db
    .select({
      participantId: pilotParticipants.id,
      participantName: pilotParticipants.participantName,
      email: pilotParticipants.email,
      status: pilotParticipants.status,
      requiresPasswordSetup: pilotParticipants.requiresPasswordSetup,
      tokenExpiresAt: pilotParticipants.activationTokenExpiresAt,
      programName: pilotPrograms.name,
      organizationName: pilotPrograms.organizationName,
      durationDays: pilotPrograms.durationDays,
    })
    .from(pilotParticipants)
    .innerJoin(pilotPrograms, eq(pilotPrograms.id, pilotParticipants.programId))
    .where(and(
      eq(pilotParticipants.activationTokenHash, tokenHash),
      eq(pilotParticipants.status, "pending"),
      gt(pilotParticipants.activationTokenExpiresAt, new Date()),
    ))
    .limit(1);
  return row ?? null;
}

export async function activatePilotByToken(token: string, password?: string) {
  const pending = await inspectPilotActivationToken(token);
  if (!pending) throw new Error("Invalid or expired pilot activation link");
  return activateParticipantById(pending.participantId, password);
}

export async function provisionPilotProgram(input: PilotProvisioningInput) {
  const durationDays = input.durationDays ?? 30;
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
    throw new Error("Pilot duration must be between 1 and 365 days");
  }
  if (!input.programName.trim() || !input.organizationName.trim()) {
    throw new Error("Program and organization names are required");
  }
  if (input.participants.length < 1 || input.participants.length > 500) {
    throw new Error("A pilot batch must contain between 1 and 500 participants");
  }

  const [program] = await db.insert(pilotPrograms).values({
    name: input.programName.trim(),
    organizationName: input.organizationName.trim(),
    durationDays,
    createdByUserId: input.createdByUserId,
  }).returning();

  const results: Array<{
    email: string;
    participantId?: string;
    userId?: string;
    status: "active" | "pending" | "failed";
    accountProvisioned?: boolean;
    emailSent?: boolean;
    error?: string;
  }> = [];

  const seen = new Set<string>();
  for (const supplied of input.participants) {
    const normalizedEmail = normalizeEmailIdentity(supplied.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || seen.has(normalizedEmail)) {
      results.push({ email: supplied.email, status: "failed", error: "Invalid or duplicate email" });
      continue;
    }
    seen.add(normalizedEmail);

    try {
      const identity = await resolveEmailIdentityForEmail(normalizedEmail);
      if (identity.status === "ambiguous") {
        throw new Error("Multiple accounts use this normalized email");
      }

      let accountProvisioned = false;
      let user = identity.status === "not_found"
        ? null
        : { id: identity.user.id, email: identity.user.email, username: identity.user.email.split("@")[0] };
      if (!user) {
        user = await createProvisionedUser({ email: normalizedEmail, name: supplied.name });
        accountProvisioned = true;
      }

      const activationToken = crypto.randomBytes(32).toString("hex");
      const activationTokenHash = hashActivationToken(activationToken);
      const now = new Date();
      const [participant] = await db.insert(pilotParticipants).values({
        programId: program.id,
        userId: user.id,
        participantName: supplied.name?.trim() || null,
        email: user.email,
        normalizedEmail,
        status: "pending",
        entitlementKey: PILOT_ENTITLEMENT_KEY,
        requiresPasswordSetup: accountProvisioned,
        activationTokenHash,
        activationTokenExpiresAt: new Date(now.getTime() + ACTIVATION_TOKEN_TTL_MS),
        createdByUserId: input.createdByUserId,
      }).returning();

      if (supplied.activateNow && accountProvisioned) {
        throw new Error("A newly provisioned account must set its password through the activation link");
      }
      if (supplied.activateNow) {
        const activation = await activateParticipantById(participant.id);
        const activeParticipant = activation.participant;
        const emailSent = await sendPilotParticipantActivatedEmail({
          to: user.email,
          userName: supplied.name?.trim() || user.username,
          programName: program.name,
          durationDays,
          pilotStarted: Boolean(activeParticipant.startsAt),
          appUrl: input.activationBaseUrl,
        });
        results.push({
          email: user.email,
          participantId: participant.id,
          userId: user.id,
          status: "active",
          accountProvisioned,
          emailSent,
        });
        continue;
      }

      const activationLink = `${input.activationBaseUrl.replace(/\/$/, "")}/pilot/activate?token=${activationToken}`;
      const emailSent = Boolean(await sendPilotActivationEmail({
        to: user.email,
        userName: supplied.name?.trim() || user.username,
        programName: program.name,
        organizationName: program.organizationName,
        activationLink,
        durationDays,
        requiresPasswordSetup: accountProvisioned,
      }));
      await db.update(pilotParticipants).set({
        activationSentAt: emailSent ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(pilotParticipants.id, participant.id));

      results.push({
        email: user.email,
        participantId: participant.id,
        userId: user.id,
        status: "pending",
        accountProvisioned,
        emailSent,
      });
    } catch (error: any) {
      results.push({
        email: normalizedEmail,
        status: "failed",
        error: error?.message || "Pilot participant provisioning failed",
      });
    }
  }

  return { program, participants: results };
}

export async function startPilotProgram(programId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${programId}))`);
    const [program] = await tx.select().from(pilotPrograms)
      .where(eq(pilotPrograms.id, programId)).limit(1);
    if (!program) throw new Error("Pilot program not found");
    if (program.status === "active") return program;
    if (program.status === "completed") throw new Error("Pilot program is already completed");

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + program.durationDays * 86400000);
    const [started] = await tx.update(pilotPrograms).set({
      status: "active",
      pilotStartAt: startAt,
      pilotEndAt: endAt,
      updatedAt: startAt,
    }).where(and(
      eq(pilotPrograms.id, programId),
      eq(pilotPrograms.status, "preparing"),
    )).returning();
    if (!started) throw new Error("Pilot program was already started");

    await tx.update(pilotParticipants).set({
      startsAt: startAt,
      expiresAt: endAt,
      updatedAt: startAt,
    }).where(and(
      eq(pilotParticipants.programId, programId),
      eq(pilotParticipants.status, "active"),
    ));
    return started;
  });
}