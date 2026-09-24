---
name: PostgreSQL parameter gaps in mocked persistence tests
description: Avoid unused leading SQL parameters when changing insert queries into updates.
---

Parameterized PostgreSQL statements must not pass unused leading placeholders merely to reuse an insert's argument array. An update that starts at a later placeholder may pass a simple mock but fail on the live driver with an undetermined parameter type.

**Why:** A personal support preference could be inserted, but the subsequent off/on update returned an error because the query supplied unused parameters before its first referenced placeholder. Mocked persistence tests accepted the argument array and missed the live failure.

**How to apply:** Give each SQL statement a contiguous parameter sequence and have persistence mocks assert argument shape. For critical write paths, use a read-only EXPLAIN to catch query planning errors without changing records.