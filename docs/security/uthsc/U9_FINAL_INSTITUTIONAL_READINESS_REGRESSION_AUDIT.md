# U9 — Final Institutional-Readiness Regression Audit

**Review date:** 2026-09-08  
**Final disposition:** **READY WITH DISCLOSED GAPS**  
**Production inspected:** No  
**Production, database, provider, or infrastructure changes performed:** No

## 1. Authoritative scope

U9 is the final Development and repository regression audit for the controls
reviewed during U1 through U8 in preparation for the University of Tennessee
Health Science Center third-party technology/security review.

U9 verifies that:

1. the established sensitive-data, logging, authentication, session, MFA,
   CSRF/origin, tenant, relationship, ownership, lifecycle, Studio media, AI
   observability, and database TLS controls have not regressed;
2. the bounded defects and documentation contradictions found during the U9
   preflight have been repaired;
3. accepted repository gaps remain disclosed rather than relabeled as passes;
4. Production, provider, contractual, backup, recovery, and institutional facts
   are not inferred from Development or repository evidence; and
5. the resulting UTHSC package is internally consistent about the boundary of
   the available evidence.

This audit does not establish full HIPAA compliance, certify Production
readiness, replace provider or contractual evidence, or make determinations
reserved for UTHSC and legal/compliance reviewers.

## 2. Evidence classification

U9 preserves the evidence distinctions established during U8:

- **Repository-verified:** directly supported by source and focused tests.
- **Development-verified:** directly observed in the Development environment.
- **Partial:** a control exists, but its coverage or evidence is incomplete.
- **Unknown / Production evidence required:** cannot be established without
  Production or project-specific provider evidence.
- **Needs external/provider confirmation:** requires current provider records,
  account configuration, or executed agreements.
- **Needs UTHSC determination:** requires institutional acceptance or policy
  judgment.

## 3. Integrated U1–U8 regression result

The established integrated regression matrix was rerun against the complete
current Development state.

| Control area | Result | Evidence |
|---|---|---|
| Sensitive-data and logging protections | **PASS** | Integrated regression matrix |
| Sentry application scrubber | **PASS** | `sendDefaultPii: false`, event/breadcrumb scrubber tests |
| Authentication, session, and MFA | **PASS** | Unit/integration regression matrix and isolated startup auth checks |
| CSRF and exact-origin protections | **PASS** | Integrated regression matrix |
| RBAC, tenant, relationship, and IDOR controls | **PASS for tested controls** | Integrated authorization and Organization suites |
| Development-safe lifecycle and deletion behavior | **PASS for tested controls** | Media lifecycle and Studio deletion/purge suites |
| Studio media lifecycle | **PASS** | Purge, manual deletion, message-record deletion, and asset lifecycle suites |
| AI observability and reviewed minimization flows | **PASS** | AI observability and privacy regression suites |
| Database TLS resolver and script-policy coverage | **PASS** | 11 focused TLS tests, including static script inventory |
| Server TypeScript | **PASS** | `tsconfig.server.json` |
| Project validation | **PASS WITH ACCEPTED WARNING** | Zero hard failures; exactly 61 route-parity warnings |
| Development startup and health | **PASS** | Isolated server returned HTTP 200 from `/api/health` |
| Auth startup integration | **PASS** | Seven of seven login/session checks |

Integrated Jest result:

```text
Test Suites: 28 passed, 28 total
Tests:       273 passed, 273 total
Snapshots:   0 total
```

The prior integrated baseline was 272 tests. The additional passing test is the
new static PostgreSQL script-policy inventory. Jest retained its existing
forced-exit/open-handle advisory after every test passed; no test failed or
timed out.

## 4. Repairs completed during U9

### 4.1 Database TLS policy coverage

U9 preflight found three operational PostgreSQL scripts that did not use the
shared TLS resolver:

```text
scripts/add-classification-source.ts
scripts/migrate-partner-records.ts
scripts/verify-reinvite-flow.ts
```

U9 bounded repair #1:

- routed each script through `getDatabaseTlsConfig`;
- preserved each script's existing SQL, control flow, and behavior apart from
  supplying the shared TLS policy;
- added static regression coverage requiring every script that imports `pg`
  and constructs a Pool/Client to use the shared resolver or an explicit,
  documented local-only exception; and
- introduced no local-only exception.

The repair was checkpointed at:

```text
ee43eaf4729f605fb0495be7155232c90df24f96
```

Final verification established:

- focused database TLS tests: **11/11 passed**;
- all current PostgreSQL script Pool/Client instances are governed by the
  shared policy;
- no `rejectUnauthorized: false` remains under `server/` or `scripts/`; and
- the three script diffs contain only the resolver import and `ssl` option.

### 4.2 Security-documentation reconciliation

U9 bounded repair #2 reconciled:

1. stale Sentry language that incorrectly described the application scrubber
   as absent;
2. over-broad language implying universal AI prompt sanitization;
3. unsupported claims about the active Production database/provider,
   provider BAA availability, or executed-agreement status;
4. over-broad language implying that every route is authenticated by default;
   and
5. the historical U8 TLS report, which now records the subsequent U9
   three-script coverage completion without rewriting the original U8 evidence.

The reconciled documents classify Sentry provider configuration, AI provider
configuration, Production identity, retention, geography, access policy,
contractual coverage, and BAA status as external evidence where appropriate.

## 5. Validation and security-scan results

### 5.1 TypeScript and project validation

- Standalone server TypeScript using `tsconfig.server.json`: **PASS**.
- `npm run validate`: **PASS WITH WARNINGS**.
- Hard failures: **0**.
- Warnings: **1 category**, the accepted list of exactly **61** Development /
  Production route-parity paths.
