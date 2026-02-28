# MPM Baseline Status

Last updated: 2026-02-28 (pre ProCare Phase 3 — Client Workspace UI Shell)
Checkpoint: `b042a5e86ed6dd46599f163c92b936fb8b819760`

## Golden Path Status

### Identity
- [x] Sign up works
- [x] Login works
- [x] Forgot password works (fixed 2026-02-27)
- [x] Logout works
- [x] Re-login works

### Onboarding
- [x] Complete full onboarding
- [x] Save profile + allergies
- [x] Land on dashboard

### Macro Calculator
- [x] Complete flow
- [x] Save targets
- [x] Targets visible on dashboard
- [x] Restart works

### Meal Builder
- [x] Open builder (Weekly, Diabetic, GLP-1, Anti-Inflammatory)
- [x] Save board
- [x] Reload board
- [x] Shopping list works

### Meal Builder Exchange
- [x] Page loads
- [x] Current badge shows correct builder
- [x] Switching builder updates badge immediately
- [x] Program Transitions note displays

### Pro Portal
- [x] Opens
- [x] Clients load

### Payments
- [ ] Not tested this session (Stripe not in scope)

## Known Issues
- `server/routes/password-reset.ts` file still exists but is not imported (dead file, can be deleted)
- `NEXT_PUBLIC_APP_URL` env var still set to `http://0.0.0.0:5000` (overridden by code, but should be removed)
- Body composition requests use hardcoded fallback `DEV_USER_ID` in `useTodayMacros` hook
- Public route constants duplicated across AuthContext.tsx, AppRouter.tsx, Router.tsx (should centralize)
- Dev and production share the same database (no staging DB separation)

## Environment
- PRE_LAUNCH_FULL_ACCESS = true (everyone gets PAID_FULL)
- ENFORCE_SWITCH_LIMITS = false (builder switches unlimited for now)
- APP_STORAGE_VERSION = "3"
