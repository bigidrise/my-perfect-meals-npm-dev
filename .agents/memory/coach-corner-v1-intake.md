---
name: Coach's Corner — Canonical Architecture & V1 Vertical Slice
description: Locked Coach's Corner architecture (Behavioral Variables, Living Behavioral Profile, Four Coaching Intents, Intent-before-Recommendation) and where the V1 vertical slice implementation stands.
---

## Canonical architecture (locked, obtained from user, not in repo as a doc)
Coach's Corner's full spec (Founding Principle, Context Principle, Four Coaching Intents — Reassure/Redirect/Educate/Refer, Intent-before-Recommendation rule, Living Behavioral Profile, Behavioral Playbook, Coaching Philosophy Library, 4 Knowledge Layers) exists only as a spec the user pasted in chat — it is NOT written anywhere in this repo. If asked to audit or extend Coach's Corner again and this file's summary isn't enough, ask the user to re-paste the canonical spec rather than assuming prior session context carries it.

## Key architectural rule
Behavioral variables must each get their own typed column on `coaching_profiles`. Never write new behavioral-variable answers into the legacy `lifestyleFlags`/`biggestChallenges`/`motivations`/`coachingStyle`/`accountabilityPref` columns — those belong to a separate, still-live feature (`server/routes/aceProfiles.ts` + `CoachingProfileSetup.tsx`) and must not be touched by Coach's Corner work. (Supersedes an earlier version of this memory that said to reuse those flat columns — that mapping was a deliberate placeholder before the spec was locked and has since been replaced.)

## V1 vertical slice status
Implemented: dashboard card → welcome → 3-question typed intake (`setbackResponse`, `stressResponse`, `recoveryPreference`, each its own typed column on `coaching_profiles`) → one-time closing screen → returning-user "What's on your mind today?" screen (`CoachCornerHome.tsx`) → one fully-wired situation "My progress has slowed" (`CoachCornerProgressSlowed.tsx` + `server/services/ace/progressSlowedEngine.ts`) implementing Intent-before-Recommendation across Reassure/Educate/Redirect, redirecting into the existing Macro Calculator when appropriate.

Behavioral Context for this one loop is inferred from `users.onboardingCompletedAt` (proxy for plan start) and `biometric_sample` weight history, falling back to a self-reported follow-up question only when weight data doesn't exist. This is scoped to this one loop, not a general Behavioral Context framework.

Still not implemented (intentionally deferred, do not build without explicit new go-ahead): Refer intent, other situations besides progress-slowed, Coaching Philosophy Library, Behavioral Playbook as a derived layer, Protocol Library routing, Smart Coaching integration.

The legacy `aceDecisionEngine.ts` (scores `CoachingIntervention`s from `ace_daily_checkins`) is a different, deprecated system — do not confuse it with the Coach's Corner decision logic in `progressSlowedEngine.ts`.
