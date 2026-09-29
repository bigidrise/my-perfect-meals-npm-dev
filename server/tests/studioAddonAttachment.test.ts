import { db } from "../db";
import { studios, studioBilling } from "../db/schema/studio";
import { changeStudioAddonAttachment, StudioAddonAttachmentError } from "../services/studioAddonAttachment";
import { buildWorkspaceAvailability } from "../services/workspaceAvailabilityService";

jest.mock("../db", () => ({ db: { transaction: jest.fn() } }));

const studioId = "00000000-0000-4000-8000-000000000111";
const ownerId = "studio-owner";

describe("legacy Studio add-on attachment", () => {
  let studio: { id: string; status: string } | null;
  let billing: {
    customerId: string | null; subscriptionId: string | null;
    reservationId: string | null; checkoutSessionId: string | null;
    planKey: string; status: string;
  } | null;
  let updates: Array<{ table: unknown; values: Record<string, unknown> }>;
  let personal: { id: string; plan: string; subscriptionId: string };
  let organization: { id: string; status: string };
  let history: { id: string; studioId: string };

  beforeEach(() => {
    studio = { id: studioId, status: "active" };
    billing = {
      customerId: null, subscriptionId: null, reservationId: null,
      checkoutSessionId: null, planKey: "studio_59", status: "trialing",
    };
    personal = { id: ownerId, plan: "clinical", subscriptionId: "sub_personal" };
    organization = { id: "org-1", status: "active" };
    history = { id: "studio-history", studioId };
    updates = [];
    const tx = {
      select: jest.fn(() => ({
        from: (table: unknown) => ({
          where: () => ({
            for: () => ({
              limit: async () => table === studios ? (studio ? [studio] : []) :
                table === studioBilling ? (billing ? [billing] : []) : [],
            }),
          }),
        }),
      })),
      update: jest.fn((table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              updates.push({ table, values });
              if (table !== studios || !studio) throw new Error("Unexpected table updated");
              studio.status = values.status as string;
              return [{ id: studio.id }];
            },
          }),
        }),
      })),
    };
    (db.transaction as jest.Mock).mockImplementation(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx));
  });

  it("disconnects and reconnects the same Studio without touching Personal, Organization, billing, or history", async () => {
    const unchanged = JSON.stringify({ personal, organization, billing, history });
    expect(await changeStudioAddonAttachment(ownerId, "disconnect"))
      .toEqual({ studioId, status: "disconnected" });
    const hidden = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(), professionalRole: "trainer",
      organizations: [{ id: organization.id, name: "Organization", role: "owner", locations: [] }],
      studioEntitled: true, existingStudioStatus: studio!.status, studioReady: true,
    });
    expect(hidden.personal.available).toBe(true);
    expect(hidden.organization.available).toBe(true);
    expect(hidden.studio.available).toBe(false);
    expect(JSON.stringify({ personal, organization, billing, history })).toBe(unchanged);
    expect(await changeStudioAddonAttachment(ownerId, "disconnect"))
      .toEqual({ studioId, status: "disconnected" });
    expect(updates).toHaveLength(1);

    expect(await changeStudioAddonAttachment(ownerId, "reconnect"))
      .toEqual({ studioId, status: "active" });
    expect(await changeStudioAddonAttachment(ownerId, "reconnect"))
      .toEqual({ studioId, status: "active" });
    expect(updates).toHaveLength(2);
    expect(updates.every(update => update.table === studios)).toBe(true);
    expect(JSON.stringify({ personal, organization, billing, history })).toBe(unchanged);
    const restored = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(), professionalRole: "trainer",
      organizations: [{ id: organization.id, name: "Organization", role: "owner", locations: [] }],
      studioEntitled: true, existingStudioStatus: studio!.status, studioReady: true,
    });
    expect(restored.studio.available).toBe(true);
    expect(restored.organization.available).toBe(true);
  });

  it.each([
    ["paid customer", { customerId: "cus_paid" }],
    ["paid subscription", { subscriptionId: "sub_paid" }],
    ["reserved checkout", { reservationId: "reserved" }],
    ["open checkout", { checkoutSessionId: "cs_pending" }],
    ["nonlegacy plan", { planKey: "studio_pending" }],
    ["nonlegacy status", { status: "active" }],
  ])("rejects %s without changing Studio status", async (_label, change) => {
    billing = { ...billing!, ...change };
    await expect(changeStudioAddonAttachment(ownerId, "disconnect"))
      .rejects.toBeInstanceOf(StudioAddonAttachmentError);
    expect(studio!.status).toBe("active");
    expect(updates).toHaveLength(0);
  });

  it("does not create a Studio when none is attached", async () => {
    studio = null;
    await expect(changeStudioAddonAttachment(ownerId, "reconnect"))
      .rejects.toMatchObject({ status: 404 });
    expect(updates).toHaveLength(0);
  });

  it("does not override a suspended Studio", async () => {
    studio!.status = "suspended";
    await expect(changeStudioAddonAttachment(ownerId, "reconnect"))
      .rejects.toBeInstanceOf(StudioAddonAttachmentError);
    expect(updates).toHaveLength(0);
  });
});