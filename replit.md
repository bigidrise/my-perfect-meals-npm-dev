# MyPerfectMeals

MyPerfectMeals is a full-stack TypeScript application providing AI-powered meal generation, dietary tracking, and biometric monitoring for personalized nutrition management.

## Run & Operate

**Required Environment Variables**:
- `COACH_JEN_USER_ID`, `COACH_JEN_STUDIO_ID` (for each coach)
- `ONCOLOGY_SUPPORT_V1` (default: active, set to "off" to disable)
- `MACRO_AUDIT` (set to `true` for macro debug logging)
- `BILLING_ENFORCED` — set to `"true"` to activate real paywalls. While unset/false, everyone gets PAID_FULL (pre-launch mode). This is the master launch switch — no code deploy needed.
- `PHASE2_GATE_ENABLED` — set to `"true"` to enforce the Phase 2 ProCare Training gate on the server and client. While unset/false, all professionals pass through freely. Flip to `"true"` only after Phase 2 content ships AND the grandfather migration has run (the migration is idempotent and runs automatically on every boot).
- `MPM_TESTER_EMAILS` — comma-separated list of emails that get `isTester=true` on signup. Empty = no testers (post-launch default).
- ~~`TESTER_PROGRAM_ACTIVE`~~ — **REPLACED** by `BILLING_ENFORCED` + `MPM_TESTER_EMAILS`. Do not use.

