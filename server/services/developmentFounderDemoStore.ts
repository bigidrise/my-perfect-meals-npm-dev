import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_CAPABILITIES, type DemoGrant, type DemoPatient, type DemoWorkspace } from "@shared/demoProfessional";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority, developmentFounderDemoEnabled } from "../config/developmentFounderPhysicianDemo";
import { syntheticPatient, type DemoRepository, type DemoTransaction } from "./demoProfessionalService";
import type { IdentityAccountSnapshot } from "./professionalIdentityDecisionService";
import { ProfessionalRequestError } from "./professionalOnboardingService";

interface State {
  version: 1;
  grant: DemoGrant;
  workspace: DemoWorkspace;
  patients: DemoPatient[];
  profile: { firstName?: string; lastName?: string; preferredLanguage?: string };
}
export interface DevelopmentDemoStoreDependencies {
  filename: string;
  enabled(): boolean;
  /** Read-only identity/ownership check. Never read Clinic memberships. */
  owner(): Promise<{ account: IdentityAccountSnapshot; clinic: { id: string; name: string; type: "clinic"; syntheticOnly: true } }>;
}
function blocked(code = "DEVELOPMENT_DEMO_DISABLED"): never {
  throw new ProfessionalRequestError(403, code, "Only the authorized Development synthetic Clinic is available.");
}
function initialState(): State {
  const workspace: DemoWorkspace = { id: authority.workspaceId, label: "Dr. Test's Clinic — synthetic demonstration", classification: "synthetic" };
  return {
    version: 1, workspace, profile: {},
    grant: {
      id: authority.grantId, userId: authority.userId, workspaceId: workspace.id,
      persona: "physician", operatingStatus: "demo_only", state: "active", revision: 1,
      expiresAt: null, authority: "development_founder", lifetime: "permanent_founder",
      approverId: authority.authorization, reason: authority.authorization,
      trainingBasis: "demo_only_waiver", trainingWaiverReason: "Founder-authorized synthetic-only demonstration; no real-world requirements are waived or completed.",
      capabilities: [...DEMO_CAPABILITIES], acknowledgedAt: null, acknowledgmentVersion: null, identityRequestId: null,
    },
    patients: [
      syntheticPatient(workspace.id),
      { ...syntheticPatient(workspace.id), label: "Synthetic Patient 002", scenario: "Fictional adult receiving general nutrition follow-up; no real person or clinical relationship.", glucose: [] },
      { ...syntheticPatient(workspace.id), label: "Synthetic Patient 003", scenario: "Fictional adult reviewing a hydration routine; no real person or clinical relationship.", glucose: [] },
    ],
  };
}
function validate(value: State): State {
  if (value.version !== 1 || value.grant?.id !== authority.grantId || value.grant.userId !== authority.userId
    || value.grant.workspaceId !== authority.workspaceId || value.grant.authority !== "development_founder"
    || value.grant.lifetime !== "permanent_founder" || value.grant.expiresAt !== null
    || value.grant.approverId !== authority.authorization || value.grant.persona !== "physician"
    || value.grant.operatingStatus !== "demo_only" || value.workspace?.id !== authority.workspaceId
    || value.workspace.classification !== "synthetic" || !Array.isArray(value.patients) || !value.profile
    || !["active", "revoked"].includes(value.grant.state) || !Number.isInteger(value.grant.revision)
    || !Array.isArray(value.grant.capabilities) || value.grant.capabilities.some(cap => !DEMO_CAPABILITIES.includes(cap))
    || value.patients.some(p => p.classification !== "synthetic" || p.workspaceId !== authority.workspaceId
      || !/^[a-f0-9-]{36}$/i.test(p.id) || p.id === authority.userId || p.id === authority.clinicId
      || !Array.isArray(p.glucose) || !Array.isArray(p.messages) || !Array.isArray(p.media)
      || !Number.isInteger(p.revision))) {
    throw new ProfessionalRequestError(503, "DEVELOPMENT_DEMO_STATE_INVALID", "Local demo data could not be verified. No live-data fallback is permitted.");
  }
  return value;
}

