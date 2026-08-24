---
name: Zod strict-null contract checks
description: Required Zod object fields need strict null checking for accurate inferred output types.
---

Zod v3’s object-output inference depends on `strictNullChecks`. A project typecheck that disables it can infer every object property as optional, even when the runtime Zod object requires those fields, making direct schema-to-contract assertions falsely fail.

**Why:** A hydration intake schema correctly required its amount, unit, timestamp, timezone, beverage class, and idempotency key at runtime, but the relaxed server TypeScript project reported those keys as optional.

**How to apply:** Do not weaken the runtime schema or make contract fields optional to appease this false positive. Keep legacy broad typechecks stable, and validate affected schema/contract boundaries through a small focused strict TypeScript project that is included in the pre-push validator.