# My Perfect Meals — Platform Architecture Constitution

> This document defines the non-negotiable principles governing identity, permissions, trials, workspaces, and revenue access across the My Perfect Meals platform. Every feature, route, middleware, and onboarding screen should conform to it. When a rule here conflicts with an implementation, the implementation is wrong.

---

## 1. Identity Principle — There is one account

My Perfect Meals uses a **single-account architecture**.

A user has one identity within the platform. That identity may later gain additional capabilities through onboarding, certification, subscription, or partner agreements. Capabilities do not create separate accounts.

```
My Perfect Meals Account
│
├── Personal Nutrition
├── Business Center
├── ProCare Studio
├── Coach's Corner
├── Creator Studio
├── My Perfect Beginning
└── Future capabilities...
```

**Consequences:**
- Never use the phrase "account type" in user-facing copy.
- `professionalRole`, certification status, `planLookupKey`, and `trialEndsAt` are *attributes* of one identity — not markers of different account types.
- Adding a new capability never requires creating a new kind of account. It requires defining what unlocks that capability (onboarding, certification, subscription).

---

## 2. Permission Hierarchy — Four questions, always in this order

Every feature, route, and page asks the same four questions in the same order:

```
1. Is the user authenticated?
         ↓
2. Has the required onboarding been completed?
         ↓
3. Has the required certification been completed?
         ↓
4. Does the current subscription or active trial grant access?
         ↓
      Access granted
```

**Rules:**
- Nobody invents a fifth check without updating this document.
- Nobody rearranges the order.
- No single check substitutes for another. Certification answers *"Are you qualified?"* — it does not answer *"Are you licensed to use this feature commercially?"* Subscription answers the licensing question. They are independent.
- During an active trial, question 4 is always YES. Questions 1–3 still apply.

**In practice:**
- `requireAuth` → question 1
- Onboarding guards (redirect to `/onboarding` if profile incomplete) → question 2
- `requirePhase1Cert`, `requirePhase2Training` → question 3
- `requireProAccess`, `requireEssentialAccess`, `requireClinicalAccess` → question 4

---

## 3. Trial Principle — One trigger, no exceptions

> **Every account receives its trial at the same event: account creation.**

```
Account Created
      ↓
trialStartedAt = now
trialEndsAt    = now + 7 days
      ↓
Everything else
```

**Non-negotiable rules:**
- There is exactly one place in the codebase that stamps `trialStartedAt` / `trialEndsAt`. It runs unconditionally on every new user row.
- There is no branching logic such as `if (businessAccount)` or `if (professionalRole)` for trial creation.
- During the trial, all subscription gates pass. `accessTier.ts` Tier 2.5 handles this — `trialEndsAt` grants `PAID_FULL` until it expires.
- After the trial, subscription gates enforce normally. The trial does not affect certification or onboarding gates.

**Why this matters:** The trial's purpose is to answer one question — *"Can My Perfect Meals help me?"* — not *"Which version did I sign up for?"* A user who starts with Personal Nutrition and discovers ProCare on day 3 should have full access to explore it. A user who starts with ProCare should have full access to Personal Nutrition.

---

## 4. Workspace Principle — Workspaces are entry points, not account types

The workspace chooser asks:

> **"Where would you like to begin today?"**

Not:

> ~~"What type of account do you want to create?"~~

**Rules:**
- Workspaces (Personal Nutrition, ProCare Studio, Business Center, etc.) are starting points. Users can always navigate between them.
- Choosing a workspace at signup sets the initial UX destination, nothing else. It does not classify the account.
- "Account type" terminology should not appear in user-facing UI, onboarding copy, or internal routing decisions.

---

## 5. Revenue Principle — Free tier cannot earn

> **No one on the Free tier may earn revenue using My Perfect Meals.**

This is the boundary between *learning* and *participating*.

**Free tier can:**
- Browse and read all Business Center informational content
- View partner program descriptions
- See what features exist
- Keep all personal data

**Free tier cannot:**
- Generate a referral link
- Activate an affiliate account
- Earn commissions
- Use promo codes as a partner
- Download QR codes
- Invite organization members
- Launch an organization
- Manage clients in ProCare Studio
- Access clinical workflows commercially

**Enforcement rule:** Every revenue-generating API endpoint must enforce this at the server level via `requireProAccess` (or its successor in the Access Policy service). UI hiding alone is not sufficient. If the API can be called directly, it must reject Free-tier users.

---

## 6. Access Policy Service — Future architecture target

The current implementation distributes access rules across:
- `requireProAccess` / `requireEssentialAccess` / `requireClinicalAccess`
- `requirePhase1Cert` / `requirePhase2Training`
- `resolveAccessTier` / `accessTier.ts`
- Scattered `trialEndsAt` checks

The long-term target is a single **Access Policy service** that routes and pages query by capability name:

```typescript
AccessPolicy.canAccessStudio(user)
AccessPolicy.canAccessBusinessCenterActions(user)
AccessPolicy.canEarnRevenue(user)
AccessPolicy.canAccessClinical(user)
AccessPolicy.canInviteOrganizationMembers(user)
AccessPolicy.canAccessCoachDashboard(user)
AccessPolicy.canAccessPartnerDashboard(user)
```

Each method encapsulates all four permission questions for that capability. Business rules change in one place. No duplicated logic.

**Migration path:**
- Phase A: Fix identity (universal trial trigger, workspace wording)
- Phase B: Fix permissions (add subscription gates where cert-only gates exist; audit revenue endpoints)
- Phase C: Consolidate into Access Policy service

---

## 7. The one sentence to remember

> **A trial grants temporary access to platform capabilities. A subscription grants ongoing participation in the platform ecosystem.**

During the trial, someone can experience Business Center, ProCare, the affiliate ecosystem, and clinical features so they understand the platform.

Once the trial ends, they can still *learn* about those areas, but they cannot *participate* — meaning they cannot manage clients, create organizations, earn commissions, or use professional workflows — unless they have an active Pro subscription or higher.

---

*This document was established August 2026. All future features, routes, and access patterns should be reviewed against these principles before implementation.*
