import express from "express";
import session from "express-session";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

// Every DB/service boundary is isolated: never connect to shared Neon or send mail.
jest.mock("../db", () => ({ db: { transaction: jest.fn(), select: jest.fn() } }));
jest.mock("bcryptjs", () => ({ hash: jest.fn(async () => "fixture-password-hash") }));
jest.mock("../services/emailIdentityService", () => ({
  resolveEmailIdentityForEmail: jest.fn(),
  normalizeEmailIdentity: (email: string) => email.trim().toLowerCase(),
}));
jest.mock("../services/inviteAutoAccept", () => ({
  autoAcceptPendingInvites: jest.fn(async () => ({ accepted: false, membership: null })),
  lookupExistingMembership: jest.fn(async () => null),
}));
jest.mock("../services/procareActivation", () => ({ selfHealProCareState: jest.fn() }));
jest.mock("../services/legalCheck", () => ({ checkLegalAcceptance: jest.fn() }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn(), getClientIp: jest.fn(() => "127.0.0.1") }));
jest.mock("../middleware/requireEmailService", () => ({ emailServiceAvailable: () => false }));
jest.mock("../services/emailService", () => ({ sendTrialStartEmail: jest.fn() }));
jest.mock("../services/preRegistrationAccess", () => ({
  findPendingPreRegistrationAccess: jest.fn(async () => null),
  resolveSignupTrial: jest.fn(() => null),
}));
jest.mock("../services/organizationalPilotInvitationService", () => ({
  findOrganizationalPilotInvitation: jest.fn(async () => null),
}));
jest.mock("../services/clinicPilotEnrollmentService", () => ({
  inspectClinicPilotEnrollmentLink: jest.fn(),
  enrollClinicPatientInTransaction: jest.fn(),
}));
jest.mock("../services/businessOfferLinkService", () => ({
  inspectBusinessOffer: jest.fn(), redeemBusinessOffer: jest.fn(),
}));
jest.mock("../services/organizationalPilotAuthorizationService", () => ({
  inspectPilotAuthorizationToken: jest.fn(async () => null),
}));
jest.mock("../services/businessPilotAuthorizationService", () => ({
  findOpenBusinessPilotAuthorizationByEmail: jest.fn(async () => null),
  claimBusinessPilotAuthorizationInTransaction: jest.fn(),
}));
jest.mock("../services/authTokenService", () => ({
  AuthSecurityStateChangedError: class extends Error {},
  rotateAuthToken: jest.fn(async () => ({ authToken: "fixture-only-credential" })),
  revokeAuthToken: jest.fn(), findUserByValidAuthToken: jest.fn(),
}));
jest.mock("../services/authAttemptTrackingService", () => ({
  authAttemptTracker: { isLocked: jest.fn(), clear: jest.fn(), recordFailure: jest.fn() },
}));
jest.mock("../lib/privilegedMfaPolicy", () => ({ requiresPrivilegedMfa: () => false }));

import authRouter from "../routes/auth.session";
import { db } from "../db";
import { users, trialAccessInvites } from "@shared/schema";
import { resolveEmailIdentityForEmail } from "../services/emailIdentityService";
import { findPendingPreRegistrationAccess } from "../services/preRegistrationAccess";
import { autoAcceptPendingInvites } from "../services/inviteAutoAccept";
import { rotateAuthToken } from "../services/authTokenService";

const app = express();
app.use(express.json());
app.use(session({ secret: "isolated-signup-fixture", resave: false, saveUninitialized: false }));
app.use(authRouter);
app.get("/fixture/session", (req, res) => res.json({ userId: req.session.userId ?? null }));

type Row = { id: string; email: string; username: string; [key: string]: unknown };
let rows: Row[];
let insertedValues: any[];
let committedClaims: number;
let forcedUsernameCollisions: number;
let insertFailure: Error | null;
let claimFailure: Error | null;
let claimHasRow: boolean;
let errorLog: jest.SpyInstance;
let log: jest.SpyInstance;

