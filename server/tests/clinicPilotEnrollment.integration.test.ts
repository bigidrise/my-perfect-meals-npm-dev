import { createHash, randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { businessMembers, businesses } from "../db/schema/business";
import {
  clinicPilotEnrollmentLinks,
  clinicTrialEntitlements,
  organizationalPilotAuthorizations,
  organizationalPilotParticipants,
  organizationalPilots,
} from "../db/schema/pilotProgram";
import {
  createClinicPilotEnrollmentLink,
  enrollClinicPatient,
  enrollClinicPatientInTransaction,
  inspectClinicPilotEnrollmentLink,
  revokeClinicPilotEnrollmentLink,
} from "../services/clinicPilotEnrollmentService";
import { computeEffectiveAccess } from "../services/effectiveAccess";
import { isBusinessAdmin } from "../routes/clinicPilotRoutes";
import { users } from "@shared/schema";

jest.setTimeout(60_000);

type Fixture = Awaited<ReturnType<typeof createFixture>>;
const fixtures: Fixture[] = [];

async function createUser(overrides: Record<string, unknown> = {}) {
  const suffix = randomUUID();
  const [user] = await db.insert(users).values({
    id: `clinic-test-${suffix}`,
    username: `clinic-test-${suffix}`,
    email: `clinic-test-${suffix}@example.test`,
    password: "not-a-real-password",
    ...overrides,
  } as any).returning();
  return user;
}

async function deleteTestUsers(userIds: string[]) {
  if (userIds.length === 0) return;
  await db.delete(clinicTrialEntitlements)
    .where(sql`${clinicTrialEntitlements.userId} in (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  await db.delete(organizationalPilotParticipants)
    .where(sql`${organizationalPilotParticipants.userId} in (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  await db.delete(users)
    .where(sql`${users.id} in (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
}

async function createFixture(options: {
  linkCapacity?: number;
  pilotCapacity?: number;
  organizationId?: string | null;
} = {}) {
  const owner = await createUser();
  const organizationId = options.organizationId === undefined ? randomUUID() : options.organizationId;
  const [business] = await db.insert(businesses).values({
    name: `Clinic verification ${randomUUID()}`,
    ownerUserId: owner.id,
    status: "active",
    organizationId,
  }).returning();
  const [authorization] = await db.insert(organizationalPilotAuthorizations).values({
    organizationName: "Neutral verification organization",
    championEmail: owner.email,
    normalizedChampionEmail: owner.email.toLowerCase(),
    status: "claimed",
    professionalCapacity: 2,
    clientCapacity: options.pilotCapacity ?? 10,
    durationDays: 30,
    businessId: business.id,
  }).returning();
  const [pilot] = await db.insert(organizationalPilots).values({
    businessId: business.id,
    authorizationId: authorization.id,
    name: "Neutral clinic verification pilot",
    status: "active",
    professionalCapacity: 2,
    clientCapacity: options.pilotCapacity ?? 10,
    durationDays: 30,
    pilotStartAt: new Date(Date.now() - 60_000),
    pilotEndAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByUserId: owner.id,
  }).returning();
  const created = await createClinicPilotEnrollmentLink({
    businessId: business.id,
    pilotId: pilot.id,
    actorUserId: owner.id,
    capacity: options.linkCapacity ?? 10,
  });
  const fixture = { owner, business, authorization, pilot, link: created.link, rawToken: created.rawToken };
  fixtures.push(fixture);
  return fixture;
}

async function counts(fixture: Fixture) {
  const [participantCount] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(organizationalPilotParticipants)
    .where(eq(organizationalPilotParticipants.pilotId, fixture.pilot.id));
  const [entitlementCount] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(clinicTrialEntitlements)
    .where(eq(clinicTrialEntitlements.pilotId, fixture.pilot.id));
  return {
    participants: Number(participantCount.count),
    entitlements: Number(entitlementCount.count),
  };
}

afterAll(async () => {
  for (const fixture of fixtures.reverse()) {
    await db.delete(businesses).where(eq(businesses.id, fixture.business.id));
    await db.delete(users).where(eq(users.id, fixture.owner.id));
  }
});

describe("Clinic pilot database invariants", () => {
  it("serializes simultaneous retries and consumes capacity once", async () => {
    const fixture = await createFixture({ linkCapacity: 1, pilotCapacity: 1 });
    const patient = await createUser();
    try {
      const results = await Promise.all([
        enrollClinicPatient(fixture.rawToken, patient.id),
        enrollClinicPatient(fixture.rawToken, patient.id),
      ]);
      expect(results.filter(result => result.alreadyEnrolled)).toHaveLength(1);
      expect(results.filter(result => !result.alreadyEnrolled)).toHaveLength(1);
      expect(results[0].entitlement.id).toBe(results[1].entitlement.id);
      expect(results[0].entitlement.startsAt.getTime()).toBe(results[1].entitlement.startsAt.getTime());
      expect(results[0].entitlement.endsAt.getTime()).toBe(results[1].entitlement.endsAt.getTime());
      expect(await counts(fixture)).toEqual({ participants: 1, entitlements: 1 });
    } finally {
      await deleteTestUsers([patient.id]);
    }
  });

  it("enforces the user/pilot invariant at the database boundary", async () => {
    const fixture = await createFixture();
    const patient = await createUser();
    try {
      const first = await enrollClinicPatient(fixture.rawToken, patient.id);
      await expect(db.insert(clinicTrialEntitlements).values({
        userId: patient.id,
        pilotId: fixture.pilot.id,
        linkId: fixture.link.id,
        businessId: fixture.business.id,
        organizationId: fixture.business.organizationId,
        participantId: first.entitlement.participantId,
        status: "active",
        provenance: "clinical_trial",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })).rejects.toThrow();
      expect(await counts(fixture)).toEqual({ participants: 1, entitlements: 1 });
    } finally {
      await deleteTestUsers([patient.id]);
    }
  });

  it("allows only one winner when one link slot remains", async () => {
    const fixture = await createFixture({ linkCapacity: 1, pilotCapacity: 10 });
    const patients = await Promise.all([createUser(), createUser()]);
    try {
      const settled = await Promise.allSettled(
        patients.map(patient => enrollClinicPatient(fixture.rawToken, patient.id)),
      );
      expect(settled.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const rejection = settled.find(result => result.status === "rejected") as PromiseRejectedResult;
      expect(rejection.reason.message).toBe("LINK_CAPACITY");
      expect(await counts(fixture)).toEqual({ participants: 1, entitlements: 1 });
    } finally {
      await deleteTestUsers(patients.map(patient => patient.id));
    }
  });

  it("enforces pilot capacity collectively across separate links", async () => {
    const fixture = await createFixture({ linkCapacity: 10, pilotCapacity: 1 });
    const secondLink = await createClinicPilotEnrollmentLink({
      businessId: fixture.business.id,
      pilotId: fixture.pilot.id,
      actorUserId: fixture.owner.id,
      capacity: 10,
    });
    const patients = await Promise.all([createUser(), createUser()]);
    try {
      const settled = await Promise.allSettled([
        enrollClinicPatient(fixture.rawToken, patients[0].id),
        enrollClinicPatient(secondLink.rawToken, patients[1].id),
      ]);
      expect(settled.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const rejection = settled.find(result => result.status === "rejected") as PromiseRejectedResult;
      expect(rejection.reason.message).toBe("PILOT_CLIENT_CAPACITY");
      expect(await counts(fixture)).toEqual({ participants: 1, entitlements: 1 });
    } finally {
      await deleteTestUsers(patients.map(patient => patient.id));
    }
  });

  it("rejects unknown, modified, truncated, revoked, expired, and inactive-context tokens", async () => {
    const fixture = await createFixture();
    expect(await inspectClinicPilotEnrollmentLink("unknown-token")).toBeNull();
    expect(await inspectClinicPilotEnrollmentLink(fixture.rawToken.slice(0, -1))).toBeNull();
    expect(await inspectClinicPilotEnrollmentLink(`${fixture.rawToken.slice(0, -1)}x`)).toBeNull();

    await revokeClinicPilotEnrollmentLink(fixture.link.id, fixture.owner.id, "verification");
    expect((await inspectClinicPilotEnrollmentLink(fixture.rawToken))?.available).toBe(false);
    await expect(enrollClinicPatient(fixture.rawToken, fixture.owner.id)).rejects.toThrow("LINK_REVOKED");

    const expired = await createFixture();
    await db.update(clinicPilotEnrollmentLinks)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(clinicPilotEnrollmentLinks.id, expired.link.id));
    expect((await inspectClinicPilotEnrollmentLink(expired.rawToken))?.available).toBe(false);
    await expect(enrollClinicPatient(expired.rawToken, expired.owner.id)).rejects.toThrow("LINK_EXPIRED");

    const inactivePilot = await createFixture();
    await db.update(organizationalPilots).set({ status: "cancelled" })
      .where(eq(organizationalPilots.id, inactivePilot.pilot.id));
    expect((await inspectClinicPilotEnrollmentLink(inactivePilot.rawToken))?.available).toBe(false);
    await expect(enrollClinicPatient(inactivePilot.rawToken, inactivePilot.owner.id))
      .rejects.toThrow("PILOT_ENROLLMENT_CLOSED");

    const inactiveBusiness = await createFixture();
    await db.update(businesses).set({ status: "cancelled" })
      .where(eq(businesses.id, inactiveBusiness.business.id));
    expect((await inspectClinicPilotEnrollmentLink(inactiveBusiness.rawToken))?.available).toBe(false);
    await expect(enrollClinicPatient(inactiveBusiness.rawToken, inactiveBusiness.owner.id))
      .rejects.toThrow("BUSINESS_INACTIVE");
  });

  it("stores only the token digest and intentionally returns raw material only at creation", async () => {
    const fixture = await createFixture();
    const [stored] = await db.select().from(clinicPilotEnrollmentLinks)
      .where(eq(clinicPilotEnrollmentLinks.id, fixture.link.id));
    expect(stored.tokenHash).toBe(createHash("sha256").update(fixture.rawToken).digest("hex"));
    expect(stored.tokenHash).not.toBe(fixture.rawToken);
    expect(JSON.stringify(stored)).not.toContain(fixture.rawToken);
  });

  it("rolls back participant, entitlement, attribution, and capacity after a controlled failure", async () => {
    const fixture = await createFixture({ linkCapacity: 1, pilotCapacity: 1 });
    const patient = await createUser({ attributionOrganizationId: null });
    try {
      await expect(db.transaction(async tx => {
        await enrollClinicPatientInTransaction(tx, fixture.rawToken, patient.id);
        throw new Error("CONTROLLED_ROLLBACK");
      })).rejects.toThrow("CONTROLLED_ROLLBACK");
      expect(await counts(fixture)).toEqual({ participants: 0, entitlements: 0 });
      const [unchanged] = await db.select({ attributionOrganizationId: users.attributionOrganizationId })
        .from(users).where(eq(users.id, patient.id));
      expect(unchanged.attributionOrganizationId).toBeNull();
      const success = await enrollClinicPatient(fixture.rawToken, patient.id);
      expect(success.alreadyEnrolled).toBe(false);
    } finally {
      await deleteTestUsers([patient.id]);
    }
  });

  it("rolls back a newly inserted account when clinic enrollment fails in the signup transaction", async () => {
    const fixture = await createFixture();
    const patientId = `clinic-signup-rollback-${randomUUID()}`;
    await expect(db.transaction(async tx => {
      await tx.insert(users).values({
        id: patientId,
        username: patientId,
        email: `${patientId}@example.test`,
        password: "not-a-real-password",
      });
      await enrollClinicPatientInTransaction(tx, "invalid-clinic-token", patientId);
    })).rejects.toThrow("LINK_NOT_FOUND");

    const [account] = await db.select({ id: users.id }).from(users)
      .where(eq(users.id, patientId));
    expect(account).toBeUndefined();
    expect(await counts(fixture)).toEqual({ participants: 0, entitlements: 0 });
  });

  it("preserves paid subscription fields and higher effective access", async () => {
    const fixture = await createFixture();
    const patient = await createUser({
      planLookupKey: "mpm_ultimate_monthly",
      subscriptionPlan: "ultimate",
      subscriptionStatus: "active",
      stripeCustomerId: `cus_test_${randomUUID()}`,
      stripeSubscriptionId: `sub_test_${randomUUID()}`,
    });
    try {
      const before = {
        planLookupKey: patient.planLookupKey,
        subscriptionPlan: patient.subscriptionPlan,
        subscriptionStatus: patient.subscriptionStatus,
        stripeCustomerId: patient.stripeCustomerId,
        stripeSubscriptionId: patient.stripeSubscriptionId,
      };
      await enrollClinicPatient(fixture.rawToken, patient.id);
      const [after] = await db.select().from(users).where(eq(users.id, patient.id));
      expect({
        planLookupKey: after.planLookupKey,
        subscriptionPlan: after.subscriptionPlan,
        subscriptionStatus: after.subscriptionStatus,
        stripeCustomerId: after.stripeCustomerId,
        stripeSubscriptionId: after.stripeSubscriptionId,
      }).toEqual(before);
      expect((await computeEffectiveAccess(after)).tier).toBe("ultimate");
    } finally {
      await deleteTestUsers([patient.id]);
    }
  });

  it("preserves public trial history while issuing a separate clinic entitlement", async () => {
    const fixture = await createFixture();
    const trialStartedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const patient = await createUser({
      trialStartedAt,
      trialEndsAt,
      trialSource: "standard_signup",
    });
    try {
      const enrolled = await enrollClinicPatient(fixture.rawToken, patient.id);
      const [after] = await db.select().from(users).where(eq(users.id, patient.id));
      expect(after.trialStartedAt?.getTime()).toBe(trialStartedAt.getTime());
      expect(after.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());
      expect(after.trialSource).toBe("standard_signup");
      expect(enrolled.entitlement.endsAt.getTime()).toBeGreaterThan(trialEndsAt.getTime());
      expect((await computeEffectiveAccess(after)).tier).not.toBe("free");
      const afterPublicExpiry = await computeEffectiveAccess({
        ...after,
        trialEndsAt: new Date(Date.now() - 1_000),
      });
      expect(afterPublicExpiry.tier).not.toBe("free");
    } finally {
      await deleteTestUsers([patient.id]);
    }
  });

  it("revoking a link blocks new enrollment without ending an issued entitlement", async () => {
    const fixture = await createFixture();
    const enrolledPatient = await createUser();
    const newPatient = await createUser();
    try {
      const enrolled = await enrollClinicPatient(fixture.rawToken, enrolledPatient.id);
      await revokeClinicPilotEnrollmentLink(fixture.link.id, fixture.owner.id);
      await expect(enrollClinicPatient(fixture.rawToken, newPatient.id)).rejects.toThrow("LINK_REVOKED");
      const [preserved] = await db.select().from(clinicTrialEntitlements)
        .where(eq(clinicTrialEntitlements.id, enrolled.entitlement.id));
      expect(preserved.status).toBe("active");
      expect(preserved.endsAt.getTime()).toBe(enrolled.entitlement.endsAt.getTime());
    } finally {
      await deleteTestUsers([enrolledPatient.id, newPatient.id]);
    }
  });

  it("derives organization attribution only from the resolved server-side link", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const fixtureA = await createFixture({ organizationId: organizationA });
    await createFixture({ organizationId: organizationB });
    const patient = await createUser();
    try {
      const result = await enrollClinicPatient(fixtureA.rawToken, patient.id);
      expect(result.entitlement.organizationId).toBe(organizationA);
      expect(result.entitlement.organizationId).not.toBe(organizationB);
      const [after] = await db.select({ attributionOrganizationId: users.attributionOrganizationId })
        .from(users).where(eq(users.id, patient.id));
      expect(after.attributionOrganizationId).toBe(organizationA);
    } finally {
      await deleteTestUsers([patient.id]);
    }
  });

  it("isolates link administration between businesses and rejects cross-business pilot creation", async () => {
    const fixtureA = await createFixture();
    const fixtureB = await createFixture();
    const adminA = await createUser();
    const ordinaryA = await createUser();
    await db.insert(businessMembers).values({
      businessId: fixtureA.business.id,
      userId: adminA.id,
      role: "admin",
      status: "active",
    });
    await db.insert(businessMembers).values({
      businessId: fixtureA.business.id,
      userId: ordinaryA.id,
      role: "staff",
      status: "active",
    });
    try {
      expect(await isBusinessAdmin(fixtureA.owner.id, fixtureA.business.id)).toBe(true);
      expect(await isBusinessAdmin(adminA.id, fixtureA.business.id)).toBe(true);
      expect(await isBusinessAdmin(ordinaryA.id, fixtureA.business.id)).toBe(false);
      expect(await isBusinessAdmin(fixtureA.owner.id, fixtureB.business.id)).toBe(false);
      expect(await isBusinessAdmin(adminA.id, fixtureB.business.id)).toBe(false);

      await expect(createClinicPilotEnrollmentLink({
        businessId: fixtureA.business.id,
        pilotId: fixtureB.pilot.id,
        actorUserId: fixtureA.owner.id,
      })).rejects.toThrow("PILOT_ENROLLMENT_CLOSED");

      const [unchangedB] = await db.select({ status: clinicPilotEnrollmentLinks.status })
        .from(clinicPilotEnrollmentLinks)
        .where(eq(clinicPilotEnrollmentLinks.id, fixtureB.link.id));
      expect(unchangedB.status).toBe("active");
    } finally {
      await db.delete(businessMembers).where(and(
        eq(businessMembers.businessId, fixtureA.business.id),
        sql`${businessMembers.userId} in (${adminA.id}, ${ordinaryA.id})`,
      ));
      await deleteTestUsers([adminA.id, ordinaryA.id]);
    }
  });
});