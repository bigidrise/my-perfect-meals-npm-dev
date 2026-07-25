---
name: Feature Impact System
description: Mandatory 12-area Feature Completion Report required before every non-trivial feature ships. Skill file tells agent when and how to emit the report.
---

# Feature Impact System

## The rule
Before marking any feature complete, emit a Feature Completion Report covering 12 areas.
Read `.local/skills/feature-impact/SKILL.md` for the exact format.

## When it applies
- Any new user-facing screen, builder, or workflow
- Any change to AI prompt, recommendation logic, or access control
- Any change to ProCare, studio, or clinical workflows
- Any new route or middleware
- Any change touching more than 2 files

## When it does NOT apply
- Typo / copy fixes
- Pure CSS tweaks with no behavioral change
- Dependency bumps
- Crash fixes with no change to what the user sees

## The 12 areas
1. Backend / Core Logic
2. Chef Copilot Knowledge
3. App Library
4. Academy Review (Platform Mastery / Professional Academy / Business Academy)
5. Certification Review
6. Pro Tips
7. What's New / Release Notes
8. Sources Review
9. White Label Review
10. Marketing Review
11. AI Training Review
12. Testing Review (all affected subscription tiers)

## Status key
- ✅ Complete — done in this session
- ⚠️ Action required — needs follow-up before this feature ships
- ❌ Not applicable — confirmed no impact

**Why:** The platform is large enough that no single agent session can hold all the systems
in context. Without a structured checklist, Copilot knowledge, Academy lessons, certification
questions, and Sources pages fall out of sync with the product — silently. The report makes
the gap visible before the feature ships, not after.

**How to apply:** At the end of every qualifying feature, before the final user-facing response,
emit the completed 12-row table. Deferred ⚠️ items must be named explicitly.
