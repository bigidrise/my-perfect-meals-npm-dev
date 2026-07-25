# My Perfect Meals — Feature Impact System

Every new feature, enhancement, or user-facing change goes through this assessment
before it is considered complete. No exceptions.

The agent emits a **Feature Completion Report** (see format at the bottom of this
document) at the end of every feature. That report answers all 12 questions below
and is the final gate before moving to the next feature.

---

## The 12 Areas

### 1. Backend / Core Logic

**Question:** Was server-side code, database schema, middleware, or AI prompting changed?

If yes — confirm:
- Routes are properly gated (requireAuth, requireEssentialAccess, requireProAccess,
  requireClinicalAccess, etc.)
- Effective access is used everywhere (never raw `planLookupKey` for access decisions)
- Boot migrations run idempotently on both `server/index.ts` (dev) and `server/prod.ts`
  (prod)
- Any new route in `routes.ts` is also mounted in `server/prod.ts`

---

### 2. Chef Copilot Knowledge

**Question:** Does Chef Copilot need to know about this change?

Examples that require a Copilot update:
- New builder added
- New protocol or nutrition logic
- New Coach's Corner capability
- New navigation or workflow
- New recommendation type
- New clinical condition support

If yes → Update Copilot knowledge base / system prompt context.

---

### 3. App Library

**Question:** Does this become part of how the platform works for users or professionals?

Examples that require an App Library update:
- New builder
- New hub or dashboard
- New physician workflow
- New organization workflow
- New ProCare capability

If yes → Add or update the relevant App Library entry.

---

### 4. Academy Review

**Question:** Does a user need to learn how to use this?

Examples:
- New builder or screen
- New onboarding step or workflow
- New clinical feature accessible to users

If yes → Review each track and determine the action:

| Track | Review? | Action |
|-------|---------|--------|
| Platform Mastery | ? | update lesson / create lesson / add quick tip / no change |
| Professional Academy | ? | update lesson / create lesson / no change |
| Business Academy | ? | update lesson / create lesson / no change |

---

### 5. Certification Review

**Question:** Does this affect how professionals do their job?

Examples:
- Trainer workflow changed
- Physician workflow changed
- Care Team logic changed
- Clinical intervention updated
- Studio workflow updated

If yes → Review ProCare Certification questions:
- Add question
- Revise existing question
- Add scenario
- No change

---

### 6. Pro Tips

**Question:** Did a workflow change in a way existing users need to know about?

Workflows to check:
- Builders (Create a Dish, Weekly Meal Board, Snack Creator, Beverage Creator, etc.)
- Studio management
- Restaurant Guide
- Scanner
- ProCare client workflow

If yes → Update the relevant Pro Tip.

---

### 7. What's New / Release Notes

**Question:** Would existing users benefit from knowing about this change?

If yes → Add entry to:
- What's New (in-app)
- Release Notes (external)

---

### 8. Sources Review

**Question:** Does this feature change the scientific or clinical basis of a recommendation?

Areas that require a Sources update:
- Behavioral coaching
- Clinical nutrition recommendations
- Nutrition science
- Exercise science
- GLP-1 guidance
- Diabetes management
- Anti-inflammatory guidance
- Performance nutrition
- Supplement guidance
- Medical protocols
- Oncology support

If yes → Update Sources page with:
- Behavioral sources
- Nutrition sources
- Medical / clinical sources

---

### 9. White Label Review

**Question:** Does this affect partner-facing systems?

Areas to check:
- White Label (custom branding, custom domains)
- Founding Partner package
- Organization portal
- Business Portal

If yes → Review and update the relevant partner-facing layer.

---

### 10. Marketing Review

**Question:** Is this feature a selling point?

If yes → Update:
- Demo script
- Partnership deck
- Sales packet
- Website copy
- Marketing assets

---

### 11. AI Training Review

**Question:** Does the AI reasoning engine need to be updated to reflect this change?

Examples:
- Coach's Corner behavior changed
- Behavior Engine updated
- Meal recommendation logic changed
- Clinical reasoning updated
- Organization reasoning updated
- Supplement recommendation logic changed

If yes → Update the relevant AI prompt or context injection.

---

### 12. Testing Review

**Question:** What subscription tiers and user types are affected by this change?

For every affected tier, confirm the behavior is correct:

| Tier | Affected? | Behavior verified? |
|------|-----------|-------------------|
| Free | ? | ? |
| Essential | ? | ? |
| Pro | ? | ? |
| Clinical | ? | ? |
| Clinical Business | ? | ? |
| Organization / White Label | ? | ? |

---

## Feature Completion Report Format

The agent MUST emit this report at the end of every feature before marking it done.

```
## Feature Completion Report — [Feature Name]

**What changed:** One sentence summary.

| Area | Status | Action / Notes |
|------|--------|----------------|
| Backend | ✅ Complete | [what was changed] |
| Copilot | ✅ / ⚠️ / ❌ | [action or "No change"] |
| App Library | ✅ / ⚠️ / ❌ | [action or "No change"] |
| Academy | ✅ / ⚠️ / ❌ | [which track, what action] |
| Certification | ✅ / ⚠️ / ❌ | [action or "No change"] |
| Pro Tips | ✅ / ⚠️ / ❌ | [action or "No change"] |
| What's New | ✅ / ⚠️ / ❌ | [action or "No change"] |
| Sources | ✅ / ⚠️ / ❌ | [action or "No change"] |
| White Label | ✅ / ⚠️ / ❌ | [action or "No change"] |
| Marketing | ✅ / ⚠️ / ❌ | [action or "No change"] |
| AI Training | ✅ / ⚠️ / ❌ | [action or "No change"] |
| Testing | ✅ / ⚠️ / ❌ | [tiers verified or flagged] |
```

**Status key:**
- ✅ Complete — done in this session
- ⚠️ Action required — needs follow-up before this feature ships
- ❌ Not applicable — confirmed no impact

**⚠️ items must be resolved or explicitly deferred (with a reason) before the feature
is considered production-ready.**

---

## Quick Reference — When All 12 Matter

A backend-only bug fix (no user-visible change) typically produces:

| Area | Status |
|------|--------|
| Backend | ✅ |
| Copilot | ❌ |
| App Library | ❌ |
| Academy | ❌ |
| Certification | ❌ |
| Pro Tips | ❌ |
| What's New | ❌ |
| Sources | ❌ |
| White Label | ❌ |
| Marketing | ❌ |
| AI Training | ❌ |
| Testing | ✅ (affected tiers verified) |

A new Coach's Corner behavioral feature typically produces:

| Area | Status |
|------|--------|
| Backend | ✅ |
| Copilot | ⚠️ update required |
| App Library | ⚠️ update required |
| Academy | ⚠️ Professional Academy review |
| Certification | ⚠️ add scenario |
| Pro Tips | ⚠️ update workflow tip |
| What's New | ⚠️ add entry |
| Sources | ⚠️ behavioral sources update |
| White Label | ❌ |
| Marketing | ⚠️ demo script update |
| AI Training | ⚠️ Coach's Corner context update |
| Testing | ✅ Pro + Clinical tiers verified |
