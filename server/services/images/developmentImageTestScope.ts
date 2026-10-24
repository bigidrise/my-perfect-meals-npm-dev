import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { developmentImageActivationAllowed } from "./imageModelRegistry";

type Environment = Record<string, string | undefined>;
type Stage = "generation" | "verification";
export interface DevelopmentImageTestConfig { runId: string; userId: string; email: string }
export interface DevelopmentImageTestReceipts {
  claim(config: DevelopmentImageTestConfig, stage: Stage): void;
}
export class DevelopmentImageTestError extends Error {
  constructor(readonly code: string) { super(code); }
}
const fail = (code: string): never => { throw new DevelopmentImageTestError(code); };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/** Inert unless separately configured by the operator. Never reads HTTP fields. */
export function developmentImageTestConfig(env: Environment = process.env): DevelopmentImageTestConfig | null {
  const enabled = env.DEVELOPMENT_IMAGE_TEST_ENABLED;
  const runId = env.DEVELOPMENT_IMAGE_TEST_RUN_ID;
  const userId = env.DEVELOPMENT_IMAGE_TEST_USER_ID;
  if (!enabled && !runId && !userId) return null;
  if (enabled !== "approved-single-image" || env.NODE_ENV !== "development" ||
      env.REPLIT_DEPLOYMENT || !developmentImageActivationAllowed(env) ||
      !runId || !uuid.test(runId) || !userId || !uuid.test(userId)) {
    return fail("development_image_test_configuration_rejected");
  }
  return Object.freeze({ runId, userId, email: `image-test+${runId}@example.invalid` });
}

// Written before dispatch, never removed/refunded automatically. Exclusive create
// survives Development process restarts. A missing/unwritable receipt store fails closed.
const filesystemReceipts: DevelopmentImageTestReceipts = {
  claim(config, stage) {
    const dir = resolve("generated-artifacts/development-image-tests", config.runId);
    mkdirSync(dir, { recursive: true });
    if (stage === "verification" && !existsSync(resolve(dir, "generation.json"))) {
      return fail("development_image_test_generation_required");
    }
    let fd: number;
    try { fd = openSync(resolve(dir, `${stage}.json`), "wx", 0o600); }
    catch { return fail(`development_image_test_${stage}_receipt_unavailable`); }
    try {
      writeFileSync(fd, JSON.stringify({
        stage, runId: config.runId,
        subjectDigest: createHash("sha256").update(config.userId).digest("hex"),
        state: "dispatch_reserved_not_confirmed_billed",
      }));
      fsyncSync(fd);
    } finally { closeSync(fd); }
  },
};

interface Scope {
  config: DevelopmentImageTestConfig;
  receipts: DevelopmentImageTestReceipts;
  storagePrefix: string;
  generatedImageDigest?: string;
}
const scopes = new AsyncLocalStorage<Scope>();
export const developmentImageTestScope = () => scopes.getStore();

/** Actor must be loaded from the authenticated ID, not supplied by the browser. */
export function withDevelopmentImageTestSubject<T>(
  subject: { id: string; email: string | null; isSandbox?: boolean },
  work: () => T,
  options: { env?: Environment; receipts?: DevelopmentImageTestReceipts } = {},
): T {
  const config = developmentImageTestConfig(options.env);
  if (!config || subject.id !== config.userId) return work();
  if (subject.email?.toLowerCase() !== config.email || subject.isSandbox !== true) return fail("development_image_test_synthetic_identity_required");
  const existing = scopes.getStore();
  if (existing?.config.runId === config.runId && existing.config.userId === config.userId) return work();
  const subjectDigest = createHash("sha256").update(config.userId).digest("hex").slice(0, 16);
  return scopes.run({
    config, receipts: options.receipts ?? filesystemReceipts,
    storagePrefix: `development-image-tests/${config.runId}/${subjectDigest}/`,
  }, work);
}

export function developmentImageTestCacheInput(input: string): string {
  const scope = scopes.getStore();
  return scope ? `development-image-test|${scope.config.runId}|${scope.config.userId}|${input}` : input;
}
export function assertDevelopmentImageTestRecipe(name: string, sourceType?: string): void {
  if (scopes.getStore() && (name.toLowerCase().trim().replace(/\s+/g, " ") !== "berry coconut chia parfait" || sourceType !== "snack")) {
    fail("development_image_test_recipe_not_authorized");
  }
}
export function assertDevelopmentImageTestUrl(url: string): void {
  const scope = scopes.getStore();
  if (scope && (!url.startsWith("/public-objects/") || url.includes("%") ||
      url.split("/").some(part => part === "." || part === "..") ||
      !url.split(/[?#]/)[0].includes(`/${scope.storagePrefix}`))) {
    fail("development_image_test_storage_scope_violation");
  }
}
export function rememberDevelopmentImageTestImage(url: string): void {
  const scope = scopes.getStore();
  if (scope) scope.generatedImageDigest = createHash("sha256").update(url).digest("hex");
}
export function assertDevelopmentImageTestSource(source: string | null | undefined): void {
  const scope = scopes.getStore();
  if (!scope) return;
  if (source?.startsWith("/public-objects/")) return assertDevelopmentImageTestUrl(source);
  if (!source || scope.generatedImageDigest !== createHash("sha256").update(source).digest("hex")) {
    fail("development_image_test_source_not_generated");
  }
}
export function claimDevelopmentImageTestRequest(stage: Stage, imageUrl?: string): void {
  const scope = scopes.getStore();
  if (!scope) return;
  if (stage === "verification" && (!imageUrl || scope.generatedImageDigest !== createHash("sha256").update(imageUrl).digest("hex"))) {
    fail("development_image_test_verification_image_mismatch");
  }
  scope.receipts.claim(scope.config, stage);
}
