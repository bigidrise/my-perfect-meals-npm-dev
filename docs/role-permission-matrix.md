# MyPerfectMeals — Role & Permission Matrix

**Version:** 1.0  
**Status:** Active  
**Effective:** 2026-05-22  
**Owner:** Engineering / Compliance  
**Review cadence:** On any role change, new route addition, or enterprise partner onboarding

---

## Purpose

This document is the authoritative definition of every role in the MPM system, what data each role can access, and what enforcement mechanisms enforce those boundaries in code. It is the reference used for:

- Enterprise security questionnaires ("what can a coach see?")
- BAA scope discussions ("which roles touch PHI?")
- Future SSO and org admin provisioning
- Access control audits and penetration testing scope
- Legal clarity for partner agreements

---

## Role Definitions

MPM has four active roles. Roles are stored in the `users.role` column and enforced server-side on every protected request.

| Role | `users.role` | `professionalRole` | Description |
|---|---|---|---|
| **Client** | `client` | — | Standard end user. Consumer of meal generation, tracking, and coaching services. |
| **Coach (Trainer)** | `coach` | `trainer` | ProCare professional with access to assigned client data for nutrition coaching. |
| **Physician** | `coach` | `physician` | ProCare professional with elevated clinical write access (oncology, GLP-1, medical protocols). |
| **Admin** | `admin` | — | Internal MPM operations. Full system access. Never a partner-facing role. |

> **Note:** `org_admin` is the next planned role (Phase 5 — Enterprise Integration Layer). It will govern studio-level administration without full system access.

---

## Enforcement Layers

Every cross-user data access must pass through at least one of these server-side guards in order:

```
1. requireAuth               — validates auth token; populates req.authUser
2. assertSameOrg             — org boundary check (Phase 1)
3. requireWorkspaceAccess    — workspace membership check (Phase 1B)
4. verifyClinicalAccess      — studio relationship + org check (T1 routes only)
5. Role gate                 — physician-only fields filtered in response body
```

No client-supplied role or entitlement flag is trusted without independent server-side verification.

---

## Permission Matrix

### Read Permissions

| Data | Client (own) | Client (other) | Coach (same org) | Physician (same org) | Admin |
|---|---|---|---|---|---|
| Own profile / onboarding | ✅ Full | ❌ | ❌ | ❌ | ✅ Read-only |
| Macro targets & meal logs | ✅ Full | ❌ | ✅ via workspace | ✅ via workspace | ✅ Read-only |
| Dietary restrictions / allergies | ✅ Full | ❌ | ✅ via workspace | ✅ via workspace | ✅ Read-only |
| Medical conditions (T1) | ✅ Own | ❌ | ✅ `verifyClinicalAccess` | ✅ `verifyClinicalAccess` | ✅ Read-only |
| Oncology support context (T1) | ✅ Own | ❌ | ❌ Physician only | ✅ `verifyClinicalAccess` | ✅ Read-only (audit logged) |
| GLP-1 protocol (T1) | ✅ Own | ❌ | ❌ Physician only | ✅ `verifyClinicalAccess` | ✅ Read-only (audit logged) |
| Glucose / biometric logs (T1) | ✅ Own | ❌ | ✅ via workspace | ✅ via workspace | ✅ Read-only |
| Nutrition strategy dashboard | ✅ Own | ❌ | ✅ via workspace | ✅ via workspace | ✅ Read-only |
| Client notes (coach-authored) | ❌ | ❌ | ✅ Same studio | ✅ Same studio | ✅ Read-only |
| Tablet messages | ✅ Own inbox | ❌ | ✅ Same workspace | ✅ Same workspace | ✅ Read-only |
| Studio membership list | ❌ | ❌ | ✅ Own studio | ✅ Own studio | ✅ Full |
| Cross-org client data | ❌ | ❌ | ❌ `assertSameOrg` blocks | ❌ `assertSameOrg` blocks | ✅ Audit logged |
| Auth tokens / password hashes | ❌ | ❌ | ❌ | ❌ | ❌ Never returned |

### Write Permissions

| Action | Client | Coach (Trainer) | Physician | Admin |
|---|---|---|---|---|
| Update own profile / onboarding | ✅ | ✅ Own profile | ✅ Own profile | ✅ |
| Log meals / biometrics | ✅ Own | ❌ | ❌ | ✅ |
| Generate AI meals | ✅ (quota gated) | ✅ (quota gated) | ✅ (quota gated) | ✅ |
| Assign meal builder to client | ❌ | ✅ Same studio | ✅ Same studio | ✅ |
| Write client notes | ❌ | ✅ Same studio | ✅ Same studio | ✅ |
| Send tablet messages | ❌ | ✅ Same workspace | ✅ Same workspace | ✅ |
| Set oncology support context (T1) | ❌ | ❌ | ✅ `verifyClinicalAccess` + physician check | ✅ (audit logged) |
| Set GLP-1 protocol (T1) | ❌ | ❌ | ✅ `verifyClinicalAccess` + physician check | ✅ (audit logged) |
| Apply system recommendation | ❌ | ✅ Same studio | ✅ Same studio | ✅ |
| End coach-client relationship | ❌ | ✅ Own studio only | ✅ Own studio only | ✅ |
| Create / manage studios | ❌ | ✅ Own studio | ✅ Own studio | ✅ |
| Archive / restore studio members | ❌ | ✅ Own studio | ✅ Own studio | ✅ |
| Board control lock | ❌ | ✅ Own workspace | ✅ Own workspace | ✅ |
| Week board operations | ❌ | ✅ Same workspace | ✅ Same workspace | ✅ |

