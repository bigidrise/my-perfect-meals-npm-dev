import { db } from "../db";
import { businesses } from "../db/schema/business";
import { organizations } from "../db/schema/organizations";
import { organizationMemberships } from "../db/schema/workspaces";
import {
  changeOrganizationOwnerAttachment,
  OrganizationOwnerAttachmentError,
} from "../services/organizationOwnerAttachment";
import {
  discoverAuthorizedWorkspaces,
  filterDisconnectedOwnerWorkspaces,
} from "../services/organizationWorkspaceService";
import { resolveOwnedOrganizationEntry } from "../services/organizationAccessStatus";

jest.mock("../db", () => ({ db: { transaction: jest.fn(), select: jest.fn() } }));

const businessId = "00000000-0000-4000-8000-000000000111";
const organizationId = "00000000-0000-4000-8000-000000000222";
const ownerId = "owner-1";
const locations = [
  { id: "location-1", organizationId, sourceBusinessId: businessId },
  { id: "location-2", organizationId, sourceBusinessId: businessId },
];

describe("Organization owner attachment", () => {
  let business: { id: string; status: string; organizationId: string; disconnectedAt: Date | null } | null;
  let ownerMembership: { id: string } | null;
  let updates: Array<{ table: unknown; values: Record<string, unknown> }>;
  let personal: { plan: string; subscription: string };
  let studio: { id: string; billing: string };
  let staff: { userId: string; status: string };
  let history: { businessId: string; clients: string[]; settings: string };

  beforeEach(() => {
    business = { id: businessId, status: "active", organizationId, disconnectedAt: null };
    ownerMembership = { id: "owner-membership" };
    updates = [];
    personal = { plan: "clinical", subscription: "sub_personal" };
    studio = { id: "studio-1", billing: "unchanged" };
    staff = { userId: "staff-1", status: "active" };
    history = { businessId, clients: ["client-1"], settings: "preserved" };
    const tx = {
      select: jest.fn(() => ({
        from: (table: unknown) => ({
          where: () => ({
            for: () => ({ limit: async () => business ? [{
              id: business.id, status: business.status,
              organizationId: business.organizationId, disconnectedAt: business.disconnectedAt,
            }] : [] }),
            limit: async () => table === organizations ? [{ id: organizationId }] :
              table === organizationMemberships && ownerMembership ? [ownerMembership] : [],
          }),
        }),
      })),
      update: jest.fn((table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updates.push({ table, values });
            if (table !== businesses || !business) throw new Error("Unexpected update");
            business.disconnectedAt = values.ownerWorkspaceDisconnectedAt as Date | null;
          },
        }),
      })),
    };
    (db.transaction as jest.Mock).mockImplementation(async (callback: (arg: typeof tx) => unknown) =>
      callback(tx));
  });

  it.each([1, 2])("preserves IDs, staff access, billing and history across %i Location(s)", async (count) => {
    const rows = locations.slice(0, count);
    const original = JSON.stringify({ personal, studio, staff, history, rows });
    expect(await changeOrganizationOwnerAttachment(ownerId, businessId, "disconnect"))
      .toEqual({ businessId, organizationId, connected: false });
    expect(filterDisconnectedOwnerWorkspaces(rows, [{ id: businessId, organizationId }])).toEqual([]);
    // Another user has no owner attachment overlay and still sees both locations.
    expect(filterDisconnectedOwnerWorkspaces(rows, [])).toEqual(rows);
    expect(await changeOrganizationOwnerAttachment(ownerId, businessId, "disconnect"))
      .toEqual({ businessId, organizationId, connected: false });
    expect(updates).toHaveLength(1);
    expect(await changeOrganizationOwnerAttachment(ownerId, businessId, "reconnect"))
      .toEqual({ businessId, organizationId, connected: true });
    expect(await changeOrganizationOwnerAttachment(ownerId, businessId, "reconnect"))
      .toEqual({ businessId, organizationId, connected: true });
    expect(updates).toHaveLength(2);
    expect(updates.every((update) => update.table === businesses &&
      Object.keys(update.values).every((key) =>
        key === "ownerWorkspaceDisconnectedAt" || key === "updatedAt"))).toBe(true);
    expect(filterDisconnectedOwnerWorkspaces(rows, [])).toEqual(rows);
    expect(business?.id).toBe(businessId);
    expect(JSON.stringify({ personal, studio, staff, history, rows })).toBe(original);
  });

  it("does not allow a missing owner or revoked owner relationship to mutate anything", async () => {
    business = null;
    await expect(changeOrganizationOwnerAttachment(ownerId, businessId, "disconnect"))
      .rejects.toMatchObject({ status: 404 });
    business = { id: businessId, status: "active", organizationId, disconnectedAt: null };
    ownerMembership = null;
    await expect(changeOrganizationOwnerAttachment(ownerId, businessId, "disconnect"))
      .rejects.toBeInstanceOf(OrganizationOwnerAttachmentError);
    expect(updates).toHaveLength(0);
  });

  it("does not treat an inactive business as an owner-workspace disconnect", async () => {
    business!.status = "cancelled";
    await expect(changeOrganizationOwnerAttachment(ownerId, businessId, "disconnect"))
      .rejects.toBeInstanceOf(OrganizationOwnerAttachmentError);
    expect(updates).toHaveLength(0);
  });

  it("keeps paid renewal controls separate from owner attachment", () => {
    const entry = resolveOwnedOrganizationEntry({
      id: businessId, name: "Team", organizationId, ownerUserId: ownerId,
      status: "active", commercialAccessMode: "paid",
      commercialAccessStartedAt: new Date(), commercialAccessEndsAt: null,
      stripeCustomerId: "cus_kept", stripeSubscriptionId: "sub_kept",
      ownerWorkspaceDisconnectedAt: new Date(),
    }, { state: "ending", paidThrough: "2026-12-01T00:00:00.000Z" });
    expect(entry).toMatchObject({
      addonBusinessId: businessId, canReconnectAddon: true, canDisconnectAddon: false,
      businessId, canManageRenewal: true, state: "ending",
      paidThrough: "2026-12-01T00:00:00.000Z",
    });
  });

  it("hides legacy-linked owner Locations but never a staff member's Locations", () => {
    const legacyLocations = locations.map((location) => ({ ...location, sourceBusinessId: businessId }));
    expect(filterDisconnectedOwnerWorkspaces(legacyLocations, [{ id: businessId, organizationId: null }]))
      .toEqual([]);
    expect(filterDisconnectedOwnerWorkspaces(legacyLocations, [])).toEqual(legacyLocations);
  });

  it("applies the owner-only filter to actual workspace discovery for two Locations", async () => {
    const rows = locations.map((location) => ({
      organizationId, organizationName: "Team", sourceBusinessId: businessId,
      organizationRole: "owner", organizationRelationshipType: "internal_staff",
      locationId: location.id, locationName: location.id,
      locationRole: "owner", isDefault: location.id === "location-1",
    }));
    (db.select as jest.Mock).mockImplementation(() => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              innerJoin: () => ({
                where: () => ({ orderBy: async () => rows }),
              }),
            }),
          }),
        }),
        where: async () => [{ id: businessId, organizationId }],
      }),
    }));
    expect(await discoverAuthorizedWorkspaces(ownerId)).toEqual([]);
    (db.select as jest.Mock).mockImplementation(() => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              innerJoin: () => ({
                where: () => ({ orderBy: async () => rows }),
              }),
            }),
          }),
        }),
        where: async () => [],
      }),
    }));
    expect((await discoverAuthorizedWorkspaces("staff-1"))[0].locations.map((location) => location.id))
      .toEqual(["location-1", "location-2"]);
  });

  it("does not offer Disconnect for expired access or billing that needs review", () => {
    const base = {
      id: businessId, name: "Team", organizationId, ownerUserId: ownerId,
      status: "active" as const, commercialAccessMode: "paid" as const,
      commercialAccessStartedAt: new Date(), commercialAccessEndsAt: null,
      stripeCustomerId: "cus_kept", stripeSubscriptionId: "sub_kept",
      ownerWorkspaceDisconnectedAt: null,
    };
    expect(resolveOwnedOrganizationEntry(base, { state: "needs_review", paidThrough: null })
      .canDisconnectAddon).toBe(false);
    expect(resolveOwnedOrganizationEntry({
      ...base, commercialAccessMode: "onboarding_pilot",
      stripeCustomerId: null, stripeSubscriptionId: null,
      commercialAccessEndsAt: new Date("2020-01-01"),
    }, null).canDisconnectAddon).toBe(false);
  });
});