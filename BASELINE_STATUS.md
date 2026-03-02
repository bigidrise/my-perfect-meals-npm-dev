# MPM Baseline Status

Last updated: 2026-03-02 (effectiveUserId identity fix across all builders)
Checkpoint: pending

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
- [x] Open builder (Weekly, Diabetic, GLP-1, Anti-Inflammatory, Beach Body, General Nutrition, Performance)
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
- [x] Open Folder modal works
- [x] Messages tab works (send/receive, translate, 10s polling)
- [x] Provider Notes tab works
- [x] View Biometrics navigates correctly
- [x] Macro Calculator navigates correctly
- [x] Client Dashboard button routes to assigned builder

### Pro Week Board (Coach edits client data)
- [x] Coach can open any of 7 builders for a client
- [x] Builder loads client's actual week_boards data (not coach's)
- [x] Saving writes to client's week_boards (verified bigidrise→myperfectmeals)
- [x] Client sees changes made by coach
- [x] Pro endpoints: GET/PUT /api/pro/weekly-board/:clientId
- [x] requireBoardAccess middleware enforces access

### Client Tablet (Messages from Coach)
- [x] Client sees "Messages From Your Coach" on More page
- [x] Client can send messages back
- [x] 10s auto-refresh polling works

### Payments
- [ ] Not tested this session (Stripe in TEST mode, all prices mapped)

## Known Issues
- `server/routes/password-reset.ts` file still exists but is not imported (dead file, can be deleted)
- `NEXT_PUBLIC_APP_URL` env var still set to `http://0.0.0.0:5000` (overridden by code, but should be removed)
- Body composition requests use hardcoded fallback `DEV_USER_ID` in `useTodayMacros` hook
- Public route constants duplicated across AuthContext.tsx, AppRouter.tsx, Router.tsx (should centralize)
- Dev and production share the same database (no staging DB separation)
- myperfectmeals@gmail.com has an incorrect self-referencing care_team_member (trainer) row and owns an empty studio (90b41e7c) — should be cleaned up

## Environment
- PRE_LAUNCH_FULL_ACCESS = true (everyone gets PAID_FULL)
- ENFORCE_SWITCH_LIMITS = false (builder switches unlimited for now)
- APP_STORAGE_VERSION = "3"