### Export / Bulk Access

| Action | Client | Coach | Physician | Admin |
|---|---|---|---|---|
| Export own data | ✅ | ❌ | ❌ | ✅ |
| Export client list | ❌ | ✅ Own studio only | ✅ Own studio only | ✅ |
| Export PHI in bulk | ❌ | ❌ | ❌ | ❌ (requires separate audit process) |
| Access other org's data | ❌ | ❌ | ❌ | ✅ Read-only + audit logged |

---

## Org Isolation Rules

All cross-user access is subject to org isolation regardless of role:

- Every user has an `organizationId` (null = MPM public org)
- `assertSameOrg(requestingUserId, targetUserId)` is called before any professional accesses a client's data
- If orgs differ: request is blocked with HTTP 403, and an `ORG_VIOLATION` audit event is written to `audit_log` before throwing
- Self-access (`requestingUserId === targetUserId`) always passes
- Admins bypass org checks but every admin action on cross-org data is audit logged

**Implementation:** `server/lib/orgIsolation.ts`

---

## Clinical Access Rules (T1 PHI)

Routes that expose T1 Clinical PHI require a verified clinical relationship, not just same-org membership:

```
verifyClinicalAccess(requesterId, clientUserId, db)
  → confirms: active coach-client link OR active studio membership
  → confirms: same org (calls assertSameOrg internally)
  → throws 403 if either check fails
```

Additionally, oncology and GLP-1 routes enforce a physician-only gate:

```typescript
if (requester.professionalRole !== "physician") {
  return res.status(403).json({ error: "Physician access required" });
}
```

A trainer-role coach can view clinical context (biometrics, conditions) but **cannot write** oncology or GLP-1 protocols. Only physicians can write T1 clinical protocols.

**Implementation:** `server/utils/verifyClinicalAccess.ts`

---

## Entitlements

Beyond role, certain features are gated by the `users.entitlements` array:

| Entitlement | Granted to | Unlocks |
|---|---|---|
| `procare` | ProCare professionals | Coach dashboard, client management tools |
| `care_team` | ProCare professionals | Care team member management |
| `lab_metrics` | ProCare professionals | Lab results and clinical metrics views |

Entitlements are set server-side at signup, upgrade, or by admin — never by client-supplied values.

---

## Subscription Plans & Feature Access

Feature access is gated by `accessTier` (resolved server-side via `server/lib/accessTier.ts`):

| Tier | Who | Feature Access |
|---|---|---|
| `FREE` | Post-trial users | Basic meal generation only |
| `TRIAL` | New users (7-day trial) | Full paid features |
| `PAID_FULL` | Active subscribers | All consumer features |
| `PAID_PROCARE` | ProCare professionals | All consumer + full ProCare tools |

`BILLING_ENFORCED` environment variable is the master launch switch. When unset, all users are treated as `PAID_FULL` (pre-launch mode). Set to `"true"` to activate real paywalls.

---

## Audit Coverage by Role

Every action in the table below is written to `audit_log` (Phase 3):

| Event | Roles | Audit Action |
|---|---|---|
| Login | All | `AUTH_LOGIN` |
| Signup | All | `AUTH_SIGNUP` |
| Logout | All | `AUTH_LOGOUT` |
| Oncology context read | Physician, Admin | `READ` |
| Oncology context write | Physician, Admin | `WRITE` |
| GLP-1 protocol read | Physician, Admin | `READ` |
| GLP-1 protocol write | Physician, Admin | `WRITE` |
| Nutrition strategy read | Coach, Physician, Admin | `READ` |
| Apply system recommendation | Coach, Physician, Admin | `WRITE` |
| Client note write | Coach, Physician, Admin | `WRITE` |
| Tablet message write | Coach, Physician, Admin | `WRITE` |
| Org boundary violation (any role) | Any | `ORG_VIOLATION` |
| AI generation with T1 PHI in context | Client, Coach, Physician | `AI_PROMPT_PHI` |

Audit entries never store PHI values — only field names, resource IDs, and non-PHI flags.

---

## What Is Not Yet Implemented

| Gap | Status | Priority |
|---|---|---|
| `org_admin` role | Not yet in schema | P1 — needed before multi-tenant enterprise onboarding |
| Support role (temporary, read-only access) | Not yet | P2 — needed for customer support workflows |
| Granular data export permissions | Partial (own data only) | P2 |
| SSO / SAML role mapping | Not started | P1 — blocked on first enterprise partner requirement |
| Role-change audit log | Not yet | P2 — log when a user's role changes |

---

## Revision History

| Date | Change |
|---|---|
| 2026-05-22 | v1.0 — Initial role & permission matrix. Reflects enforcement as of Phase 1B + Phase 3 audit logging. |