- Isolated Development startup: **PASS**.
- Isolated `/api/health`: **HTTP 200**.
- Auth login/session integration checks: **7/7 passed**.
- Existing workspace server on port 5000 remained undisturbed.
- `git diff --check`: **PASS**.

### 5.2 Fresh security scans

| Scanner | Critical | High | Moderate/Medium | Low | Disposition |
|---|---:|---:|---:|---:|---|
| Dependency audit | 0 | 35 | 32 | 6 | Accepted baseline unchanged |
| SAST | 0 | 0 | 2 | 0 | Accepted non-credential MD5 findings |
| HoundDog | 0 | 0 | 0 | 8 | Accepted low-severity baseline unchanged |

The two SAST findings remain the previously accepted MD5 uses for short
telemetry correlation hashes and object-checksum compatibility. No new
critical/high security finding was introduced.

## 6. Regression conclusion

No regression remains in the tested U1–U8 security controls.

This conclusion is bounded to the tested repository and Development controls.
It does not convert U5 PARTIAL or policy-dependent routes into VERIFIED
ISOLATED, and it does not convert U7 or U8 evidence gaps into passes.

## 7. Accepted residual repository gaps

The following known repository gaps remain accepted and disclosed:

1. Account deletion is incomplete and is not a reliable platform-wide erasure
   workflow.
2. No unified Organization termination workflow coordinates memberships,
   invitations, professional relationships, billing, retained records, and
   audit evidence.
3. Professional termination remains fragmented.
4. Legacy object ownership and non-Studio upload deletion evidence remain
   incomplete.
5. Application audit writes remain fire-and-forget; durable delivery,
   archival, restore, and long-term query evidence are incomplete.
6. U5 retains PARTIAL and policy-dependent route/object-ownership
   classifications even though no tested concrete P0/P1 authorization defect
   remains.
7. The accepted dependency baseline remains 0 critical, 35 high, 32 moderate,
   and 6 low findings.
8. The accepted route-parity warning remains exactly 61 paths.
9. The two accepted medium SAST MD5 findings and eight low HoundDog findings
   remain disclosed.

## 8. External/provider evidence still required

The UTHSC submission must continue to identify the following as unverified
unless current account-specific evidence is supplied:

1. Active Production hosting provider, runtime, geography, network boundaries,
   and account tier.
2. Active Production database provider and effective endpoint configuration.
3. Database encryption at rest, private networking, firewall/allowlist policy,
   backup/PITR configuration, retention, and restore evidence.
4. Object-storage bucket policy, encryption/key management, region, versioning,
   lifecycle, delete-marker behavior, and backup propagation.
5. Production Sentry project configuration, retention, region, access policy,
   and contractual status.
6. OpenAI account configuration, BAA/contractual coverage, retention, region,
   training use, and deletion behavior.
7. Contract, BAA/DPA, retention, deletion, region, and subprocessor-chain
   evidence for other relevant vendors.
8. Executed agreement status for every provider in scope.
9. Tested disaster-recovery, failover, restore, recovery-time, and
   recovery-point evidence.

## 9. UTHSC determinations still required

UTHSC and the appropriate legal/compliance owners must determine:

1. whether the disclosed PARTIAL U5 route/object classifications are acceptable
   for the intended institutional use;
2. the required disposition and retention policy for account, professional,
   Organization, clinical, billing, invitation, audit, and media records;
3. whether the evidenced Production hosting and provider arrangements are
   acceptable;
4. which vendors are in institutional scope and which contractual agreements
   are required;
5. whether the flow-specific AI identifier minimization and intentional
   clinical/dietary context transmission are acceptable;
6. whether the accepted dependency, SAST, HoundDog, and route-parity baselines
   are acceptable; and
7. what additional Production, backup, recovery, penetration-test, or
   contractual evidence is required before approval.

## 10. Residual risk register

| Residual risk | Classification | Required owner/evidence |
|---|---|---|
| Incomplete account deletion | Repository gap | Product, legal/compliance, and engineering disposition |
| No unified Organization termination | Repository gap | Approved cross-domain lifecycle policy |
| Fragmented professional termination | Repository gap | Professional/clinical lifecycle policy |
| Legacy object ownership/deletion gaps | Partial repository control | Ownership migration and retention decision |
| Fire-and-forget audit writes and incomplete archive evidence | Partial repository control | Durable-delivery/archive design and recovery evidence |
| U5 PARTIAL/policy-dependent classifications | Partial / UTHSC decision | Institutional acceptance or additional remediation |
| Dependency findings | Accepted baseline | Ongoing dependency remediation and UTHSC acceptance |
| Two medium SAST MD5 findings | Accepted bounded findings | Preserve non-credential/checksum-only use |
| Eight low HoundDog findings | Accepted baseline | Ongoing privacy review |
| 61 route-parity warnings | Accepted baseline | Production-route classification and release governance |
| Production identity and infrastructure controls | Unknown / external | Production and provider evidence |
| Backup, retention, restore, and disaster recovery | Unknown / external | Provider records and completed recovery exercise |
| Vendor BAA/contractual status | Unknown / external | Current account-specific agreements |

## 11. Final disposition

**U9 final disposition: READY WITH DISCLOSED GAPS.**

The complete current Development state passed the integrated U1–U8 regression,
the U9 TLS policy repair is covered by regression tests, the U9 documentation
contradictions are reconciled, and no regression remains in the tested
controls.

This disposition means the repository evidence package is coherent enough to
advance to UTHSC submission preparation while carrying the residual risks and
external evidence requests above. It does **not** mean the system is fully
compliant, fully approved by UTHSC, or proven ready for Production based solely
on Development evidence.
