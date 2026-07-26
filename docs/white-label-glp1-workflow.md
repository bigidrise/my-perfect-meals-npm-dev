# White-Label Clinical Workflow: Patient, AI & Provider Interaction

**Platform:** My Perfect Meals  
**Document Type:** Enterprise / Clinic Onboarding Reference  
**Audience:** Clinical directors, physician partners, enterprise integration teams  
**Status:** Active — Pre-Tuesday review draft  
**Last Updated:** 2025-07-26

---

## Overview

My Perfect Meals provides GLP-1 clinics and metabolic medicine practices with a nutrition intelligence layer that operates between the patient's self-reported daily experience and the clinical team's oversight — without replacing any aspect of clinical care.

This document explains exactly how the three principals in the system interact:

- **The Patient** — self-reports daily experience and interacts with intelligent nutrition features
- **The AI** — translates daily state + clinical parameters into personalized food guidance
- **The Provider** (physician, RD, PA, NP) — sets clinical parameters, monitors patient trends, adjusts care

---

## The Three Principals

### The Patient

The patient's role is self-reporting and engagement. They interact with the platform in two ways:

**1. One-time clinical profile (configured by provider)**
- Medication name and current dose
- Treatment phase (intro, maintenance, muscle preservation)
- Protein floor, fat ceiling, calorie targets, hydration goal
- Ingredient restrictions (allergies, intolerances, medical blocks)

**2. Daily self-reporting**
- *How are you feeling today?* — multi-symptom check-in with severity
  - Nausea, constipation, bloating, low appetite, reflux, hydration difficulty, vomiting
- Water intake throughout the day (logged progressively)
- Behavioral check-in via Coach's Corner (energy, mood, stress, cravings)
- Workout/activity completion (optional)

The patient does not need to understand clinical nutrition. They answer simple questions about how they feel, and the platform does the rest.

---

### The AI

The AI's role is translating today's patient state into appropriate food guidance — consistently, across all features, without the patient needing to explain themselves repeatedly.

**What the AI reads:**
- The patient's clinical profile (provider-configured parameters)
- Today's reported symptoms and severity
- Today's water intake progress vs. goal
- Today's behavioral state (energy, mood, cravings from Coach's Corner)
- The resolved guidance flags from the clinical rules engine

**What the AI does with that information:**
- Adjusts meal suggestions across all food-facing features (Meal Builders, Grocery Coach, Beverage Creator, Restaurant Guide, Smart Scan, Snack Creator)
- Coaches the patient through Coach's Corner using full daily context, not just one piece of it
- Surfaces escalation messages when vomiting or significant dehydration difficulty is reported
- Tags each recommendation with the reasoning behind it (for provider transparency)

**What the AI does NOT do:**
- Diagnose symptoms or attribute them to specific causes
- Make treatment decisions
- Override clinical parameters set by the provider
- Claim to replace physician or dietitian guidance
- Use hardcoded numerical thresholds without a clinical source (see Governance Document)

---

### The Provider

The provider's role is configuration, monitoring, and intervention.

**Configuration (one-time setup per patient):**
The provider sets the patient's clinical parameters in the platform:
- Treatment phase
- Protein floor (g/meal)
- Fat ceiling (g/meal)
- Hydration goal (mL/day)
- Calorie target range
- Any ingredient-level restrictions beyond the platform baseline

These parameters are respected by every AI feature the patient touches. The provider owns the clinical numbers; the platform enforces them.

**Monitoring (ongoing):**
The provider sees a daily status card for each active patient:
- Today's reported symptoms + severity + time of report
- Water progress (current vs. goal, %)
- Behavioral check-in summary (energy, mood, stress — when logged)
- Whether an escalation message was displayed and why
- 30-day symptom trend (which symptoms appeared, on which days, at what severity)

The provider reviews this without the patient needing to call or message. The data is always current.

**Intervention:**
When the provider identifies a pattern — recurring nausea, persistent hydration difficulty, consistent low energy — they can:
- Adjust clinical parameters in the platform (tighter fat ceiling, higher protein floor, different hydration goal)
- Reach out to the patient directly through the platform's messaging tools
- Escalate to in-office evaluation

The platform prompts the patient to contact their provider when vomiting or significant hydration difficulty is reported. The provider receives the same signal in the dashboard.

---

## The Flow — A Typical Day

```
7:00 AM — Patient opens the app

  → Platform shows the Daily Tolerance card:
    "How are you feeling today?"

  → Patient selects: Mild nausea + Low appetite
    Saves.

  → Platform internally builds Today's Behavioral State:
    { glp1Tolerance: { nausea: "mild", lowAppetite: "mild" },
      waterProgress: 0%,
      coachCheckin: null (not yet submitted) }

  → Resolver runs:
    { favorSmallerPortions: true,
      favorLowerFat: true,
      favorNeutralFlavors: true,
      hydrationPriority: "high",
      proteinPriority: "high",
      fiberStrategy: "maintain",
      escalationRequired: false,
      activeRuleIds: ["glp1_smaller_portions", "glp1_lower_fat",
                      "glp1_neutral_flavors_nausea", "glp1_hydration_emphasis"] }

9:30 AM — Patient opens GLP-1 Builder

  → Protocol Envelope already carries Today's Behavioral State
  → AI receives prompt guidance: "User has reported mild nausea and low appetite
    today. Favor smaller, gentle meals. Lower fat is especially important.
    Neutral flavors. High protein priority. Avoid strong smells."
  → Patient gets a personalized suggestion — they did not re-enter anything.

12:00 PM — Patient opens Grocery Coach

  → Same state. Grocery Coach knows: mild nausea, hydration not yet started.
  → Grocery Coach recommends broth-based soups, cucumber, electrolyte drinks,
    watermelon, high-protein soft foods.
  → Patient did not explain any of this.

2:00 PM — Patient logs water: 400 mL

  → Water progress: 400 / 2500 mL (16%)
  → State updates. Beverage Creator now flags: "significantly behind on hydration"
  → Beverage Creator naturally surfaces hydration-first suggestions.

4:00 PM — Patient opens Coach's Corner

  → Coach's Corner reads: mild nausea, low appetite, 16% hydration.
  → Without asking, Coach says: "You've had mild nausea today and you're
    well below your hydration goal. Let's focus on gentle, hydrating choices
    for the rest of the day."

6:30 PM — Provider opens dashboard

  → Sees: Mild nausea ✓ Low appetite ✓ | Water 16% | No escalation triggered
  → Reviews 30-day trend: nausea appears 4× this week
  → Provider adjusts fat ceiling from 15g to 10g for next 2 weeks
  → No phone call required.
```

