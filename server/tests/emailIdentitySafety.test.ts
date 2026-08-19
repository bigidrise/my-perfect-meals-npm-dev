import * as fs from "fs";
import * as path from "path";
import {
  normalizeEmailIdentity,
  resolveEmailIdentity,
  type EmailIdentityCandidate,
} from "../services/emailIdentityService";

const subscriptionServiceSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/subscriptionService.ts"),
  "utf8",
);
const careTeamRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/careTeamRoutes.ts"),
  "utf8",
);
const studioRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/studioRoutes.ts"),
  "utf8",
);
const businessRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
  "utf8",
);
const coachingRoutesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/coaching.ts"),
  "utf8",
);

const caseVariantUsers: EmailIdentityCandidate[] = [
  { id: "account-lowercase", email: "member@example.com" },
  { id: "account-capitalized", email: "Member@example.com" },
];

describe("email identity safety", () => {
  it("normalizes delivery identity without losing the stored account spelling", () => {
    expect(normalizeEmailIdentity(" Member@Example.com ")).toBe("member@example.com");

    const resolved = resolveEmailIdentity(
      [{ id: "one-account", email: "member@example.com" }],
      "Member@Example.com",
    );
    expect(resolved.status).toBe("unique");
    expect(resolved.status === "unique" && resolved.user.id).toBe("one-account");
  });

  it("requires an exact legacy spelling before selecting a case-variant account", () => {
    const lowercase = resolveEmailIdentity(caseVariantUsers, "member@example.com");
    const capitalized = resolveEmailIdentity(caseVariantUsers, "Member@example.com");

    expect(lowercase.status).toBe("legacy_exact");
    expect(lowercase.status === "legacy_exact" && lowercase.user.id).toBe("account-lowercase");
    expect(capitalized.status).toBe("legacy_exact");
    expect(capitalized.status === "legacy_exact" && capitalized.user.id).toBe("account-capitalized");
  });

  it("never chooses an arbitrary account for an ambiguous normalized email", () => {
    const ambiguous = resolveEmailIdentity(caseVariantUsers, "MEMBER@example.com");

    expect(ambiguous.status).toBe("ambiguous");
    expect(ambiguous.candidates.map((candidate) => candidate.id)).toEqual([
      "account-lowercase",
      "account-capitalized",
    ]);
    expect("user" in ambiguous).toBe(false);
  });

  it("updates subscription state by a resolved primary key, never by email or customer-wide update", () => {
    expect(subscriptionServiceSource).toContain("resolveSubscriptionUser");
    expect(subscriptionServiceSource).toContain(".where(eq(users.id, verifiedUser.id))");
    expect(subscriptionServiceSource).toContain(".where(eq(users.id, user.id))");
    expect(subscriptionServiceSource).not.toContain(".where(eq(users.email");
    expect(subscriptionServiceSource).not.toContain(".where(eq(users.stripeCustomerId, stripeCustomerId))");
  });

  it("does not let either case-variant account redeem a care or studio invitation", () => {
    for (const routeSource of [careTeamRoutesSource, studioRoutesSource]) {
      expect(routeSource).toContain("resolveEmailIdentityForUser(userId)");
      expect(routeSource).toContain("identity.candidates.length > 1");
      expect(routeSource).toContain("EMAIL_IDENTITY_REVIEW_REQUIRED");
      expect(routeSource).toContain("normalizeEmailIdentity(identity.user.email)");
      expect(routeSource).toContain("normalizeEmailIdentity(invite.email)");
    }
  });

  it("applies the same verified identity rule before business access or coaching changes", () => {
    expect(businessRoutesSource).toContain("resolveEmailIdentityForUser(userId)");
    expect(businessRoutesSource).toContain("acceptingIdentity.candidates.length > 1");
    expect(businessRoutesSource).toContain("EMAIL_IDENTITY_REVIEW_REQUIRED");
    expect(businessRoutesSource).toContain("normalizeEmailIdentity(acceptingIdentity.user.email)");

    expect(coachingRoutesSource).toContain("resolveEmailIdentityForUser(authUser.id)");
    expect(coachingRoutesSource).toContain("identity.candidates.length > 1");
    expect(coachingRoutesSource).toContain("EMAIL_IDENTITY_REVIEW_REQUIRED");
    expect(coachingRoutesSource).toContain("normalizeEmailIdentity(identity.user.email)");
  });
});