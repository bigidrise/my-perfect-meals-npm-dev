# System 15: Guest Progression & Freemium Gateway (GPFG)

**Classification:** Growth Infrastructure — Acquisition and Conversion
**Status:** Active, Production

---

## Purpose

The Guest Progression & Freemium Gateway is the system that manages the experience of users who have not yet created an account or completed onboarding. It provides meaningful, limited access to the platform's core value — AI meal generation — while creating a structured progression path toward account creation and paid subscription.

The design principle:

> **Give guests enough to understand the product's value, but not enough to substitute for the full product. Every interaction should be a reason to stay.**

---

## Components

### 1. Guest User Identity
Guests are tracked without requiring account creation. A guest identity is established at first visit and persists via:
- Browser session / localStorage
- Guest-specific state management (`useGuestProgress` hook)

Guests are not anonymous — their generation history and progression state are maintained across the session.

### 2. Guest Generation Access
Guests can generate meals — but with constraints:
- Limited number of generations before the paywall appears
- No access to clinical protocol features
- No access to the weekly board or meal planning
- No saved meals

The generation experience is real (not a demo), which is critical for conveying actual product value.

### 3. Guest Progression Tracking
The `useGuestProgress` hook tracks where the guest is in the progression journey:
- Have they generated their first meal?
- Have they viewed the meal details?
- Have they attempted to save?
- Have they hit the generation limit?

Each milestone triggers context-specific nudges delivered through the Copilot.

### 4. Copilot Guest Nudge System
The Chef Copilot delivers adaptive nudges to guests based on their progression state. These are not generic "sign up!" prompts — they are contextual messages tied to the specific action the guest just took:

- After first generation: "Nice — your first AI meal. Want to save it and plan your week?"
- After viewing meal details: "This is what personalized nutrition looks like. Create an account to make it fit your goals."
- After hitting generation limit: "You've found the edge of what's possible without an account. Here's what opens up."

**Key component**: `guestNudgeMessage` in `CopilotSheet.tsx`

### 5. Onboarding Funnel (V3)
New users are guided through a structured onboarding flow (`OnboardingV3.tsx`) that:
- Captures dietary preferences, health conditions, and goals
- Establishes the user's protocol envelope (which activates immediately for their first generation)
- Presents the plan options and initiates payment flow
- Is the only active onboarding path (legacy versions are dead code)

### 6. Plan Access Control & Billing Gate
The `BILLING_ENFORCED` environment variable is the master switch:
- `BILLING_ENFORCED=false` (default, pre-launch): All users receive full access regardless of plan
- `BILLING_ENFORCED=true` (post-launch): Plan tiers are enforced — features are gated by subscription

Plan tiers:
| Tier | Key | Features |
|---|---|---|
| Free | (no subscription) | Limited generation, basic features |
| Essential | `basic` | Full generation, standard features |
| Pro | `premium` | Advanced features, ProCare access |
| Clinical | `ultimate` | Clinical protocols, full biomarker integration |

**Key file**: `shared/planFeatures.ts`

### 7. Tester Program
Specific email addresses can be granted full access (`isTester=true`) for testing purposes, controlled by the `MPM_TESTER_EMAILS` environment variable. This replaces the deprecated `TESTER_PROGRAM_ACTIVE` flag.

### 8. Show-But-Lock Pattern
Premium features are visible to all users but locked behind a plan upgrade prompt. This is the "freemium shelf" model — users can see what they're missing, which is more motivating than hiding features entirely.

---

## Architecture

```
New Visitor
    │
    ▼
Guest Identity Established
    │
    ├── Guest Generation Access (limited)
    ├── Guest Progress Tracking
    └── Copilot Nudge System (contextual)
         │
         ▼
    Account Creation → OnboardingV3
    ├── Protocol capture
    ├── Plan selection
    └── Payment (Stripe / Apple IAP)
         │
         ▼
    Authenticated User
    ├── BILLING_ENFORCED=false → Full access (pre-launch)
    └── BILLING_ENFORCED=true  → Plan-tiered access
         │
         ├── Essential: Standard features
         ├── Pro: Advanced + ProCare
         └── Clinical: Full clinical stack
```

---

## Key Files

| File | Role |
|---|---|
| `client/src/pages/OnboardingV3.tsx` | Only active onboarding flow |
| `shared/planFeatures.ts` | Feature gate definitions by tier |
| `client/src/hooks/useGuestProgress.ts` | Guest progression tracking |
| `client/src/components/copilot/CopilotSheet.tsx` | Guest nudge delivery |
| `server/routes/auth.session.ts` | Auth and session management |
| `server/routes/stripe*.ts` | Payment and subscription management |
| `server/routes/iosVerify.ts` | Apple IAP verification |

---

## What Makes This Unique

1. **Real generation for guests** — guests experience actual AI meal generation, not a demo or placeholder. This communicates product value more effectively than any marketing copy.
2. **Progression-aware nudging** — nudge messages are tied to specific guest milestones, not generic conversion prompts
3. **Environment-variable launch switch** — the billing gate is controlled by a single env var, allowing the product to operate in pre-launch (open access) mode without code changes
4. **Show-but-lock architecture** — premium features remain visible, creating pull rather than mystery. Users choose to upgrade toward something they've already seen.
5. **Tester program infrastructure** — email-controlled tester access is a lightweight but production-quality mechanism for managed beta testing

---

## Integration

- **Feeds into**: Copilot (System 7) — guest nudge content delivered through Copilot sheet
- **Gates**: All premium features via `planFeatures.ts`
- **Connected to**: Stripe (payment), Apple IAP (iOS purchases)
- **Controlled by**: `BILLING_ENFORCED` environment variable (master launch switch)
