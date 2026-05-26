# System 06: Biometric Intelligence & Glucose-Responsive Generation (BIGRG)

**Classification:** Clinical Data Integration — Real-Time Adaptive Intelligence
**Status:** Active, Production

---

## Purpose

BIGRG is the system that ingests, processes, and acts on real-time health data to change what the AI generates. It closes the loop between what is happening inside a user's body right now and the food recommendations they receive.

This is the system that makes the difference between:

> "Here is a diabetic-friendly meal" (static, profile-based)

and:

> "Your glucose is currently elevated. Here is a meal specifically designed to support recovery without spiking further." (dynamic, real-time)

---

## Biomarker Data Types

| Data Type | Collection Method | Use in Generation |
|---|---|---|
| Blood glucose readings | Manual log, CGM integration | Real-time carb ceiling, GI cap |
| GLP-1 injection log | Manual log (dose + timing) | Portion scaling, nausea avoidance |
| Body composition | Manual entry (weight, body fat%) | Caloric and macro target calibration |
| Waist circumference | Manual entry | Metabolic risk scoring |
| Clinical lab values | Manual entry / physician upload | Hub activation triggers |
| BMI (calculated) | Derived from weight + height | Target adjustment |

---

## How It Works

### Glucose State Classification
At generation time, BIGRG queries the most recent glucose log (within 4-hour window) and classifies the user's current state:

```
Glucose < 80 mg/dL   →  "LOW"      →  Fast carb inclusion, no high-protein only
Glucose 80–140 mg/dL →  "IN_RANGE" →  Standard protocol
Glucose > 140 mg/dL  →  "ELEVATED" →  Hard carb ceiling, fiber floor, no added sugar
No recent reading    →  "UNKNOWN"  →  Diabetic-safe defaults
```

### GLP-1 Injection Awareness
When a GLP-1 injection is logged (with timestamp), BIGRG calculates time-since-injection and adjusts:
- **Within 2 hours of injection**: Maximum nausea avoidance mode — small portions, bland textures, no strong odors flagged
- **2–8 hours post-injection**: Moderate adjustment
- **8+ hours**: Standard GLP-1 protocol

### Body Composition Integration
Weight, body fat percentage, and waist circumference are used to:
- Calculate TDEE (Total Daily Energy Expenditure) for caloric targets
- Compute Waist Risk Score (`server/services/waistRisk.ts`) — a proprietary metabolic risk indicator
- Calibrate protein targets based on lean body mass (not total weight)

### Clinical Lab Integration
Lab values (A1C, cholesterol, inflammatory markers) trigger hub activations when they cross clinical thresholds. A new A1C result above 6.5% can automatically activate the Diabetic Hub for subsequent generation.

---

## Architecture

```
Biomarker Input Sources
    ├── Manual glucose log
    ├── GLP-1 injection log
    ├── Body composition entry
    └── Clinical lab upload
         │
         ▼
BIGRG Processing Layer
    ├── Glucose State Classifier
    ├── GLP-1 Timing Calculator
    ├── TDEE / Lean Mass Calculator
    ├── Waist Risk Scorer
    └── Lab Threshold Evaluator
         │
         ▼
    Output Objects
    ├── GlucoseState → AHCS (System 2)
    ├── GLP1TimingState → AHCS GLP-1 Hub
    ├── TargetMacros → UP-FEM (System 1)
    └── WaistRiskScore → Dashboard, ProCare
```

---

## Key Files

| File | Role |
|---|---|
| `server/routes/biometricsRoutes.ts` | Biomarker data ingestion API |
| `server/db/schema/glucoseLogs.ts` | Glucose log schema |
| `server/db/schema/glp1Shots.ts` | GLP-1 injection schema |
| `server/db/schema/clinicalLabs.ts` | Lab value schema |
| `server/services/waistRisk.ts` | Waist risk scoring model |
| `client/src/pages/my-biometrics.tsx` | User biometric input UI |
| `client/src/pages/GLP1MealsTracking.tsx` | GLP-1 specific tracking interface |

---

## What Makes This Unique

1. **Meal generation changes based on today's glucose reading** — not just the diabetic profile set at onboarding
2. **GLP-1 injection timing awareness** — the system knows whether a user is in the 2-hour post-injection window and adjusts meal character accordingly (portion size, texture, intensity)
3. **Lean body mass protein targeting** — protein targets are calculated from lean mass, not total weight — a clinical standard that consumer apps typically do not implement
4. **Waist Risk Score** — a proprietary metabolic risk composite that combines waist circumference, BMI, and lab values into a single coaching signal
5. **Lab-triggered hub activation** — lab results can automatically activate new clinical hubs without requiring manual re-onboarding

---

## Integration

- **Feeds**: AHCS (System 2) — primary biomarker consumer
- **Feeds**: UP-FEM (System 1) — caloric and macro target adjustments
- **Feeds**: ProCare portal (System 5) — coach-visible biometric trends
- **Reads from**: User-entered data via biometrics routes and dedicated tracking pages
