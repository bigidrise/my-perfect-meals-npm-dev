# U8 — Infrastructure Evidence Reconciliation Closure Report

**Review date:** 2026-09-08  
**Disposition:** **CLOSED PARTIAL**  
**Repository remediation performed:** Database TLS certificate-verification
bypasses were removed from application runtime pools and production-capable
database scripts.  
**Production inspected:** No.

## 1. Official scope

U8 reconciles infrastructure evidence for the UTHSC third-party technology and
security review. It covers:

1. Application hosting and environment separation
2. Database provider, transport security, at-rest protection, and access
   restrictions
3. Object/file storage, access policy, encryption, versioning, lifecycle, and
   deletion behavior
4. Backups, point-in-time recovery, retention, restore evidence, and disaster
   recovery
5. Monitoring, logging, audit evidence, and secrets handling
6. Network boundaries and external-service data flows
7. Processor/subprocessor and contractual evidence
8. Infrastructure dependencies identified by U7 deletion/lifecycle review

U8 distinguishes evidence by source:

- **Repository-verified:** implemented behavior directly supported by current
  source and focused tests.
- **Development-verified:** behavior directly observed in the Development
  environment.
- **Production-specific, not inspected:** facts that cannot be established
  without Production access or project-specific provider configuration.
- **General provider capability:** functionality described by a provider, but
  not proof that this project has selected, configured, or contractually
  obtained it.
- **External/contractual/institutional:** evidence requiring provider records,
  executed agreements, account administration, or a UTHSC determination.

U8 does not infer infrastructure controls from environment-variable presence,
SDK usage, comments, package installation, or general provider marketing.

## 2. Final control matrix

| Control | Final classification | Evidence conclusion |
|---|---|---|
| Development/Production separation | **PARTIAL** | Separate application entrypoints, environment flags, and deployment configuration exist. No Production inspection was performed to prove effective runtime, secrets, or data separation. |
| Application hosting/runtime | **PARTIAL / PRODUCTION NOT INSPECTED** | Repository configuration defines a Replit Autoscale production entrypoint. The active Production deployment, geography, and account-specific controls were not inspected. |
| Active Production database provider | **UNKNOWN / PRODUCTION EVIDENCE REQUIRED** | The application uses PostgreSQL and supports multiple connection sources. Repository support for Neon does not prove the identity or configuration of the active Production provider. |
| Application database TLS configuration | **VERIFIED IN DEVELOPMENT** | All identified runtime and production-capable script paths now use certificate-verifying TLS when Neon, a TLS SSL mode, or script-required TLS applies. Focused tests and Development startup passed. This does not independently verify the active Production endpoint or provider configuration. |
| Database encryption at rest | **EXTERNAL / PRODUCTION EVIDENCE REQUIRED** | General provider encryption capabilities are not project-specific proof. No active Production database configuration or contractual evidence was inspected. |
| Database network restrictions | **UNKNOWN / PRODUCTION EVIDENCE REQUIRED** | Repository evidence does not prove private networking, firewall rules, IP allowlists, or a database that is reachable only by the application server. |
| Object/file storage implementation | **REPOSITORY VERIFIED** | AWS S3 and Replit Object Storage integration paths are implemented, including public/private path handling. |
| Effective object-storage access policy | **PARTIAL / PRODUCTION EVIDENCE REQUIRED** | Application access helpers exist, but effective bucket policy, project ACLs, and the legacy ownership gaps preserved by U5 were not resolved by U8. |
| Object-storage encryption, versioning, and lifecycle | **EXTERNAL / PRODUCTION EVIDENCE REQUIRED** | Repository integration and general provider capabilities do not prove active encryption settings, key policy, versioning, lifecycle, region, or delete-marker behavior. |
| Database backups and PITR | **UNKNOWN / PRODUCTION EVIDENCE REQUIRED** | Provider capabilities may exist, but no project-specific backup/PITR configuration was inspected. |
| Backup retention | **UNKNOWN / EXTERNAL** | No project-specific retention period or expired-backup disposal evidence was established. |
| Restore and recovery | **UNKNOWN / EXTERNAL** | No completed project restore exercise, recovery timestamp, recovery objective, or successful recovery record was available. |
| Disaster recovery | **UNKNOWN / EXTERNAL** | No verified failover exercise, recovery plan execution, or project-specific recovery guarantee was established. |
| Application logging and audit implementation | **PARTIAL** | Logging and audit schemas exist. U7 remains authoritative for incomplete durable-delivery, archival, and restore/query evidence. |
| Sentry privacy boundary | **REPOSITORY VERIFIED / PROVIDER PARTIAL** | Source and tests support `sendDefaultPii: false` and `beforeSend` redaction. Active Production project settings, retention, region, alerting, and contractual status were not inspected. |
| Secrets handling | **PARTIAL** | Application source consumes secrets through environment variables, and Development/Deployment secret separation is a documented platform capability. Effective Production access controls, rotation, and account settings were not inspected. |
| Application origin controls | **REPOSITORY VERIFIED** | Exact-origin and CORS allowlisting are implemented. This does not establish private infrastructure networking, WAF, firewall, or egress controls. |
| OpenAI boundary | **PARTIAL / EXTERNAL** | Integration behavior and application-level sanitization can be inspected. BAA status, HIPAA-eligible account configuration, provider retention, region, and contractual coverage were not established. |
| Other processors/subprocessors | **PARTIAL / EXTERNAL** | Integrations can be inventoried from repository evidence. Contract, BAA/DPA, retention, deletion, region, and subprocessor-chain evidence remains provider/account specific. |
| U7 infrastructure deletion dependencies | **UNKNOWN / EXTERNAL** | Backup deletion propagation, storage versioning, recovery windows, and processor-side retention/deletion behavior remain unverified. |