/** Durable local-only transactions, serialized and atomically persisted. No SQL writers. */
export function createDevelopmentFounderDemoStore(deps: DevelopmentDemoStoreDependencies) {
  let tail: Promise<unknown> = Promise.resolve();
  async function transaction<T>(work: (tx: DemoTransaction, state: State) => Promise<T>): Promise<T> {
    const operation = tail.then(async () => {
      if (!deps.enabled()) blocked();
      const owner = await deps.owner();
      if (owner.account.id !== authority.userId || owner.clinic.id !== authority.clinicId
        || owner.clinic.type !== "clinic" || owner.clinic.syntheticOnly !== true) blocked("DEVELOPMENT_DEMO_OWNERSHIP_CHANGED");
      let state: State, dirty = false;
      try { state = validate(JSON.parse(await readFile(deps.filename, "utf8"))); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        state = initialState(); dirty = true;
      }
      const tx: DemoTransaction = {
        accounts: async ids => ids.includes(owner.account.id) ? [{ ...owner.account }] : [],
        grant: async userId => userId === authority.userId ? structuredClone(state.grant) : null,
        workspace: async id => id === state.workspace.id ? structuredClone(state.workspace) : null,
        patients: async id => id === state.workspace.id ? structuredClone(state.patients) : [],
        patient: async (workspaceId, id) => workspaceId === state.workspace.id
          ? structuredClone(state.patients.find(p => p.id === id) ?? null) : null,
        clinic: async () => ({ ...owner.clinic }),
        academyComplete: async () => false,
        approvedIdentityRequest: async () => false,
        createDataset: async () => blocked("DEVELOPMENT_DEMO_ADMIN_WRITES_DENIED"),
        invalidateSessions: async () => blocked("DEVELOPMENT_DEMO_ACCOUNT_WRITES_DENIED"),
        saveGrant: async grant => {
          if (grant.id !== state.grant.id || grant.userId !== state.grant.userId || grant.authority !== state.grant.authority
            || grant.lifetime !== state.grant.lifetime || grant.expiresAt !== null || grant.revision !== state.grant.revision + 1) blocked();
          state.grant = structuredClone(grant); dirty = true;
        },
        savePlan: async (patient, plan) => {
          const row = state.patients.find(p => p.id === patient.id && p.workspaceId === patient.workspaceId);
          if (!row || row.revision !== patient.revision) blocked("DEMO_PATIENT_CHANGED");
          row.plan = structuredClone(plan); row.revision++; dirty = true;
          return structuredClone(row);
        },
        saveInvitation: async (patient, invitation) => {
          const row = state.patients.find(p => p.id === patient.id && p.workspaceId === patient.workspaceId);
          if (!row || row.revision !== patient.revision || invitation.providerUserId !== authority.userId
            || invitation.clientUserId !== row.id || invitation.workspaceId !== state.workspace.id
            || invitation.classification !== "synthetic") blocked("DEMO_DATA_SCOPE_DENIED");
          row.connectionInvitation = structuredClone(invitation); row.revision++; dirty = true;
          return structuredClone(row);
        },
        event: async () => { /* No shared event writes; authority is the checked-in founder authorization. */ },
      };
      const result = await work(tx, state);
      if (dirty) {
        // Never commit if the runtime became published/disabled during a request.
        if (!deps.enabled()) blocked();
        validate(state);
        await mkdir(path.dirname(deps.filename), { recursive: true });
        const temporary = `${deps.filename}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
        await rename(temporary, deps.filename);
      }
      return result;
    });
    tail = operation.catch(() => undefined);
    return operation;
  }
  return {
    repository: { transaction: work => transaction((tx) => work(tx)) } satisfies DemoRepository,
    grant: (userId: string) => transaction(async tx => userId === authority.userId ? tx.grant(userId) : null),
    profile: () => transaction(async (_tx, state) => structuredClone(state.profile)),
    updateProfile: (input: Record<string, unknown>) => transaction(async (tx, state) => {
      const allowed = ["firstName", "lastName", "preferredLanguage"];
      if (!Object.keys(input).length || Object.keys(input).some(key => !allowed.includes(key))
        || Object.values(input).some(value => typeof value !== "string" || value.length > 80)) blocked("DEMO_PROFILE_FIELD_DENIED");
      state.profile = { ...state.profile, ...input };
      // Local edits persist through the same atomic writer.
      await tx.saveGrant({ ...state.grant, revision: state.grant.revision + 1 });
      return structuredClone(state.profile);
    }),
  };
}
export const developmentDemoFilename = path.resolve(".local/development-physician-demo", `${authority.userId}.json`);
export const developmentDemoRuntimeEnabled = developmentFounderDemoEnabled;
