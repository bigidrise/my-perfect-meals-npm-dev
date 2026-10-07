import { createProfessionalOnboardingService } from "../services/professionalOnboardingService";
import { professionalRequestMemory } from "./helpers/professionalRequestMemory";
import { CANONICAL_PRACTITIONER_ROLES } from "@shared/professionalRoles";
import { completeProfessionalDraft, updateProfessionalDraft } from "@shared/professionalOnboarding";

describe("Stage 1 professional request lifecycle — isolated memory only", () => {
  let memory: ReturnType<typeof professionalRequestMemory>;
  let service: ReturnType<typeof createProfessionalOnboardingService>;
  beforeEach(() => { memory = professionalRequestMemory(); service = createProfessionalOnboardingService(memory.repository); });
  async function ready(account = "account-a", role: typeof CANONICAL_PRACTITIONER_ROLES[number] = "physician") {
    const resumed = await service.resume(account);
    return (await service.update(account, {
      requestedRole: role, professionalCategory: "certified", credentialNumber: "SYNTHETIC-LICENSE",
      credentialBody: "SYNTHETIC-STATE", revision: resumed.request!.revision,
    })).request!;
  }
  test("read-only status does not create a request", async () => {
    expect(await service.status("account-a")).toEqual({ accountId: "account-a", currentAuthorizedRole: null, request: null, decisionAvailable: false });
    expect(memory.events).toHaveLength(0);
  });
  test("concurrent create/resume is idempotent and creates one event", async () => {
    const values = await Promise.all([service.resume("account-a"), service.resume("account-a"), service.resume("account-a")]);
    expect(new Set(values.map(value => value.request!.id)).size).toBe(1);
    expect(memory.events.map(event => event.kind)).toEqual(["draft_created"]);
  });
  test("draft survives service remount without browser storage", async () => {
    const row = await ready();
    const remounted = createProfessionalOnboardingService(memory.repository);
    expect((await remounted.status("account-a")).request).toEqual(row);
  });
  test.each(CANONICAL_PRACTITIONER_ROLES)("submitting %s is a request, never identity/verification/entitlement", async role => {
    const before = structuredClone(memory.accounts);
    const row = await ready("account-a", role);
    const submitted = await service.submit("account-a", { revision: row.revision });
    expect(submitted.currentAuthorizedRole).toBeNull();
    expect(submitted.decisionAvailable).toBe(false);
    expect(submitted.request?.requestedRole).toBe(role);
    expect(submitted.request?.state).toBe("submitted");
    expect(JSON.stringify([...memory.accounts])).toBe(JSON.stringify([...before]));
  });
  test("concurrent submission and stale-revision replay return the same result with one submit event", async () => {
    const row = await ready();
    const before = structuredClone(memory.accounts);
    const results = await Promise.all([service.submit("account-a", { revision: row.revision }), service.submit("account-a", { revision: row.revision }), service.submit("account-a", { revision: 0 })]);
    expect(results[0]).toEqual(results[1]); expect(results[1]).toEqual(results[2]);
    expect(memory.events.filter(event => event.kind === "request_submitted")).toHaveLength(1);
    expect(JSON.stringify([...memory.accounts])).toBe(JSON.stringify([...before]));
  });
  test("other account status/resume never returns this account's request", async () => {
    const row = await ready();
    expect((await service.status("account-b")).request).toBeNull();
    expect((await service.resume("account-b")).request!.id).not.toBe(row.id);
  });
  test.each(["update", "submit"] as const)("another account cannot %s a request by ID", async method => {
    const row = await ready();
    await service.resume("account-b");
    await expect(service[method]("account-b", { requestId: row.id, revision: 0 })).rejects.toMatchObject({ status: 404, code: "REQUEST_NOT_FOUND" });
    expect(memory.requests.get("account-a")).toEqual(row);
  });
  test("optimistic revision rejects stale edits", async () => {
    await ready();
    await expect(service.update("account-a", { revision: 0, requestedRole: "trainer" })).rejects.toMatchObject({ status: 409, code: "DRAFT_VERSION_CONFLICT" });
  });
  test("submitted request cannot be overwritten", async () => {
    const row = await ready();
    await service.submit("account-a", { revision: row.revision });
    await expect(service.update("account-a", { revision: row.revision, requestedRole: "trainer" })).rejects.toMatchObject({ code: "REQUEST_ALREADY_SUBMITTED" });
  });
  test("missing permanent account fails before any request creation", async () => {
    await expect(service.resume("missing")).rejects.toMatchObject({ status: 401 });
    expect(memory.requests.size).toBe(0);
  });
  test.each(["established", "legacy", "stored-alias"])("request never corrects/downgrades/overwrites %s account", async account => {
    const before = structuredClone(memory.accounts);
    const row = await ready(account);
    const result = await service.submit(account, { revision: row.revision });
    expect(result.currentAuthorizedRole).toBe(before.get(account)!.professionalRole);
    expect(JSON.stringify([...memory.accounts])).toBe(JSON.stringify([...before]));
  });
  test("ledger failure rolls request submission back atomically", async () => {
    const row = await ready();
    const before = structuredClone(memory.events);
    memory.failNextEvent();
    await expect(service.submit("account-a", { revision: row.revision })).rejects.toThrow("Synthetic ledger failure");
    expect(memory.requests.get("account-a")).toEqual(row);
    expect(memory.events).toEqual(before);
  });
  test("ledger failure rolls draft creation back", async () => {
    memory.failNextEvent();
    await expect(service.resume("account-a")).rejects.toThrow();
    expect(memory.requests.size).toBe(0); expect(memory.events).toHaveLength(0);
  });
  test("draft events do not duplicate credential information", async () => {
    await ready();
    expect(JSON.stringify(memory.events)).not.toContain("SYNTHETIC-LICENSE");
  });
  test.each(["doctor", "np", "coach", "nutritionist", "rn", "pa", "medical", "business", "unknown"])("API request schema rejects noncanonical %s", role => {
    expect(updateProfessionalDraft.safeParse({ requestedRole: role, revision: 0 }).success).toBe(false);
  });
  test.each(["credentialNumber", "credentialBody"] as const)("clinical submission requires claimed %s without establishing verification", field => {
    expect(completeProfessionalDraft.safeParse({ requestedRole: "physician", professionalCategory: "certified", credentialNumber: "SYNTHETIC", credentialBody: "SYNTHETIC", [field]: null }).success).toBe(false);
  });
  test("incomplete draft cannot be submitted", async () => {
    await service.resume("account-a");
    await expect(service.submit("account-a", { revision: 0 })).rejects.toMatchObject({ code: "REQUEST_INCOMPLETE" });
    expect(memory.events.filter(event => event.kind === "request_submitted")).toHaveLength(0);
  });
});
