---
name: Unread notification verification
description: Verify incoming media counts before folder reads, and distinguish backend coverage from mocked indicator behavior.
---

Capture unread counts before opening a Studio client folder. A count observed after folder access does not establish what the notification endpoint returned beforehand.

**Why:** Opening a folder advances shared read state; later zero counts cannot reconstruct the initial failure.

**How to apply:** Order the accepted incoming event, unread response, and first folder request using runtime evidence. Never advance read markers merely to test an indicator.

Verify each media type through its actual server counting path, not only through a hook fixture returning a positive number.

**Why:** Labeling the same mocked positive-count test as text, voice, and video gave false confidence while a real video reply produced zero from the server. Delivery and email success do not prove unread counting.

**How to apply:** Distinguish verified server results from UI fixture results. Do not attribute a current failure to the latest change unless history and pre-read evidence support that conclusion.

Incoming Studio videos are expected to notify the professional by email as well as through the existing sidebar and Pro Portal indicators, just as text messages do.

**Why:** The user explicitly reported that successful video delivery without either the email or existing indicators is not acceptable.

**How to apply:** Check email dispatch separately from push delivery and unread counting. A notification helper's name does not establish that it sends email.
