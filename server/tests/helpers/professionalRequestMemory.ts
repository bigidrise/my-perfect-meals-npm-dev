import { randomUUID } from "node:crypto";
import type { ProfessionalIdentityRequest } from "@shared/professionalOnboarding";
import type { ProfessionalRequestRepository } from "../../services/professionalOnboardingService";

// Entirely in memory. Never import server/db or insert shared user records.
export function professionalRequestMemory() {
  const accounts = new Map<string, Record<string, unknown>>([
    ["account-a", { professionalRole: null, isProCare: false, planLookupKey: null, trained: false, legal: [], memberships: [], relationships: [], credentialVerified: false }],
    ["account-b", { professionalRole: null, isProCare: false }],
    ["established", { professionalRole: "physician", isProCare: true, planLookupKey: "existing-plan", trained: true, legal: ["existing-version"], memberships: ["existing-org"], credentialVerified: true }],
    ["legacy", { professionalRole: "business", professionalCategory: "medical", isProCare: true, isSandbox: true, organizationId: "fixture-org", clinicId: "fixture-clinic", trained: true, legal: [], credentialNumber: null }],
    ["stored-alias", { professionalRole: "doctor", isProCare: true }],
  ]);
  const requests = new Map<string, ProfessionalIdentityRequest>();
  const events: { requestId: string; revision: number; kind: string; changedFields: string[] }[] = [];
  let tail = Promise.resolve();
  let failEvent = false;
  const repository: ProfessionalRequestRepository = {
    async transaction(work) {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const snapshot = structuredClone(requests);
      const eventSnapshot = structuredClone(events);
      try {
        return await work({
          lockAccount: async () => {},
          accountRole: async id => accounts.has(id) ? { professionalRole: accounts.get(id)!.professionalRole as string | null } : null,
          request: async id => structuredClone(requests.get(id) ?? null),
          async create(id) {
            const row: ProfessionalIdentityRequest = {
              id: randomUUID(), ownerUserId: id, requestedRole: null, professionalCategory: null,
              credentialBody: null, credentialNumber: null, credentialType: null, credentialYear: null,
              state: "draft", revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), submittedAt: null,
            };
            requests.set(id, row);
            return structuredClone(row);
          },
          async save(row) { requests.set(row.ownerUserId, structuredClone(row)); return structuredClone(row); },
          async event(row, kind, changedFields) {
            if (failEvent) { failEvent = false; throw new Error("Synthetic ledger failure"); }
            events.push({ requestId: row.id, revision: row.revision, kind, changedFields });
          },
        });
      } catch (error) {
        requests.clear(); for (const [key, value] of snapshot) requests.set(key, value);
        events.splice(0, events.length, ...eventSnapshot);
        throw error;
      } finally { release(); }
    },
  };
  return { repository, accounts, requests, events, failNextEvent: () => { failEvent = true; } };
}
