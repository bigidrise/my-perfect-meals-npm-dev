const REWARDFUL_API_BASE = "https://api.getrewardful.com/v1";

function basicAuth(): string {
  const secret = process.env.REWARDFUL_API_SECRET ?? "";
  return "Basic " + Buffer.from(`${secret}:`).toString("base64");
}

export interface RewardfulAffiliate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  state: "active" | "pending" | "disabled" | "suspicious";
  links: Array<{ id: string; url: string; token: string }>;
  campaign: { id: string; name: string };
}

export async function createRewardfulAffiliate(params: {
  firstName: string;
  lastName: string;
  email: string;
  campaignId: string;
}): Promise<RewardfulAffiliate> {
  const body = new URLSearchParams({
    first_name: params.firstName,
    last_name: params.lastName,
    email: params.email,
    campaign_id: params.campaignId,
  });

  const res = await fetch(`${REWARDFUL_API_BASE}/affiliates`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (res.status === 422) {
    // Email already exists — look up and return existing affiliate
    const existing = await getRewardfulAffiliateByEmail(params.email);
    if (existing) return existing;
    const errBody = await res.json();
    throw new Error(`[Rewardful] 422 and email lookup failed: ${JSON.stringify(errBody)}`);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[Rewardful] createAffiliate ${res.status}: ${errBody}`);
  }

  return res.json() as Promise<RewardfulAffiliate>;
}

export async function getRewardfulAffiliateByEmail(email: string): Promise<RewardfulAffiliate | null> {
  const res = await fetch(
    `${REWARDFUL_API_BASE}/affiliates?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: basicAuth() } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { data?: RewardfulAffiliate[] };
  return data.data?.[0] ?? null;
}

export async function getRewardfulAffiliate(affiliateId: string): Promise<RewardfulAffiliate | null> {
  const res = await fetch(`${REWARDFUL_API_BASE}/affiliates/${affiliateId}`, {
    headers: { Authorization: basicAuth() },
  });
  if (!res.ok) return null;
  return res.json() as Promise<RewardfulAffiliate>;
}

export async function getRewardfulMagicLink(affiliateId: string): Promise<string | null> {
  const res = await fetch(`${REWARDFUL_API_BASE}/affiliates/${affiliateId}/sso`, {
    headers: { Authorization: basicAuth() },
  });
  if (!res.ok) return null;
  const data = await res.json() as { url?: string };
  return data.url ?? null;
}
