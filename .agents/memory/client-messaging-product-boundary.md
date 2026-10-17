---
name: Client messaging product boundary
description: Dashboard messaging visibility for accounts without a Studio.
---

Personal Space should have one Messages entry for receiving and replying to the user's own provider, not separate Client Messages and Provider Messages buttons.

**Why:** The user's latest clarification names the single Personal Dashboard button Messages, with text, voice, and video supported on both sides.

**How to apply:** Keep client message access independent of owning a Studio. Do not interpret professional-role metadata alone as proof that the account owns or can enter a Studio.

Personal Space has one conversation entry that opens messages directly, including professional messages and supported media. Accounts with both Personal and Studio access keep professional sending and receiving inside Studio; their Personal inbox is only for conversations where they are the client.

**Why:** The user approved correcting the messaging defects in Development and explicitly said clients must not need a Studio account to receive a physician's or trainer's video.

**How to apply:** Reuse existing messaging and protected media APIs. Preserve relationships, organization isolation, consent, and message/attachment records. Verification uses isolated fixtures because Neon is shared; Development approval does not authorize Production publication or changes to the Physician Studio restoration.

Development messaging repair is authorized using the existing full conversation, with the redundant Personal card hidden rather than deleting its implementation. Production activation remains a separate release decision.

**Why:** After accepting the diagnosis, the user approved a narrowly scoped Development repair, synthetic verification, consistent authorization, and draft-preserving retries, but explicitly prohibited Production publication.

**How to apply:** Keep the two message directions separate and reuse existing interfaces. Do not change shared patient records or permissions for verification, remove the legacy implementation, or enable the correction in published builds without separate approval.

For the sidebar notification correction, find and repair the existing indicator system; do not add replacement navigation or a second notification system.

**Why:** The user corrected the implementation direction: “It already worked. The system is already there. You need to find what was already there. You don't need to add anything. It's just not working.”

**How to apply:** Trace the existing indicator, unread request, account eligibility, and workspace visibility before proposing changes. Preserve the working messaging correction.
