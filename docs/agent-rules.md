# Agent Safety Rules — My Perfect Meals

These rules are mandatory for all agents working on this codebase.

## Routing

- Routes must only be mounted inside `server/routes.ts` via `registerRoutes(app)`.
- Never mount routes in `server/index.ts` or `server/prod.ts` unless they require specific middleware ordering (e.g., Stripe webhooks that need raw body parsing before `express.json()`).
- Never remove an existing endpoint without explicit user approval and an audit of all callers (frontend, iOS, Android).
- All endpoints must begin with `/api/`.

## Security

- Never expose external API keys (OpenAI, ElevenLabs, Stripe, Twilio, etc.) to the client. All third-party calls must be proxied through server endpoints.
- All user-data endpoints must use `requireAuth` + `getAuthUserId(req)`.
- Delegated endpoints (coach/client flows) must use `assertSelfOrProAccess`.

## UI Rules

- Never use radio buttons. Use pill buttons only.
- Never use hover-dependent UI. All buttons must be fully visible and readable without any interaction.
- No `variant="outline"` white/invisible ghost buttons. Use solid backgrounds (`bg-orange-600`, `bg-white/10`, etc.) with visible text.
- Page color theme: black/orange gradient (`from-black/60 via-orange-600 to-black/80`). Never use purple.
- Dismissible UI must use the `mpm.dismiss.<featureName>` localStorage pattern.

## Change Discipline

- One change set, one purpose. No bonus refactors or "while I'm here" edits.
- Only touch files listed in the scope of the requested change.
- Do exactly what is asked. Do not rewrite, restructure, or "improve" components that were not part of the request.
- All new features must use `PhaseGate` for phased rollout.

## Feature Gating & Tester Program

- `TESTER_PROGRAM_ACTIVE` flag controls tester bypass. Set in 3 files: `client/src/lib/subscriptionCheck.ts`, `server/lib/accessTier.ts`, `server/routes/auth.session.ts`. All 3 must be flipped together.
- While `TESTER_PROGRAM_ACTIVE = true`, users with `is_tester = true` get full paid access, and all new signups auto-get `is_tester = true`.
- `freetest@myperfectmeals.com` is the only account with `is_tester = false` — used to test the free-tier experience.
- Free tier features: Only Fridge Rescue (1/day) and macro tools are functional for free users.
- All other features are visible but locked with `useFreeLock` hook and `UpgradeLockModal`.
- Do not flip `TESTER_PROGRAM_ACTIVE` to `false` without explicit user approval — this is the launch switch.

## Database

- Never change primary key ID column types.
- Schema changes must preserve existing data.
- Use `npm run db:push` to sync schema, never manual SQL migrations.

## Testing

- After any change, verify the app compiles and starts without errors.
- Check deployment logs after publishing for 404s, 500s, or missing routes.
- The route audit log at startup must show all critical routes as mounted.
