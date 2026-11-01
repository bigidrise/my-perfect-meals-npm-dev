# Native API origin verification

## Scope and disposition

Investigated on `integration/all-approved-development-20261031`, starting at `d4002acc8`.

**Finding: test-only mismatch.** The verified existing native API origin is **`https://app.myperfectmeals.ai`**. The primary web domain is **`https://app.myperfectmeals.com`**; these are distinct roles, not conflicting deployments.

Only the contradictory routing test was corrected. No runtime code, native project, API destination, deployment configuration, feature flag, secret or entitlement changed.

## Exact original failure

File: `server/tests/apiRoutingStorageRepair.test.ts`.

Original test: `native API routing uses the approved production .com origin`.

```ts
expect(NATIVE_PRODUCTION_API_ORIGIN).toBe("https://app.myperfectmeals.com");
expect(resolveApiBaseForRuntime({
  isNative: true,
  webOrigin: "https://app.myperfectmeals.ai",
})).toBe("https://app.myperfectmeals.com");
```

Both expectations contradict the imported `client/src/lib/resolveApiBase.ts`:

```ts
export const NATIVE_PRODUCTION_API_ORIGIN = "https://app.myperfectmeals.ai";
// Inside resolveApiBaseForRuntime:
if (isNative) return NATIVE_PRODUCTION_API_ORIGIN;
return webOrigin || "";
```

## Independent evidence establishing the contract

1. **Deployment metadata:** the deployments service reports a successful public VM deployment, primary URL `https://app.myperfectmeals.com`, with `https://app.myperfectmeals.ai` as an additional verified deployment URL. No deployment settings were changed.
2. **Existing documentation:** `docs/production-release-gate.md`, Gate 2-E, identifies `.com` as canonical and `.ai` as its alias. It explicitly allows the alias to serve the same deployment directly instead of redirecting, provided release SHAs agree.
3. **Live read-only requests:** both domains returned HTTP 200 from `/api/release`, the same `gitSha: "a8d9ad59f"`, and no redirect. Both `/api/health` responses returned HTTP 200 with `ok: true`, `initialized: true`, and `initError: null`. The release endpoint's `apiOrigin` echoes the request hostname; that field alone was **not** used to establish intended native routing.
4. **Actual deployed JavaScript:** the primary Production page loads `/assets/index-BzZ75u33.js`. Its native resolver contains this exact implementation, proving what the currently deployed web bundle does:

   ```js
   const Ia="https://app.myperfectmeals.ai";
   function za({isNative:o,webOrigin:e}){return o?Ia:e||""}
   ```

   The same surrounding code calls Capacitor's `isNativePlatform()` before resolving the API base. The asset was read without being modified or retained as a large binary artifact.
5. **Intentional source history:** the 2026-08-25 source change `00dbb70cb` explicitly changed the native constant from `.com` to `.ai` and added `client/src/lib/__tests__/resolveApiBase.test.ts`, which asserts `.ai` for `capacitor://localhost`. The preserved Production source contains both that resolver and its companion `.ai` test.
6. **Integration provenance:** the resolver is byte-for-byte identical between preserved Production `67a964474`, initial integration `912467d35`, and current review starting source `d4002acc8`. The integration did **not** introduce a new API origin.
7. **Native configuration:** the root Capacitor configuration and existing iOS packaged configuration use bundled `client/dist` assets without a remote `server.url`. They do not define a competing API origin. Production environment metadata exposes no `NATIVE_PRODUCTION_API_ORIGIN` override; the resolver itself is a constant, not a public-URL environment lookup. Existing URL secrets were not read.

Together, the independently verified alias relationship, matching live release, deliberately changed source, existing companion test, and actual deployed resolver establish `.ai` as intentional for native API traffic. No conclusion was based on the domain suffix alone.

## Test-only correction

The obsolete test now expects the explicit `.ai` contract and runs against three native starting contexts:

- `capacitor://localhost`;
- the primary `.com` web origin;
- an unrelated preview origin.

Each must resolve to `.ai`, proving that native routing cannot accidentally follow a local, primary-web or preview document origin. Existing web-origin assertions still independently retain `.com`, `.ai`, Replit deployment and Development origins unchanged.

## Verification

- Corrected storage/API-routing suite: **11/11 passed**.
- Existing native resolver companion suite: **3/3 passed**.
- Full previous regression selection plus the companion suite: **25 suites / 348 tests passed**, no failures, no skipped tests.
- The same run includes Grocery Coach Add/Save, permanent recommendation retrieval, owner isolation, authentication/session/CSRF, subscription/Stripe entitlement, clinical authority, pregnancy access, My Perfect Menu Essential+ and Ask Chef Pro+ checks.
- Strict safety TypeScript gate: **passed**.
- Root strict TypeScript release gate: **passed against the unchanged reviewed 118-diagnostic baseline**; no baseline refresh, suppression, or claim that legacy debt is zero.
- Client and server Production builds: **passed**.
- Full `NODE_OPTIONS=--max-old-space-size=4096 npm run release-check`: **exit 0; 13 passed, 0 warnings, 0 failed**.
- Public Production landing page: rendered normally in a read-only browser screenshot.
- Preserved Production refs remain `67a964474f6ab5effd915fc9bc9ffa027d8e3aa9`.

Passing assertion identities and the complete release log are retained in `native-origin-verification/`.

No physical-device native execution was performed; the evidence above establishes the configured and deployed resolver contract, not a new device-build certification.

## Release status

The previously reported native-origin blocker is resolved by a test-only correction. The original final-readiness report and its failed-run evidence remain historical records, not current failures.

**Remaining blockers from this investigation: none.** Existing reviewed TypeScript debt remains unchanged; this report is not physical-device certification or authorization to release.

No merge, push, Ask Chef activation, deployment, publication, native build, shared-account persistence write, storage write or paid AI generation was performed.