function pgFailure(constraint: string, code = "23505") {
  return Object.assign(new Error("fixture SQL failure"), { code, constraint });
}
function fixtureRow(email: string, username: string): Row {
  return {
    id: "existing-fixture", email, username, password: "unchanged-fixture-hash",
    role: "client", professionalRole: "physician", planLookupKey: "unchanged-plan",
    authSecurityVersion: 3, relationships: ["unchanged-relationship"],
  };
}
function signup(email: string) {
  return request(app).post("/api/auth/signup").send({ email, password: "FixturePassphrase!2026" });
}

beforeEach(() => {
  jest.clearAllMocks();
  rows = [];
  insertedValues = [];
  committedClaims = 0;
  forcedUsernameCollisions = 0;
  insertFailure = null;
  claimFailure = null;
  claimHasRow = true;
  errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  log = jest.spyOn(console, "log").mockImplementation(() => {});
  (findPendingPreRegistrationAccess as jest.Mock).mockResolvedValue(null);
  (db.select as jest.Mock).mockReturnValue({
    from: (table: unknown) => {
      expect(table).toBe(users);
      return { where: (filter: any) => {
        const id = new PgDialect().sqlToQuery(filter).params[0];
        return { limit: async () => rows.filter(row => row.id === id).slice(0, 1) };
      } };
    },
  });
  (resolveEmailIdentityForEmail as jest.Mock).mockImplementation(async (email: string) => {
    const existing = rows.find(row => row.email.trim().toLowerCase() === email.trim().toLowerCase());
    return existing ? { status: "unique", user: existing } : { status: "not_found" };
  });

  // Model serialized DB uniqueness checks and atomic commit/rollback, not check-before-insert.
  let tail = Promise.resolve();
  (db.transaction as jest.Mock).mockImplementation((work: (tx: any) => Promise<unknown>) => {
    const result = tail.then(async () => {
      const staged: Row[] = [];
      let stagedClaims = 0;
      const tx = {
        insert: (table: unknown) => {
          expect(table).toBe(users);
          return { values: (values: any) => ({ returning: async () => {
            insertedValues.push({ ...values });
            if (insertFailure) throw new Error("wrapped fixture", { cause: insertFailure });
            if (rows.some(row => row.email === values.email)) throw pgFailure("users_email_unique");
            if (forcedUsernameCollisions > 0 || rows.some(row => row.username === values.username)) {
              forcedUsernameCollisions = Math.max(0, forcedUsernameCollisions - 1);
              throw new Error("wrapped fixture", { cause: pgFailure("users_username_unique") });
            }
            const row = {
              id: `new-fixture-${insertedValues.length}`, role: "client",
              authSecurityVersion: 0, ...values,
            };
            staged.push(row);
            return [row];
          } }) };
        },
        update: (table: unknown) => {
          expect(table).toBe(trialAccessInvites); // Never update an existing user.
          return { set: () => ({ where: () => ({ returning: async () => {
            if (claimFailure) throw claimFailure;
            if (!claimHasRow) return [];
            stagedClaims++;
            return [{ id: "pending-fixture" }];
          } }) }) };
        },
      };
      const value = await work(tx);
      rows.push(...staged);
      committedClaims += stagedClaims;
      return value;
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  });
});
afterEach(() => { errorLog.mockRestore(); log.mockRestore(); });

test("same prefix and different domains creates an independent account, preserving the first", async () => {
  const existing = fixtureRow("support@first.test", "support");
  const snapshot = JSON.parse(JSON.stringify(existing));
  rows.push(existing);
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup")
    .send({ email: "support@second.test", password: "FixturePassphrase!2026" });
  expect(response.status).toBe(200);
  expect(response.body.email).toBe("support@second.test");
  expect(response.body.username).toMatch(/^support-[a-f0-9]{24}$/);
  expect(response.body.id).not.toBe(existing.id);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual(snapshot);
  expect(db.transaction).toHaveBeenCalledTimes(2);
  expect(autoAcceptPendingInvites).toHaveBeenCalledTimes(1);
  expect(autoAcceptPendingInvites).toHaveBeenCalledWith(response.body.id, "support@second.test");
  expect(rotateAuthToken).toHaveBeenCalledTimes(1);
  expect((await agent.get("/fixture/session")).body.userId).toBe(response.body.id);
});

test("same normalized email returns a clear error without inserting or changing its owner", async () => {
  rows.push(fixtureRow("Support@First.Test", "support"));
  const snapshot = JSON.parse(JSON.stringify(rows));
  const response = await signup("  SUPPORT@FIRST.TEST  ");
  expect(response.status).toBe(400);
  expect(response.body.code).toBe("EMAIL_ALREADY_EXISTS");
  expect(response.body.error).toContain("Sign in or reset your password");
  expect(db.transaction).not.toHaveBeenCalled();
  expect(rows).toEqual(snapshot);
});

test("multiple username collisions retry fresh transactions and commit exactly one account", async () => {
  forcedUsernameCollisions = 3;
  expect((await signup("support@fresh.test")).status).toBe(200);
  expect(db.transaction).toHaveBeenCalledTimes(4);
  expect(rows).toHaveLength(1);
  expect(new Set(insertedValues.map(value => value.username)).size).toBe(4);
});

function concurrentIdentityBarrier() {
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  (resolveEmailIdentityForEmail as jest.Mock).mockImplementation(async () => {
    if (++arrivals === 2) release();
    await barrier;
    return { status: "not_found" };
  });
}

test("concurrent same-prefix registrations survive both prechecks passing", async () => {
  concurrentIdentityBarrier();
  const responses = await Promise.all([signup("support@first.test"), signup("support@second.test")]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(row => row.username)).size).toBe(2);
  expect(new Set(rows.map(row => row.email)).size).toBe(2);
  expect(db.transaction).toHaveBeenCalledTimes(3);
});

test("concurrent normalized duplicate email creates one account and returns a clear conflict", async () => {
  concurrentIdentityBarrier();
  const responses = await Promise.all([signup("Support@First.Test"), signup(" support@first.test ")]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
  const duplicate = responses.find(response => response.status === 400)!;
  expect(duplicate.body.code).toBe("EMAIL_ALREADY_EXISTS");
  expect(rows).toHaveLength(1);
  expect(rows[0].email).toBe("support@first.test");
  expect(db.transaction).toHaveBeenCalledTimes(2);
  expect(rotateAuthToken).toHaveBeenCalledTimes(1);
});

test("exhausted collisions do not leave partial accounts or issue credentials", async () => {
  forcedUsernameCollisions = 99;
  const response = await signup("support@fresh.test");
  expect(response.status).toBe(500);
  expect(db.transaction).toHaveBeenCalledTimes(5);
  expect(rows).toEqual([]);
  expect(rotateAuthToken).not.toHaveBeenCalled();
});

test.each(["40P01", "08006"])("other DB failure %s is not retried or reported as an email conflict", async code => {
  insertFailure = pgFailure("unrelated_constraint", code);
  const response = await signup("support@fresh.test");
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: "Failed to create account" });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(rows).toEqual([]);
  expect(rotateAuthToken).not.toHaveBeenCalled();
  expect(JSON.stringify(errorLog.mock.calls)).not.toContain("fixture-password-hash");
});

test("a dependent DB write failure rolls back the inserted account and its claim", async () => {
  (findPendingPreRegistrationAccess as jest.Mock).mockResolvedValue({ id: "pending-fixture" });
  claimFailure = pgFailure("unrelated_claim_constraint");
  expect((await signup("support@fresh.test")).status).toBe(500);
  expect(insertedValues).toHaveLength(1); // Insertion was staged before the failed claim.
  expect(rows).toEqual([]);
  expect(committedClaims).toBe(0);
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(rotateAuthToken).not.toHaveBeenCalled();
});

test("an already-claimed invitation rolls back the account without treating it as a username collision", async () => {
  (findPendingPreRegistrationAccess as jest.Mock).mockResolvedValue({ id: "pending-fixture" });
  claimHasRow = false;
  expect((await signup("support@fresh.test")).status).toBe(500);
  expect(rows).toEqual([]);
  expect(committedClaims).toBe(0);
  expect(db.transaction).toHaveBeenCalledTimes(1);
});