## 3. Database TLS remediation

### 3.1 Confirmed defect

The U8 preflight found explicit `rejectUnauthorized: false` configurations in:

- the main application database pool;
- the Production PostgreSQL session-store pool; and
- standalone migration, verification, audit, and test scripts capable of using
  a supplied database connection URL.

Those settings could encrypt transport without properly verifying the database
server certificate.

### 3.2 Bounded repair

A shared database TLS resolver now:

- requires `rejectUnauthorized: true` for Neon endpoints;
- requires certificate verification for connection URLs requesting
  `sslmode=prefer`, `require`, `verify-ca`, or `verify-full`;
- prevents a Neon connection-string query such as `sslmode=disable` from
  silently overriding the verified TLS object;
- preserves required encrypted connections in scripts that previously required
  TLS for every provider;
- preserves non-Neon behavior when the URL does not request TLS and the caller
  did not previously require it; and
- rejects malformed connection URLs without echoing credentials.

No custom certificate authority was invented, and no alternative TLS bypass was
introduced.

### 3.3 Changed files for the TLS repair

```text
scripts/audit-professional-legal-acceptance.ts
scripts/migrate-add-coach-corner-behavioral-vars.ts
scripts/migrate-add-coach-corner-column.ts
scripts/migrate-add-coach-corner-onboarding-v1.ts
scripts/migrate-add-coach-corner-tired.ts
scripts/migrate-add-mfa-columns.ts
scripts/migrate-add-waitlist-notified-at.ts
scripts/test-grocery-variety.ts
scripts/verify-hipaa-phase1.ts
server/db.ts
server/lib/databaseTls.ts
server/prod.ts
server/tests/databaseTls.test.ts
```

## 4. Verification evidence

- Focused database TLS tests: **10/10 passed**.
- The installed `pg` runtime was tested with conflicting connection-string SSL
  parameters; the explicit verified SSL object remained effective.
- Static bypass scan found no remaining
  `rejectUnauthorized: false` in `server/` or `scripts/`.
- Server TypeScript passed with no errors.
- `npm run validate` passed with:
  - **0 hard failures**; and
  - only the accepted **61-route** Development/Production parity warning.
- Development was restarted after the runtime repair.
- Development initialized the database successfully using the repaired
  configuration.
- Development `/api/health` returned a healthy response.
- `git diff --check` passed after the repair.
- No Production environment, database, storage, secrets, or infrastructure was
  accessed or changed.

The installed `pg-connection-string` package emitted its version-transition
warning for SSL-mode aliases. The focused pool test confirms the explicit
certificate-verifying SSL object is effective in the installed runtime. This
warning is not evidence about the active Production provider.

Development startup also retained an existing non-blocking Stripe billing
migration failure. It is separate from the database TLS repair and did not
prevent application startup or health verification.

## 5. Repository-verified controls

The repository directly supports the following bounded claims:

1. Environment-sensitive application configuration exists.
2. Application database paths no longer explicitly disable certificate
   verification.
3. Neon and caller-required TLS paths use certificate-verifying Node/PostgreSQL
   configuration.
4. Sentry has an application-level PII suppression and redaction boundary.
5. Application origin access is controlled by explicit allowlisting.
6. PostgreSQL pool and runtime connection behavior is explicitly configured.
7. Replit Object Storage and AWS S3 integrations exist.
8. Some application data and media classes have explicit retention/deletion
   behavior, with the Studio private-video lifecycle remaining the strongest
   verified example.

These claims do not establish project-wide HIPAA compliance, provider
certification, contractual coverage, or Production infrastructure settings.

## 6. Development-verified controls

Development evidence establishes that:

- the repaired application database configuration connects successfully;
- certificate verification is no longer disabled by application configuration;
- the application starts and serves a healthy response;
- focused TLS regression tests pass;
- server TypeScript passes; and
- the existing validation gate reports no hard failure.

Development evidence must not be represented as proof of:

- the active Production database identity;
- Production certificate chain or endpoint configuration;
- Production encryption at rest;
- Production network restrictions;
- Production backup or recovery settings;
- Production geography; or
- provider contractual status.

## 7. Unsupported or over-strong assertions

The following statements are not established by currently available evidence
and must not appear as verified project facts:

- Production definitively uses Neon.
- Every project database endpoint has been inspected.
- Only the application server can reach the database.
- The database has no public network exposure.
- Production database encryption at rest is verified.
- Production backup/PITR is configured with a known retention period.
- A successful Production restore or disaster-recovery exercise has occurred.
- Effective S3 or Replit Object Storage encryption, versioning, lifecycle,
  region, and deletion settings have been inspected.
