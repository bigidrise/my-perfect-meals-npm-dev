import router from "../routes/affiliateRoutes";
import { db } from "../db";
import {
  resolveOrganizationPartnerLifecycle, ensureOrganizationPartnerRevenueShell,
} from "../services/organizationPartnerRevenueService";
import {
  createOrganizationRewardfulAffiliate, getRewardfulCampaign,
} from "../services/rewardfulApi";
import { verifyOrganizationRewardfulPayment, FOUNDING_ORGANIZATION_CAMPAIGN } from "../services/organizationRewardfulPolicy";
import { resolveActiveWorkspace } from "../services/organizationWorkspaceService";

jest.mock("../db", () => ({ db: {
  select: jest.fn(), update: jest.fn(), transaction: jest.fn(),
} }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: jest.fn() }));
jest.mock("../middleware/requireEmailService", () => ({
  requireEmailService: jest.fn(), emailServiceAvailable: jest.fn(),
}));
jest.mock("../services/emailService", () => ({
  sendAffiliateReferralInvite: jest.fn(), sendRewardfulConnectionConfirmationEmail: jest.fn(),
}));
jest.mock("../services/affiliateEligibility", () => ({ checkBusinessAffiliateEligibility: jest.fn() }));
jest.mock("../services/organizationWorkspaceService", () => ({ resolveActiveWorkspace: jest.fn() }));
jest.mock("../services/organizationPartnerRevenueService", () => ({
  affiliateAccountScope: (id: string) => id, partnerRecordScope: (id: string) => id,
  ensureOrganizationPartnerRevenueShell: jest.fn(), resolveOrganizationPartnerLifecycle: jest.fn(),
}));
jest.mock("../services/rewardfulApi", () => ({
  createOrganizationRewardfulAffiliate: jest.fn(), getRewardfulCampaign: jest.fn(),
  getRewardfulMagicLink: jest.fn().mockResolvedValue(null),
  RewardfulAffiliateConflictError: class extends Error {},
}));
jest.mock("../services/organizationRewardfulPolicy", () => ({
  ...jest.requireActual("../services/organizationRewardfulPolicy"),
  verifyOrganizationRewardfulPayment: jest.fn(),
}));

const mock = (value: unknown) => value as jest.Mock;
const account = { id: "shell", organizationId: "selected-organization",
  rewardfulAffiliateId: null, rewardfulState: "not_activated" };
const affiliate = { id: "new-affiliate", state: "active", links: [],
  campaign: { id: FOUNDING_ORGANIZATION_CAMPAIGN.id } };
const campaign = { ...FOUNDING_ORGANIZATION_CAMPAIGN, reward_type: "percent",
  commission_percent: 50, max_commission_period_months: 48 };
const workspace = { organizationId: "selected-organization", organizationName: "Test organization",
  organizationRole: "owner", organizationRelationshipType: "internal_staff" };