---

## What the Clinic Configures vs. What MPM Provides

| Capability | MPM Provides | Clinic Configures |
|---|---|---|
| Recognized GLP-1 symptoms | ✅ All common adverse reactions per FDA labeling | Cannot be changed |
| Escalation trigger logic | ✅ Vomiting and dehydration difficulty | Clinic can add custom escalation thresholds |
| Escalation message wording | ✅ Clinically reviewed default | Clinic may customize to their care model |
| Baseline guidance direction | ✅ Lower fat, smaller portions, protein priority, hydration | Cannot be weakened by clinic |
| Clinical parameter values | Conservative defaults | ✅ Clinic sets per patient |
| Source documentation | ✅ Publicly accessible in-app | Not configurable |
| Provider dashboard | ✅ Standard layout | ✅ Clinic branding |
| Patient-facing branding | ✅ MPM default | ✅ White-label available |
| Symptom check-in cadence | Daily prompt | Clinic can adjust reminder frequency |

---

## What This Platform Is Not

My Perfect Meals is a nutrition intelligence platform. It is not:

- An EHR or clinical record system
- A medical device (it does not diagnose or treat)
- A replacement for physician, dietitian, or clinical care
- A telemonitoring or RPM platform (it does not alert providers in real time)
- A medication management system

Every patient-facing surface carries appropriate disclaimers. The platform always recommends working with the care team, and immediately defers to the care team when safety signals are present.

---

## Evidence Basis

The baseline AI guidance is built on publicly available clinical sources:

| Source | Evidence Type | Covers |
|---|---|---|
| FDA Semaglutide (Ozempic/Wegovy) Prescribing Information, 2025 | FDA Label | Recognized adverse effects, dehydration risk, escalation basis |
| FDA Tirzepatide (Mounjaro/Zepbound) Prescribing Information, 2025 | FDA Label | Same — GIP/GLP-1 dual agonist users |
| GI Adverse Event Consensus — Gut/PubMed 2023 (PMID 36614945) | Peer-Reviewed Consensus | Smaller meals, lower fat, neutral flavors, protein priority |
| NIDDK Gastroparesis Guidance | Institutional | Gastric emptying delay, raw food tolerance |
| Academy of Nutrition and Dietetics | Professional Guidelines | Fiber + hydration pairing, protein during appetite suppression |
| American Gastroenterological Association | Professional Guidelines | Reflux and diarrhea dietary management |

The full source registry is maintained in `server/services/glp1/ruleRegistry.ts` and is displayed to users in the Medical Sources section of the app.

---

## Demonstration Path for Clinic Meetings

For a 15-minute walkthrough with a clinical team:

1. Open the branded patient experience
2. Show the Metabolic Medication Hub — explain the provider-configured parameters
3. Tap "How are you feeling today?" — select nausea and low appetite
4. Open the GLP-1 Builder — show that the guidance has adapted without the patient re-explaining
5. Open Grocery Coach — same state, different feature, same intelligence
6. Open Smart Scan — scan a product, show personalized assessment including today's reported state
7. Open Beverage Creator — show hydration-first suggestions when water is behind
8. Open the Physician Dashboard — show the provider sees nausea, low appetite, and water progress without a phone call
9. Adjust a clinical parameter (tighten the fat ceiling) — show that the next meal suggestion adapts
10. Walk through the Medical Sources section — show every baseline recommendation has a source

---

## Questions from Clinical Partners

**Q: Can a physician override the escalation trigger?**  
A: The escalation trigger for vomiting cannot be disabled. The message wording can be customized. A clinic can add additional escalation conditions but cannot remove the baseline ones, which are FDA-label based.

**Q: Can we use our own clinical protocols instead of the MPM baseline?**  
A: Yes. Provider-configured parameters (protein floor, fat ceiling, calorie targets, hydration goal, ingredient restrictions) replace the conservative defaults. The directional baseline rules (lower fat, protein priority, smaller portions) remain active as a safety floor, but all specific numerical targets come from the clinic.

**Q: Where is the patient data stored?**  
A: In the platform's HIPAA-aligned database (PostgreSQL via encrypted connection). See the platform's BAA and data handling documentation for clinic integration requirements.

**Q: What happens to a patient without a connected provider?**  
A: They receive the MPM baseline guidance — conservative directional adjustments based on their self-reported symptoms and water intake. No specific clinical targets are applied. The escalation message still fires for vomiting or significant hydration difficulty.

**Q: Can we see the rules the AI is applying?**  
A: Yes. Each recommendation output carries `activeRuleIds[]` that map to the Rule Registry. Providers can request a full governance report showing which rules applied to which recommendations, and each rule's clinical source. This is available on request.
