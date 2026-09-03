# My Perfect Meals — IP Master Index
**Platform Systems, Adaptive Intelligence Frameworks & Proprietary Architectures**

*Classification: Internal — IP Documentation*
*Last updated: May 2026*

---

## Overview

My Perfect Meals is not a meal planning app. It is a **multi-layer adaptive nutrition operating system** built on top of clinical protocol enforcement, real-time biomarker integration, emotion-aware behavioral intelligence, and a proprietary AI orchestration architecture that no consumer nutrition product has replicated.

This document serves as the master index for all identified proprietary systems. Each system has its own dedicated file containing purpose, architecture, inputs/outputs, differentiators, related files, and integration maps.

---

## System Registry

| # | System Name | Short Description | File |
|---|---|---|---|
| 1 | **Universal Protocol-First Enforcement Model (UP-FEM)** | 4-layer constraint hierarchy that governs all AI generation | [01-UP-FEM.md](./01-UP-FEM.md) |
| 2 | **Adaptive Hub Coupling System (AHCS)** | Modular clinical condition detection and real-time generation override | [02-AHCS.md](./02-AHCS.md) |
| 3 | **Macro Truth Contract (MTC)** | Integrity enforcement layer preventing AI macro fabrication | [03-MTC.md](./03-MTC.md) |
| 4 | **Behavioral Memory & Emotion AI System (BMAS)** | Pattern tracking, emotion-aware coaching, and adaptive behavioral nudging | [04-BMAS.md](./04-BMAS.md) |
| 5 | **ProCare Professional Infrastructure (PPI)** | Full coach-client platform with studio management, care boards, and clinical tools | [05-PPI.md](./05-PPI.md) |
| 6 | **Biometric Intelligence & Glucose-Responsive Generation (BIGRG)** | Real-time biomarker integration that changes AI output based on live health data | [06-BIGRG.md](./06-BIGRG.md) |
| 7 | **Chef Copilot Multi-Modal AI Assistant (CCMAA)** | Page-aware AI assistant with voice, text, and accessibility modes | [07-CCMAA.md](./07-CCMAA.md) |
| 8 | **Smart Ingredient Normalization & Aggregation Engine (SINAE)** | Unit-conversion, deduplication, and pantry-aware shopping list generation | [08-SINAE.md](./08-SINAE.md) |
| 9 | **Starch Game Plan Coaching System (SGPCS)** | Intra-day carbohydrate distribution intelligence and coaching | [09-SGPCS.md](./09-SGPCS.md) |
| 10 | **Signature Kitchen & Creator Studio (SKCS)** | Chef-branded kitchen platform with creator economy infrastructure | [10-SKCS.md](./10-SKCS.md) |
| 11 | **Unified Meal Generation Pipeline (UMGP)** | Orchestration layer routing all meal generation requests across engines | [11-UMGP.md](./11-UMGP.md) |
| 12 | **Oncology Support Protocol (OSP)** | Physician-assigned clinical nutrition layer for oncology patients | [12-OSP.md](./12-OSP.md) |
| 13 | **Restaurant & Social Dining Intelligence (RSDI)** | AI-powered restaurant guidance, social meal navigation, and dining-out protocols | [13-RSDI.md](./13-RSDI.md) |
| 14 | **Beverage Intelligence System (BIS)** | Multi-category beverage generation engine across wellness, performance, and lifestyle | [14-BIS.md](./14-BIS.md) |
| 15 | **Guest Progression & Freemium Gateway (GPFG)** | Adaptive onboarding, guest user journey, and conversion-aware access control | [15-GPFG.md](./15-GPFG.md) |

---

## Platform Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                         │
│   Chef Copilot (7) · Guest Gateway (15) · ProCare Portal (5)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              UNIFIED MEAL GENERATION PIPELINE (11)              │
│   Routes all requests · Selects appropriate engine              │
└──────┬────────────┬─────────────┬──────────────┬───────────────┘
       │            │             │              │
  ┌────▼───┐  ┌────▼───┐  ┌─────▼──┐  ┌────────▼──────┐
  │Creator │  │Fridge  │  │Holiday │  │ Beverage (14) │
  │Builder │  │Rescue  │  │ Feast  │  │               │
  └────────┘  └────────┘  └────────┘  └───────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│           UP-FEM ENFORCEMENT LAYER (1)                          │
│   Medical → Dietary Identity → Cultural → Behavioral            │
└──────┬──────────────┬────────────────────┬──────────────────────┘
       │              │                    │
  ┌────▼────┐   ┌─────▼──────┐   ┌────────▼────────┐
  │  AHCS   │   │   MTC (3)  │   │  BIGRG (6)      │
  │  Hubs   │   │ Macro Guard│   │ Glucose / Labs  │
  │  (2)    │   └────────────┘   └─────────────────┘
  └─────────┘
       │
  ┌────▼─────────────────────────────────────────────────┐
  │          DATA & INTELLIGENCE LAYER                    │
  │  BMAS (4) · SINAE (8) · SGPCS (9) · OSP (12)        │
  └──────────────────────────────────────────────────────┘
```

---

## Cross-System Dependency Map

| System | Depends On | Is Used By |
|---|---|---|
| UP-FEM (1) | User Profile, DB Schema | All generation engines |
| AHCS (2) | UP-FEM, Biomarker DB | UMGP, ProCare |
| MTC (3) | UP-FEM | All generation engines |
| BMAS (4) | User history, Pattern Alerts | Copilot, ProCare |
| PPI (5) | Auth, DB, Notifications | ProCare portal, Studio |
| BIGRG (6) | Glucose logs, Lab values | AHCS, UP-FEM |
| CCMAA (7) | UP-FEM, All pages | User-facing UI |
| SINAE (8) | Meal DB, Ingredient Catalog | Weekly Board, Shopping |
| SGPCS (9) | Meal logs, UP-FEM | UMGP, Daily planning |
| SKCS (10) | Creator DB, UP-FEM | Lifestyle pages |
| UMGP (11) | UP-FEM, AHCS, MTC | All generation endpoints |
| OSP (12) | Medical profile, UP-FEM | AHCS, UMGP |
| RSDI (13) | Restaurant data, UP-FEM | Lifestyle, Social pages |
| BIS (14) | UMGP, UP-FEM | Beverage Creator pages |
| GPFG (15) | Auth, Stripe, Plan features | Onboarding, App shell |

---

## What Makes This a Platform, Not an App

Most nutrition software operates as a static rule engine: if user is diabetic → show diabetic content. MPM's architecture is fundamentally different:

1. **Dynamic protocol stacking** — multiple conditions, preferences, and cultural identities are enforced simultaneously, not serially
2. **Real-time generation override** — live biomarker data (glucose, GLP-1 injections) changes what the AI generates *right now*, not just at profile setup
3. **Integrity contracts** — the Macro Truth Contract ensures the AI cannot fabricate numbers, a problem unsolved by most AI nutrition tools
4. **Clinical-consumer bridge** — ProCare brings physician and coach relationships into the same system that generates the food, with clinical override capability
5. **Modular intelligence expansion** — the Hub architecture allows new clinical conditions to be added as plugins without rewriting core logic

---

*For each system's full documentation, see the numbered files in this directory.*