describe("future organization setup route (all persistence and providers mocked)", () => {
  let selections: unknown[][];
  let persisted: Record<string, unknown>[];
  const priorEnvironment = process.env.NODE_ENV;
  // Existing configured credential is never inspected; only absence is stubbed.
  let credentialWasAbsent: boolean;
  beforeAll(() => {
    credentialWasAbsent = !process.env.REWARDFUL_API_SECRET;
    if (credentialWasAbsent) process.env.REWARDFUL_API_SECRET = "mock-not-a-credential";
  });
  afterAll(() => {
    process.env.NODE_ENV = priorEnvironment;
    if (credentialWasAbsent) delete process.env.REWARDFUL_API_SECRET;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "development";
    selections = [[account], [{ rewardfulAffiliateId: null }], [{ businesses: { id: "business" } }],
      [{ commissionRate: 50, commissionMonths: 48, referralCampaignName: FOUNDING_ORGANIZATION_CAMPAIGN.name }]];
    persisted = [];
    mock(db.select).mockImplementation(() => {
      const chain: any = {};
      for (const key of ["from", "innerJoin", "where"]) chain[key] = jest.fn(() => chain);
      chain.limit = jest.fn(async () => selections.shift());
      return chain;
    });
    mock(db.update).mockImplementation(() => ({
      set: jest.fn(() => ({ where: jest.fn(() => ({
        returning: jest.fn(async () => [{ id: "claim" }]),
      })) })),
    }));
    mock(db.transaction).mockImplementation(async callback => callback({
      update: () => ({
        set: (values: Record<string, unknown>) => {
          persisted.push(values);
          return { where: () => ({ returning: async () => [{
            ...account, rewardfulAffiliateId: affiliate.id,
            rewardfulState: "active", rewardfulCampaignId: campaign.id,
          }] }) };
        },
      }),
      insert: () => ({ values: jest.fn() }),
    }));
    mock(resolveActiveWorkspace).mockResolvedValue(workspace);
    mock(resolveOrganizationPartnerLifecycle).mockResolvedValue({ setupAvailable: true });
    mock(verifyOrganizationRewardfulPayment).mockResolvedValue(true);
    mock(getRewardfulCampaign).mockResolvedValue(campaign);
    mock(createOrganizationRewardfulAffiliate).mockResolvedValue(affiliate);
  });
  async function invoke() {
    const layer = (router as any).stack.find((layer: any) => layer.route?.path === "/organization/setup");
    const handler = layer.route.stack.at(-1).handle;
    const res: any = { status: jest.fn(() => res), json: jest.fn(() => res) };
    await handler({
      authUser: { id: "actor" }, body: { email: "organization@example.invalid", contactName: "Organization Contact" },
    }, res);
    return res;
  }
  test("creates through the API with the exact 50% campaign and saves 48-month terms", async () => {
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(createOrganizationRewardfulAffiliate).toHaveBeenCalledWith({
      firstName: "Organization", lastName: "Contact", email: "organization@example.invalid",
      campaignId: FOUNDING_ORGANIZATION_CAMPAIGN.id,
    });
    expect(persisted[1]).toMatchObject({ commissionRate: 50, commissionMonths: 48,
      referralCampaignName: FOUNDING_ORGANIZATION_CAMPAIGN.name, rewardfulAffiliateId: "new-affiliate" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      organizationRewardfulTerms: FOUNDING_ORGANIZATION_CAMPAIGN,
    }));
    expect(ensureOrganizationPartnerRevenueShell).toHaveBeenCalledWith(db, {
      userId: "actor", organizationId: workspace.organizationId, organizationName: workspace.organizationName,
    });
  });
  test("ineligible trial or unpaid lifecycle rejects before provider calls and claims", async () => {
    mock(resolveOrganizationPartnerLifecycle).mockResolvedValue({ setupAvailable: false });
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(verifyOrganizationRewardfulPayment).not.toHaveBeenCalled();
    expect(createOrganizationRewardfulAffiliate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test("unverified payment rejects before campaign lookup, claims, and creation", async () => {
    mock(verifyOrganizationRewardfulPayment).mockResolvedValue(false);
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(getRewardfulCampaign).not.toHaveBeenCalled();
    expect(createOrganizationRewardfulAffiliate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test("wrong campaign duration fails before any creation or claim", async () => {
    mock(getRewardfulCampaign).mockResolvedValue({ ...campaign, max_commission_period_months: 60 });
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(createOrganizationRewardfulAffiliate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test("an existing affiliate returns conflict without financial or provider changes", async () => {
    selections[0] = [{ ...account, rewardfulAffiliateId: "existing-affiliate" }];
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(verifyOrganizationRewardfulPayment).not.toHaveBeenCalled();
    expect(getRewardfulCampaign).not.toHaveBeenCalled();
    expect(createOrganizationRewardfulAffiliate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test("an existing partner affiliate is never overwritten even if the account shell is unlinked", async () => {
    selections[1] = [{ rewardfulAffiliateId: "existing-partner-affiliate" }];
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(verifyOrganizationRewardfulPayment).not.toHaveBeenCalled();
    expect(createOrganizationRewardfulAffiliate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  test("non-managers cannot activate", async () => {
    mock(resolveActiveWorkspace).mockResolvedValue({ ...workspace, organizationRole: "member" });
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(createOrganizationRewardfulAffiliate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
