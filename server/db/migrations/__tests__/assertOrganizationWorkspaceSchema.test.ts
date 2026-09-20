import { assertOrganizationWorkspaceSchema } from "../assertOrganizationWorkspaceSchema";

function guardDb(overrides: Record<string, boolean> = {}) {
  return {
    execute: jest.fn(async () => ({
      rows: [{
        organizations_table: true,
        locations_table: true,
        organization_memberships_table: true,
        location_memberships_table: true,
        workspace_selections_table: true,
        location_columns: true,
        organization_membership_columns: true,
        location_membership_columns: true,
        workspace_selection_columns: true,
        organization_source_column: true,
        business_member_location_column: true,
        business_member_relationship_column: true,
        invitation_location_column: true,
        authorization_indexes: true,
        organization_source_unique_index: true,
        location_source_unique_index: true,
        one_default_location_index: true,
        authorization_constraints: true,
        ...overrides,
      }],
    })),
  };
}

describe("assertOrganizationWorkspaceSchema", () => {
  test("compatible organization schema passes with one read-only query", async () => {
    const database = guardDb();
    await expect(
      assertOrganizationWorkspaceSchema(database),
    ).resolves.toBeUndefined();
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  test("missing organization isolation prerequisite fails closed", async () => {
    const database = guardDb({ location_memberships_table: false });
    await expect(
      assertOrganizationWorkspaceSchema(database),
    ).rejects.toThrow(
      "STARTUP GUARD: Organization workspace schema is incomplete",
    );
  });
});