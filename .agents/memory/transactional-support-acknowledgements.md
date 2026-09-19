---
name: Transactional support acknowledgements
description: Durable acceptance, privacy, identity, and retry rules for user-facing support receipt emails.
---

Bug and feedback reports are accepted only by durable report persistence. Customer acknowledgement delivery is separate, asynchronous, and idempotent on the full authoritative report identity.

**Why:** Email-provider latency or failure must not make a stored report appear unsuccessful, while lease recovery and process restarts must not send duplicate receipt emails.

**How to apply:** Resolve recipient identity server-side, pass only recipient, greeting name, and display ID into the customer template, use a durable one-per-report outbox plus provider idempotency, fence worker updates by claim ownership, and keep diagnostic support mail separate.