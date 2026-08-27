import * as fs from "fs";
import * as path from "path";
import {
  resolveSignupTrial,
  trialSourceForAccessType,
} from "../services/preRegistrationAccess";

const NOW = new Date("2026-08-27T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("pre-registration trial classification", () => {
  it("keeps Pilot Program and Client Access as separate sources", () => {
    expect(trialSourceForAccessType("pilot")).toBe("pilot_program");
    expect(trialSourceForAccessType("client")).toBe("client_access");
  });

  it("activates a client invitation for 30 days at account creation", () => {
    const trial = resolveSignupTrial(NOW, {
      accessType: "client",
      durationDays: 30,
    });

    expect(trial.trialStartedAt).toEqual(NOW);
    expect(trial.trialEndsAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    expect(trial.trialSource).toBe("client_access");
    expect(trial.trialAccessType).toBe("client");
  });

  it("activates a pilot invitation for 30 days at account creation", () => {
    const trial = resolveSignupTrial(NOW, {
      accessType: "pilot",
      durationDays: 30,
    });

    expect(trial.trialEndsAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    expect(trial.trialSource).toBe("pilot_program");
    expect(trial.trialAccessType).toBe("pilot");
  });

  it("preserves the ordinary seven-day signup trial without an invitation", () => {
    const trial = resolveSignupTrial(NOW, null);
    expect(trial.trialEndsAt).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
    expect(trial.trialSource).toBe("standard_signup");
    expect(trial.trialAccessType).toBeNull();
  });
});

describe("pre-registration persistence contract", () => {
  const migrationSource = fs.readFileSync(
    path.resolve(__dirname, "../db/migrations/runTrialGrantsMigration.ts"),
    "utf8",
  );
  const signupSource = fs.readFileSync(
    path.resolve(__dirname, "../routes/auth.session.ts"),
    "utf8",
  );

  it("does not store trial start or end dates on pending invitations", () => {
    const tableStart = migrationSource.indexOf("CREATE TABLE IF NOT EXISTS trial_access_invites");
    const tableEnd = migrationSource.indexOf("await db.execute(sql`", tableStart + 1);
    const tableDefinition = migrationSource.slice(tableStart, tableEnd);

    expect(tableDefinition).not.toContain("trial_started_at");
    expect(tableDefinition).not.toContain("trial_ends_at");
    expect(tableDefinition).toContain("invited_at");
    expect(tableDefinition).toContain("activated_at");
  });

  it("claims the invitation in the same transaction that creates the user", () => {
    expect(signupSource).toContain("db.transaction");
    expect(signupSource).toContain("activatedUserId: createdUser.id");
    expect(signupSource).toContain("Pre-registration access was already activated");
  });
});