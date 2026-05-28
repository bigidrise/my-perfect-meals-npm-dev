# System 05: ProCare Professional Infrastructure (PPI)

**Classification:** B2B Platform — Professional Tools
**Status:** Active, Production

---

## Purpose

ProCare is MPM's professional infrastructure — a fully integrated coach-client management platform that lives inside the same system generating the user's meals. It allows registered coaches, dietitians, and physicians to:

- Monitor their clients' meal planning and adherence
- Assign clinical protocols and override user preferences
- Communicate in real time through a tablet-style interface
- Track behavioral patterns and biometric data
- Manage studio memberships and client enrollment

The critical differentiator: **this is not a separate app or portal.** ProCare operates on the same data, the same meal generation engine, and the same AI infrastructure as the consumer product. A coach's clinical override flows directly into the UP-FEM enforcement layer within seconds.

---

## Infrastructure Components

### 1. Studio System
Each coach operates within a "Studio" — a branded professional environment that manages:
- Client roster
- Subscription and enrollment management
- Assigned builders and meal plans
- Studio-level branding (for Signature Kitchen-linked coaches)

**Key routes**: `server/routes/studioRoutes.ts`

### 2. ProCare Tablet Interface
A tablet-optimized interface for coaches to:
- Review client meal boards in real time
- Send targeted meal guidance via messages
- Flag behavioral patterns for conversation
- Post announcements to multiple clients

**Key routes**: `server/routes/proTabletRoutes.ts`, `server/routes/clientTabletRoutes.ts`

### 3. Meal Board Control System
Coaches can take "board control" — temporarily assuming management of a client's weekly meal board to:
- Add or replace meals
- Adjust macro targets
- Set specific meal requirements for a period

Board control has an explicit lock/unlock mechanism to ensure the client knows when their board is coach-managed.

**Key routes**: `server/routes/mealBoards.ts`, `server/routes/proWeekBoard.ts`

### 4. Clinical Protocol Assignment
Physicians and clinical coaches can assign:
- Anti-inflammatory protocol
- Oncology support context (physician-only, not self-assignable)
- GLP-1 tracking mode
- Custom macro targets (overrides system-calculated targets)

These assignments flow directly into the AHCS hub activation and UP-FEM enforcement.

### 5. ProCare Activation & Enrollment
New coaches are activated through a structured enrollment flow that:
- Validates payment (no one enters the Pro portal without completed payment)
- Provisions studio access
- Links coach to their assigned builder set

**Key service**: `server/services/procareActivation.ts`

### 6. Messaging & Communication
Bi-directional messaging between coach and client, surfaced in both the ProCare tablet and the client's app view. Message delivery is supported via push notification, SMS (Twilio), and email (Resend).

---

## Architecture

```
Coach (ProCare Portal)
    │
    ├── Studio Management ──────────────┐
    ├── Client Roster ──────────────────┤
    ├── Tablet Interface ───────────────┼──► ProCare DB Layer
    ├── Board Control ──────────────────┤
    ├── Protocol Assignment ────────────┘
    │                │
    │                ▼
    │         UP-FEM Enforcement Layer
    │         (clinical overrides injected)
    │
    └── Messaging System
             │
             ├── Push (VAPID)
             ├── SMS (Twilio)
             └── Email (Resend)

Client (Consumer App)
    ├── Sees coach assignments in meal board
    ├── Receives messages in tablet view
    ├── Behavioral data visible to coach
    └── Cannot override physician-assigned protocols
```

---

## Inputs

| Input | Source |
|---|---|
| Coach credentials and role | Auth system |
| Client enrollment | Stripe payment verification |
| Clinical protocol assignments | Coach/physician input |
| Macro target overrides | Coach input |
| Client behavioral summaries | BMAS (System 4) |

## Outputs

| Output | Used By |
|---|---|
| Clinical overrides → UP-FEM | All generation engines for that client |
| Meal board modifications | Client-facing meal display |
| Coach messages | Client notification system |
| Studio analytics | Coach dashboard |
| Enrollment confirmations | Email, SMS |

---

## Key Files

| File | Role |
|---|---|
| `server/routes/procareRoutes.ts` | Core ProCare API |
| `server/routes/studioRoutes.ts` | Studio management |
| `server/routes/proTabletRoutes.ts` | Coach tablet interface |
| `server/routes/clientTabletRoutes.ts` | Client-side tablet view |
| `server/routes/mealBoards.ts` | Meal board management |
| `server/routes/proWeekBoard.ts` | Weekly board coach control |
| `server/services/procareActivation.ts` | Enrollment and activation |

---

## What Makes This Unique

1. **Same-system integration** — most professional nutrition tools are separate products from the consumer app. In MPM, coach actions modify the same data that generates the user's next meal.
2. **Clinical-grade override authority** — physicians can assign protocols that cannot be overridden by users or coaches, flowing directly into AI generation constraints
3. **Board control model** — explicit lock/unlock board control is a novel UX pattern for professional nutrition platforms
4. **Behavioral data sharing** — coaches see the same behavioral summaries that the system generates internally, creating a shared language between the AI and the human professional
5. **Payment-gated enrollment** — ProCare has zero pathway from interest to access without payment verification, ensuring the professional tier is commercially protected

---

## Integration

- **Reads from**: BMAS (behavioral summaries), BIGRG (biomarker data), Auth
- **Writes to**: UP-FEM (protocol overrides), AHCS (hub activations), notification systems
- **Enables**: Oncology Support Protocol physician assignments (System 12)
- **Supported by**: Signature Kitchen system (System 10) for chef-linked studios
