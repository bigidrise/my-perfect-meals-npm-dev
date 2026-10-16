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

The current sidebar investigation concerns only the existing Pro Portal indicator. Leave the working Client Messages experience alone; do not add Personal notification navigation.

**Why:** The user clarified: “Don't worry about the client messages those are already working. The only indicator light that is not working is the left side bar pro portal.”

**How to apply:** Trace the existing professional sidebar unread path and keep the two message directions separate. Earlier discussion of a Personal sidebar extension does not authorize that work after this clarification.

For the sidebar notification correction, find and repair the existing indicator system; do not add replacement navigation or a second notification system.

**Why:** The user corrected the implementation direction: “It already worked. The system is already there. You need to find what was already there. You don't need to add anything. It's just not working.”

**How to apply:** Trace the existing indicator, unread request, account eligibility, and workspace visibility before proposing changes. Preserve the working messaging correction.
