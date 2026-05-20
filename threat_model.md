# Threat Model

## Project Overview

MyPerfectMeals is a full-stack TypeScript nutrition and meal-planning application. The production stack is React/Vite on the client and Express.js on Node.js with PostgreSQL via Drizzle ORM on the backend. The application handles account authentication, subscription/paywall state, AI meal generation, medical and dietary profile data, biometrics, coach/client ProCare workflows, messaging/tablet notes, Stripe and Apple purchase verification, object storage uploads, push/SMS/email notifications, and restaurant/AI integrations.

Production entry point is `server/prod.ts`, which initializes common middleware, mounts selected routers, then calls `registerRoutes(app)` from `server/routes.ts`. Development-only/mockup surfaces are out of scope unless reachable through `server/prod.ts` with `NODE_ENV=production`. Assume production deployments use platform TLS.

## Assets

- **User accounts and sessions** -- password hashes, persistent auth tokens, session cookies, reset tokens, account IDs, roles, subscription state, and entitlement data. Compromise enables impersonation and paid-feature abuse.
- **Health, medical, and nutrition data** -- biometrics, glucose/GLP-1/diabetes/body-composition data, allergies, dietary restrictions, oncology-support fields, macro targets, meal logs, and behavioral preferences. This is highly sensitive personal data.
- **Coach/client ProCare data** -- professional credentials, client links, studio memberships, assigned builders, client notes, tablet messages, board control, and program history. Unauthorized access can expose or modify another person's care plan.
- **Payment and subscription data** -- Stripe checkout/webhook events, Apple purchase verification, customer/subscription IDs, product codes, and plan lookup keys. Tampering can unlock paid features or cause incorrect fulfillment.
- **Uploaded objects and generated media** -- profile photos, user-uploaded media, meal images, and object-storage paths. Unauthorized uploads or reads can expose files or create storage/billing abuse.
- **Application and third-party secrets** -- database URL, session secret, Stripe/OpenAI/Resend/Twilio/Firebase/S3/Object Storage credentials, and webhook secrets.

## Trust Boundaries

- **Browser/native client to API** -- all frontend requests are untrusted. The API must authenticate with either a valid server-side session or auth token and must authorize each object by the authenticated user/relationship.
- **Cross-origin web to API** -- CORS configuration determines which external sites can send credentialed requests and read API responses. Credentialed CORS must be restricted to controlled production origins.
- **API to PostgreSQL** -- the backend has broad database access. All queries must be parameterized and scoped by authenticated user/authorized client relationship.
- **API to object storage** -- upload signing and object serving cross into private storage. Signing must be authenticated, size/type constrained, and object reads must enforce ACL/ownership unless intentionally public.
- **API to payment providers** -- Stripe/Apple callbacks and client-initiated checkout/purchase verification must verify provider signatures/receipts and never trust client-provided payment status.
- **Authenticated user to ProCare/admin/professional surfaces** -- professional and client workflows must enforce role, studio/client relationship, and board-control permissions server-side.
- **Public/free/paid feature boundary** -- public routes may serve marketing, legal, health checks, and limited guest/free generation. Paid or quota-limited features must be enforced server-side, not only in the client.
- **Server to external APIs** -- AI, restaurant, geocoding, email/SMS, and push APIs receive user-controlled prompts or contact data. Calls must avoid SSRF/open redirect patterns, leaking secrets, or logging sensitive data.

## Scan Anchors

- Production entry: `server/prod.ts`; main route registration: `server/routes.ts`; auth middleware: `server/middleware/requireAuth.ts`; auth/session routes: `server/routes/auth.session.ts`.
- Highest-risk routes/directories: `server/routes/procareRoutes.ts`, `server/routes/studioRoutes.ts`, `server/routes/proTabletRoutes.ts`, `server/routes/clientTabletRoutes.ts`, `server/routes/stripe*.ts`, `server/routes/iosVerify.ts`, `server/routes/uploads.ts`, `server/replit_integrations/object_storage/routes.ts`, `server/routes/biometricsRoutes.ts`, `server/routes/manualMacros.ts`, `server/routes/mealBoards.ts`, and `server/routes/proWeekBoard.ts`.
- Public/authenticated/admin surfaces: public legal/health/marketing/guest endpoints; authenticated profile, biometrics, meal logs, shopping, saved meals; paid/active access AI generation; professional ProCare/studio/tablet surfaces; QA/admin routes mounted under `/admin` in development entry and any production-mounted admin endpoints.
- Dev-only or usually out of scope: mockup sandboxes, `client/src/pages/onboarding-standalone.tsx`, `client/dist`, local scripts, migration scripts, tests, and development-only routes gated by `NODE_ENV === "development"`.
- Prioritize broken access control/IDOR in `:userId`/`:clientId` routes, credentialed CORS/CSRF, object storage access controls, payment fulfillment trust, auth token/session lifetime, and sensitive health/medical data exposure.

## Threat Categories

### Spoofing

Attackers may try to impersonate users, professionals, or payment providers. All protected routes must require a valid session or auth token; persistent tokens and reset tokens must be unpredictable, rotated on sensitive changes, and not logged. Stripe webhooks must verify signatures, Apple purchases must verify receipts server-side, and client-provided role/payment/professional fields must never be trusted without server-side checks.

### Tampering

Clients can manipulate request bodies, user IDs, client IDs, object paths, subscription fields, macro targets, and meal-board contents. The server must scope mutations to the authenticated user or an authorized ProCare/studio relationship, enforce board-lock permissions, validate schema and business rules server-side, and calculate/verify paid-feature access independently of the frontend.

### Repudiation

Sensitive actions such as coach activation, client-link changes, board-control toggles, medical protocol changes, legal acceptance, account deletion, and payment fulfillment need durable audit records identifying the acting user and timestamp. Logs must avoid exposing medical, credential, or contact data while still preserving enough evidence for incident review.

### Information Disclosure

Health, medical, nutrition, coaching, and professional credential data must only be returned to the data owner or an authorized professional relationship. API responses, object-storage reads, debug/health endpoints, browser storage, console logs, error messages, and credentialed CORS must not expose sensitive data to unauthorized origins or unauthenticated users.

### Denial of Service

Public and authenticated endpoints that invoke AI generation, object-storage signing, uploads, email/SMS/push, geocoding, or database-heavy scans must be rate limited and quota constrained. Upload signing must restrict size/type and require authentication to prevent storage and billing abuse.

### Elevation of Privilege

Users must not be able to become paid users, testers, professionals, coaches, physicians, or admins through client-controlled fields or hardcoded production flags. Professional routes must verify role and client/studio relationship server-side. Database queries must be parameterized, filesystem/object-storage paths must prevent traversal or unauthorized access, and uploaded content must not execute in the browser.