**Commands**:
- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run typecheck`: Runs TypeScript type checking.
- `drizzle-kit push:pg`: Pushes Drizzle schema changes to PostgreSQL.
- `npm run validate`: Full pre-push validation (TypeScript, core files, auth safety, i18n interpolation, server boot).
- `npm run validate:i18n`: Standalone translation interpolation quality scan — checks every locale for `{{variable}}` mismatches against the English baseline. Exits non-zero if any mismatch is found; run before every release to prevent interpolation bugs from shipping. Report written to `docs/localization/value-quality-report.json`.

## Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, shadcn/ui, Wouter
- **Backend**: Express.js (Node.js 20)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **AI**: OpenAI API
- **Payments**: Stripe
- **Email**: Resend
- **SMS**: Twilio
- **Push Notifications**: VAPID
- **iOS Purchases**: `@squareetlabs/capacitor-subscriptions`

## Where things live

- **DB Schema**: `server/db/schema/*` & `shared/schema.ts`
- **API Routes**: `server/routes.ts`, `server/routes/*`
- **UI Components**: `client/src/components/*`
- **Pages**: `client/src/pages/*`
- **Client Config**: `client/src/config/*`
- **Server Config**: `server/config/*`
- **Shared Utilities/Types**: `shared/*`
- **Coach Registry (Frontend)**: `client/src/config/coaches.ts`
- **Coach Registry (Backend)**: `server/config/coaches.ts`
- **Legal Documents**: `shared/legalDocuments.ts`
- **Plan Features/Access Tiers**: `shared/planFeatures.ts`
- **Professional Builder Map**: `client/src/lib/professionalBuilderMap.ts`

## Architecture decisions

- **Free-first model**: Users can access basic features, with a `hasActivePaidSubscription(user)` check gating advanced functionality.
- **Protocol Envelope & 4-Layer Constraint Hierarchy**: All AI generation flows use `server/services/protocolEnvelope.ts` to assemble a `UserProtocolEnvelope` and enforce a strict hierarchy: (1) Medical, (2) Dietary Identity, (3) Cultural/Cuisine Preference, (4) Behavioral Preference.
- **Macro Truth Contract**: `server/services/guardrails/macroTruthContract.ts` ensures that macro values are never invented (null=unknown, 0=known zero) and are only rejected or regenerated, never mutated.
- **Slug-based Coaching System**: New coaches are added by updating config files and environment variables; no code changes required for coach onboarding.
- **Creator System Layer (Branded Kitchens)**: Allows chefs/coaches to customize meal generation output styling (name, description, instructions) via `creator_system_configs` in the DB, without affecting core medical/dietary guardrails.
- **Hydration evidence and discovery**: Every source used by the Hydration Formula & Numeric Safety Policy must be captured in a structured, versioned evidence record containing title, organization/author, publication date, URL or citation, supported rule, evidence level, population scope, and the Hydration policy version informed. The approved evidence registry must feed the Resources page. When Hydration is user-ready, register it in the App Library with its description, purpose, supported use cases, safety boundaries, and Hydration Center link.

## Product

- AI-powered meal generation (Create a Dish, Chef's Kitchen, Snack Creator, Beverage Creator, Craving Creator, Fridge Rescue, Meal Planner, Holiday Feast).
- Detailed dietary and biometric tracking.
- Personalized meal plans with clinical mode support (e.g., Anti-Inflammatory, Oncology Support).
- Professional coaching platform with client management and communication tools.
- Multi-course meal generator for ultimate experiences (e.g., Holiday meals).
- Freemium model with "show but lock" for paid features.

## User preferences

- **NEVER use radio buttons.** The app uses a pill button system for all selection inputs. Always use pill buttons instead of radio buttons, no exceptions.
- **Info/action trigger buttons: always use `PillButton`.** Import from `@/components/ui/pill-button`. This is the standard button style for ALL info triggers, labels, small action buttons, and selection chips across the entire app. NEVER substitute a circular icon button, ghost button, or custom inline button where a pill is appropriate.
- **Page color theme**: Accent colors are orange (e.g., `text-orange-400`, `bg-orange-600`). NEVER use purple gradients or purple accents on any page.
- **Feature page backgrounds (global standard)**: All lifestyle/creator feature pages (Craving Creator, Dessert Creator, Sushi Creator, Wine Pairing, Fridge Rescue, Beverage Creator, etc.) use a **thematic photo background** with a `linear-gradient(rgba(0,0,0,0.44), rgba(0,0,0,0.40))` dark overlay. The main card on each page is `bg-black/10 backdrop-blur-lg`. Do NOT use the old orange gradient (`from-black/60 via-orange-600 to-black/80`) on these pages. Pages without a dedicated photo background (e.g. settings, onboarding) may keep solid dark backgrounds.
- **NEVER use hover-dependent UI.** No hover states that reveal text, change meaning, or make content readable. Mobile has no hover. All buttons must be fully visible and readable without any interaction. No `variant="outline"` white/invisible ghost buttons — use solid backgrounds (`bg-orange-600`, `bg-white/10`, etc.) with visible text at all times.
- Dismissible UI must follow the `mpm.dismiss.<featureName>` localStorage pattern (see Dismissible UI Pattern below).
- **NEVER use `client/src/pages/onboarding-standalone.tsx`** for onboarding changes. The ONLY active onboarding is `client/src/pages/OnboardingV3.tsx`.
- When mentioning "Chef's Kitchen," confirm if `CreateDishPage` (creation) or `ChefsKitchenPage` (walkthrough) is intended.
- Never store coach user IDs on the frontend. Always use slug only.

## Gotchas

- **DEAD CODE**: `client/src/pages/onboarding-standalone.tsx` is dead code; do not use or modify.
- **Onboarding**: All onboarding changes must target `client/src/pages/OnboardingV3.tsx`.
- **UI Element Confusion**: Carefully distinguish between "Create a Dish" (`CreateDishPage`), "Chef's Kitchen" (`ChefsKitchenPage`), "Create With Chef" (modal `CreateWithChefModal.tsx`), "Snack Creator" (modal `SnackCreatorModal.tsx`), and "Beverage Creator" (`BeverageCreator.tsx`).
- **Clinical Safety Overrides**: User preferences (e.g., heat preference) are automatically capped or overridden by clinical safety rules for users with specific medical conditions.
- **Macro Truth Enforcement**: The `Macro Truth Contract` (v1.0) explicitly prevents AI from inventing macro values and blocks macro injection for specific diet types.
- **Oncology Support**: `oncology_support_context` is physician-assigned and not public-facing; the separate `oncology_support_intent` captures user onboarding intent only. Hard-blocked ingredients are enforced at prompt and post-generation. No treatment claims are allowed.
- **Coach Enrollment**: No one enters the Pro Portal queue without completed payment.
- **"Bold & Flavorful" Slug**: The internal slug `bold-spicy` remains unchanged despite display name updates.

## Before Every GitHub Push — Pre-Push Checklist

The pre-push validation runs **automatically** via a git pre-push hook whenever you run `git push`. You no longer need to remember to run it manually.

**First-time setup** (run once after cloning):
```bash
bash scripts/install-hooks.sh
```

This installs `.git/hooks/pre-push`, which calls `bash scripts/validate.sh` before every push. The validation takes ~15–20 seconds and checks that critical server files are present, no raw fetch() calls are hitting auth-protected routes, and the server boots cleanly.

If the hook is not yet installed, you can still run validation manually:
```bash
npm run validate
```

It does **not** run the client TypeScript check (client TS errors are pre-existing and non-blocking). If it exits **PASS**, push. If it exits **FAIL**, fix the issues first.

**Emergency bypass** — skip the hook only when absolutely necessary:
```bash
git push --no-verify
```

**Full deploy sequence (do not deviate):**
1. Make all changes in dev space only
2. `npm run validate` — must pass
3. `git push origin dev` (or `npm run push` for a timestamped snapshot commit)
4. On GitHub: open a PR from `dev` → `main` and merge
5. In the production shell: `git pull`
6. **Run `bash scripts/pre-publish-validate.sh`** — must pass before clicking Publish.
   Checks that production points at the correct storage bucket (not the dev bucket),
   DATABASE_URL is a prod host, all critical secrets are set, storage and DB are reachable,
   and the built client bundle contains no dev URLs. Exit non-zero = do NOT publish.
7. Click Publish in Replit
8. Confirm production is healthy: check `/api/health` in browser
9. Update `LAST_STABLE.md` with the new commit hash
   **If production is broken after publish:** follow `ROLLBACK.md` — do not improvise.

**If production breaks after a pull:**
Open `LAST_STABLE.md`, copy the last known-good commit hash, and run in the production shell:
```bash
git reset --hard <commit-hash>
```

**Never:**
- Edit files directly in the production space (except emergency hotfixes)
- Push without running `npm run validate` first
- Run `git rebase` in production — use merge only

## User Preferences

- **Text on dark backgrounds must always be legible.** Every background in this app is dark. Never use `text-gray-500`, `text-gray-600`, `text-muted-foreground`, `text-zinc-500`, `text-slate-500`, or any mid-gray Tailwind class expecting it to be readable — it won't be. For secondary/supporting text use `text-gray-300` or lighter. For body/paragraph text use `text-white/80` or `text-gray-200`. The CSS variable `--muted-foreground` in the dark theme is set to 78% lightness — use `text-muted-foreground` freely, it is now visible.

## Pointers

- **Agent Rules**: `docs/agent-rules.md`
- **Baseline Status**: `BASELINE_STATUS.md`
- **Change Log**: `CHANGE_LOG.md`
- **Last Stable Deploy**: `LAST_STABLE.md`
- **Dismissible UI Pattern**: _Populate as you build_
- **Golden Path Checklist**: _Populate as you build_