---
name: Hydration local-day authority
description: Defines the calendar-day boundary used by hydration totals and downstream hydration consumers.
---

Hydration “today” and rolling-day windows must use the subject account’s IANA timezone, with UTC fallback only when the stored timezone is absent or invalid. Boundaries must be computed as local calendar midnights, not fixed 24-hour UTC windows.

**Why:** Intake can be backdated, users cross UTC midnight at different local times, and DST creates 23- and 25-hour calendar days. Mixing UTC dates, database current dates, and browser grouping causes hydration totals to disagree across surfaces.

**How to apply:** Reuse the shared hydration day resolver for Hydration Center, GLP-1 hydration evidence, and coaching hydration queries. Keep intake timestamps authoritative and never reinterpret row creation time as the intake’s calendar day.