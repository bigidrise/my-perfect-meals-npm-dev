---
name: Client messaging product boundary
description: Dashboard messaging visibility for accounts without a Studio.
---

Someone who does not have a Studio account should have only Client Messages, not a Provider Messages button.

**Why:** The user explicitly stated this expected client-side behavior while reporting a received video that appeared only as “Video message.”

**How to apply:** Keep client message access independent of owning a Studio. Do not interpret professional-role metadata alone as proof that the account owns or can enter a Studio.

Personal Space has one Client Messages entry that opens the conversation directly, including professional messages and supported media. Accounts with both Personal and Studio access keep professional tools in their independently authorized Studio context, not in a second Personal inbox.

**Why:** The user approved correcting the messaging defects in Development and explicitly said clients must not need a Studio account to receive a physician's or trainer's video.

**How to apply:** Reuse existing messaging and protected media APIs. Preserve relationships, organization isolation, consent, and message/attachment records. Verification uses isolated fixtures because Neon is shared; Development approval does not authorize Production publication or changes to the Physician Studio restoration.
