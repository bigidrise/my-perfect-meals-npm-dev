import { db } from "../db";
import { clientCycleProtocols, clientNotes, studioMemberships, studios } from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { logClientActivity } from "./activityLog";
import { pushToUser } from "./pushNotify";

export type ProtocolType = "off" | "carbCycle" | "fatCycle";
export type DayType = "low" | "moderate" | "high";

export interface CycleProtocolInput {
  studioId: string;
  clientUserId: string;
  protocolType: ProtocolType;
  dayType: DayType | null;
  updatedByUserId: string;
  updatedByRole: "trainer" | "physician";
}

function buildProtocolLabel(protocolType: ProtocolType, dayType: DayType | null): string {
  if (protocolType === "off") return "Off";
  const typeLabel = protocolType === "carbCycle" ? "Carb Cycling" : "Fat Cycling";
  if (!dayType) return typeLabel;
  const dayLabel = dayType.charAt(0).toUpperCase() + dayType.slice(1);
  return `${typeLabel} — ${dayLabel} Day`;
}

function buildActivityMessage(role: string, protocolType: ProtocolType, dayType: DayType | null): string {
  const roleLabel = role === "physician" ? "Physician" : "Coach";
  const label = buildProtocolLabel(protocolType, dayType);
  if (protocolType === "off") return "Cycle Protocol turned Off";
  return `${roleLabel} changed Cycle Protocol to ${label}`;
}

function buildClientMessage(role: string): string {
  if (role === "physician") return "Your physician updated your nutrition strategy.";
  return "Your nutrition strategy was updated by your coach.";
}

function applyCycleMultipliers(
  starchyCarbs_g: number,
  fat_g: number,
  carbs_g: number,
  protocolType: ProtocolType,
  dayType: DayType | null
): { starchyCarbs_g: number; fat_g: number; carbs_g: number } {
  let starchy = starchyCarbs_g;
  let fat = fat_g;
  let carbs = carbs_g;

  if (protocolType === "carbCycle" && dayType) {
    if (dayType === "low") {
      starchy = 0;
    } else if (dayType === "high") {
      starchy = Math.round(starchy * 1.4);
    }
    const starchyDiff = starchy - starchyCarbs_g;
    carbs = Math.max(0, Math.round(carbs + starchyDiff));
  } else if (protocolType === "fatCycle" && dayType) {
    if (dayType === "low") {
      fat = Math.round(fat * 0.7);
    } else if (dayType === "high") {
      fat = Math.round(fat * 1.3);
    }
  }

  return { starchyCarbs_g: Math.max(0, starchy), fat_g: Math.max(0, fat), carbs_g: Math.max(0, carbs) };
}

export async function applyCycleProtocol(input: CycleProtocolInput): Promise<{ ok: boolean; error?: string }> {
  const { studioId, clientUserId, protocolType, dayType, updatedByUserId, updatedByRole } = input;

  const [clientUser] = await db
    .select({
      id: users.id,
      dailyCalorieTarget: users.dailyCalorieTarget,
      dailyProteinTarget: users.dailyProteinTarget,
      dailyCarbsTarget: users.dailyCarbsTarget,
      dailyFatTarget: users.dailyFatTarget,
      dailyStarchyCarbsTarget: users.dailyStarchyCarbsTarget,
      dailyFibrousCarbsTarget: users.dailyFibrousCarbsTarget,
    })
    .from(users)
    .where(eq(users.id, clientUserId))
    .limit(1);

  if (!clientUser) return { ok: false, error: "Client not found" };

  const [actor] = await db
    .select({ displayName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, updatedByUserId))
    .limit(1);

  const actorName = actor
    ? `${actor.displayName || ""} ${actor.lastName || ""}`.trim() || updatedByRole
    : updatedByRole;

  const currentStarchy = clientUser.dailyStarchyCarbsTarget ?? 0;
  const currentFat = clientUser.dailyFatTarget ?? 0;
  const currentCarbs = clientUser.dailyCarbsTarget ?? 0;

  const adjusted = protocolType === "off"
    ? { starchyCarbs_g: currentStarchy, fat_g: currentFat, carbs_g: currentCarbs }
    : applyCycleMultipliers(currentStarchy, currentFat, currentCarbs, protocolType, dayType);

  const calories = Math.round(
    4 * (clientUser.dailyProteinTarget ?? 0) +
    4 * adjusted.carbs_g +
    9 * adjusted.fat_g
  );

  const activityMsg = buildActivityMessage(updatedByRole, protocolType, dayType);
  const clientMsg = buildClientMessage(updatedByRole);

  await db.transaction(async (tx) => {
    await tx
      .insert(clientCycleProtocols)
      .values({
        studioId,
        clientUserId,
        protocolType,
        dayType: protocolType === "off" ? null : dayType,
        updatedByUserId,
        updatedByRole,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: clientCycleProtocols.clientUserId,
        set: {
          studioId,
          protocolType,
          dayType: protocolType === "off" ? null : dayType,
          updatedByUserId,
          updatedByRole,
          updatedAt: new Date(),
        },
      });

    await tx
      .update(users)
      .set({
        dailyCalorieTarget: calories,
        dailyFatTarget: adjusted.fat_g,
        dailyCarbsTarget: adjusted.carbs_g,
        dailyStarchyCarbsTarget: adjusted.starchyCarbs_g,
        macroCycleMode: protocolType === "off" ? "none" : protocolType,
        macroCycleDayType: protocolType === "off" ? null : dayType,
      })
      .where(eq(users.id, clientUserId));

    await tx.insert(clientNotes).values({
      studioId,
      clientUserId,
      authorUserId: updatedByUserId,
      entryType: "message",
      sender: "pro",
      visibility: "shared_with_client",
      body: clientMsg,
      tags: ["system:cycle_protocol_updated"],
    });
  });

  await logClientActivity(
    studioId,
    clientUserId,
    updatedByUserId,
    "cycle_protocol_updated",
    "cycle_protocol",
    undefined,
    {
      protocolType,
      dayType,
      label: activityMsg,
      updatedByRole,
      actorName,
    }
  );

  pushToUser(clientUserId, {
    title: "Nutrition Plan Updated",
    body: clientMsg,
    url: "/weekly",
  }).catch(() => {});

  return { ok: true };
}

export async function getCycleProtocol(clientUserId: string) {
  const [row] = await db
    .select({
      id: clientCycleProtocols.id,
      protocolType: clientCycleProtocols.protocolType,
      dayType: clientCycleProtocols.dayType,
      updatedByUserId: clientCycleProtocols.updatedByUserId,
      updatedByRole: clientCycleProtocols.updatedByRole,
      updatedAt: clientCycleProtocols.updatedAt,
    })
    .from(clientCycleProtocols)
    .where(eq(clientCycleProtocols.clientUserId, clientUserId))
    .limit(1);

  if (!row) return null;

  const [actor] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, row.updatedByUserId))
    .limit(1);

  return {
    ...row,
    updatedByName: actor
      ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || row.updatedByRole
      : row.updatedByRole,
  };
}
