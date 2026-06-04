---
name: Affiliate Certification — PDF Certificate System
description: Architecture and key decisions for the affiliate cert PDF generation feature
---

## Implementation

- **PDF library**: `pdfkit` (server-side, streams Buffer directly to HTTP response)
- **Generator**: `server/services/certificateService.ts` — landscape LETTER, orange header, double border, signature zone
- **Signature image**: Drop `server/assets/cert-signature.png` (transparent PNG) to auto-embed. Gracefully skipped if file missing.

## DB

- `user_certifications.certificate_name` (text, nullable) — added via `executeSql` (drizzle-kit push times out on this project)
- Schema definition updated in `server/db/schema/certifications.ts`

## Routes (order matters)

Static routes MUST come before `/:certType` dynamic routes in `certificationRoutes.ts`:
- `GET /certificate-name` — returns any stored name across all user certs
- `GET /:certType/certificate` — streams PDF
- `POST /:certType/complete` — now accepts `{ certificateName }` in body; updates existing record if name was missing

## UX Flow

1. Dashboard "Complete Certification" → name modal (first + last name required)
2. Modal calls `POST /:certType/complete` with name → redirects to complete page
3. Complete page shows name, cert number, score, date + "Download Certificate" button
4. Download: `fetch` → `.blob()` → `URL.createObjectURL` → anchor click → `URL.revokeObjectURL`
5. Fallback inline name form on complete page for certs issued without a name

**Why:** Certificate name is stored per-cert (not on users table) because each certification is a discrete credential. Pre-fill logic checks all existing user certs for a stored name.