- Backup deletion propagation is proven.
- A six-year audit archive is operational and recoverable.
- Provider retention and deletion behavior is known from SDK usage.
- Replit, OpenAI, Sentry, AWS, Resend, ElevenLabs, Stripe, or another processor
  has an executed BAA or other required agreement covering this project.
- Replit categorically offers or does not offer BAA coverage for the applicable
  account and service tier.
- The application or infrastructure is certified HIPAA compliant, SOC 2
  compliant, HITRUST certified, or penetration tested.

General provider documentation may describe encryption, backup, storage,
secrets, geography, or recovery capabilities. Such documentation establishes
availability in principle, not that the capability is enabled, included,
contracted, or tested for this project.

## 8. External and provider evidence still required

### 8.1 Replit/account evidence

- Active Production deployment type and geography
- Account-specific security and contractual documentation
- Applicable BAA availability or nonavailability
- Production secret-access controls and administrative roles
- Relevant infrastructure subprocessor chain
- Project-specific App Storage/Object Storage contractual boundary

### 8.2 Active Production database provider

- Provider and endpoint identity
- Certificate and TLS requirements
- Encryption-at-rest evidence
- Network exposure, private networking, firewall, and allowlist settings
- Backup and PITR configuration
- Backup retention and disposal
- Successful restore evidence
- Region and data residency
- Applicable BAA/DPA and subprocessor terms

### 8.3 Object storage

- Effective bucket/project policies and ACLs
- At-rest encryption and key-management settings
- Region and residency
- Versioning and delete-marker behavior
- Lifecycle and backup retention
- Deletion propagation and expired-copy disposal
- Applicable contractual coverage

### 8.4 OpenAI and other processors

- Current account and service tier
- BAA/DPA status where required
- HIPAA-eligible configuration where applicable
- Data retention and model-training settings
- Region and residency
- Provider-side deletion behavior
- Current subprocessor list
- Incident-notification terms

## 9. UTHSC institutional determinations still required

UTHSC must determine or confirm:

1. Whether the documented residual hosting and processor posture is acceptable.
2. Which provider and contractual exhibits are mandatory for approval.
3. Required Production geography and data-residency constraints.
4. Required backup frequency, retention, recovery point objective, and recovery
   time objective.
5. Required restore-test evidence and test frequency.
6. Required retention and deletion behavior by data class.
7. Whether unresolved U5 object/media ownership and U7 lifecycle gaps block
   institutional approval.
8. Whether any remaining partial control requires remediation before launch or
   may be tracked as an accepted institutional risk.

## 10. Preserved U7 dependencies

U8 does not reopen or weaken U7. The following remain unresolved:

- account deletion is not a complete cross-domain lifecycle;
- no approved delete/anonymize/retain/transfer matrix governs all data classes;
- Organization termination is not implemented;
- professional termination is fragmented;
- non-Studio uploaded-file deletion lacks complete lifecycle evidence;
- durable audit delivery and archival evidence is incomplete; and
- backup and processor deletion behavior remains external.

U8 establishes that speculative application code cannot answer these
infrastructure, provider, contractual, or institutional questions.

## 11. Residual evidence register for final U9 audit

The UTHSC readiness package and final U9 audit must continue to track:

1. Production database identity and effective TLS/provider configuration
2. Database encryption at rest and network controls
3. Backup/PITR settings, retention, and restore evidence
4. Disaster-recovery objectives and exercised recovery evidence
5. Production geography and data residency
6. Effective object-storage policy, encryption, versioning, and lifecycle
7. Backup and provider deletion propagation
8. Processor retention, deletion, region, and subprocessor evidence
9. Replit and OpenAI contractual/BAA determinations
10. Other processor agreements and institutional acceptance decisions

These items are evidence requirements, not authorization for speculative
application or infrastructure changes.

## 12. Closure

U8 is **CLOSED PARTIAL**.

The confirmed repository TLS defect was remediated and verified in Development.
All currently available repository and Development evidence has been reconciled.
No additional confirmed U8 repository defect was discovered during final
reconciliation.

U8 is not a PASS because Production-specific infrastructure, provider,
contractual, recovery, retention, residency, and institutional evidence remains
unavailable or unverified. Those residual requirements remain explicitly
tracked for the UTHSC readiness package and final U9 audit.

No Production access, deployment, publishing, infrastructure change, database
or schema mutation, secrets change, storage change, Sentry change, OpenAI
change, U7 change, or U9 work was performed during final reconciliation.

## 13. Source-control evidence

The TLS repair is present at:

```text
0497b8f087802f2cb6f8f85135d7c0be648ec3aa
```

Its parent is:

```text
06333fce8621d51abcbd8a54329e6fda21b3f8e5
```

The checkpoint contains the 13 TLS repair files listed in section 3.3. The
formal U8 report is a subsequent documentation-only working-tree change.

No manual commit, push, merge, deployment, or publishing was performed during
this documentation-only reconciliation.