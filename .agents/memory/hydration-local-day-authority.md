---
name: Hydration local-day authority
description: Defines the calendar-day boundary used by hydration totals and downstream hydration consumers.
---

All MPM “today” features, including Hydration, must use the subject account’s canonical IANA timezone, with UTC fallback only when the stored timezone is absent or invalid. Boundaries must be computed as local calendar midnights, not fixed 24-hour UTC windows.

**Why:** Intake can be backdated, users cross UTC midnight at different local times, and DST creates 23- and 25-hour calendar days. Device timezone can represent temporary travel, so silently allowing it to override the profile makes daily features disagree and can move historical events between days.

**How to apply:** The device timezone may initialize an absent profile timezone, but a mismatch requires explicit confirmation before updating it. Delegated views resolve the subject’s profile timezone. Preserve both the absolute timestamp and original event-local date/timezone on new event models; leave unverifiable legacy context null rather than backfilling it.