---
name: Saved-image viewing safety
description: Viewing saved meals must not authorize generation or persistent image repair.
---

Favorites and other saved-meal viewing operations must be non-destructive. Image-loading failures must not automatically initiate AI generation, image replacement, cache invalidation, recovery jobs, or saved-meal/media mutations. Display-only retries and suggestions of existing stored variants are allowed.

**Why:** The user explicitly required this boundary after automatic recovery replaced surviving original photographs with generic fallback illustrations.

**How to apply:** Keep browser image-error handlers and delivery diagnostics read-only. Future repair needs a separately approved server-controlled operation, authoritative absence checks that distinguish storage uncertainty, and independently verified replacement bytes. Do not globally resume historical image-recovery jobs on startup. Restart, release, storage copying, and restoration require separate approval.

Read-only safety activation does not certify new image generation. Model-catalog availability also does not prove that an image-generation request will succeed.

**Why:** A real image request rejected a model that the same provider's model catalog still listed; the application returned a generic illustration and logged it as ready. Separately, saved-photo delivery encountered storage permission errors. These are distinct failure paths, not evidence that recovery safeguards disabled image generation.

**How to apply:** Distinguish generation failure, storage delivery failure, and controlled saved-image repair. Report unexercised generation explicitly under no-generation approval; never infer generation readiness from health, model listings, or a fallback URL. Obtain explicit approval before a diagnostic generation attempt under that restriction.

When an image model is listed but generation rejects it, check the provider's dated shutdown schedule before attributing the failure to account access or changing SDK configuration.

**Why:** An explicitly approved isolated request reproduced the model rejection on October 23, 2026; OpenAI's official deprecation schedule listed that exact date as the shutdown of `gpt-image-1`, despite catalog and API-reference listings still naming it.

**How to apply:** Compare runtime evidence with the current official deprecation schedule at https://developers.openai.com/api/docs/deprecations. Catalog visibility is not availability. A replacement model still requires approval and recipe-fidelity, response-format, and storage compatibility verification; retirement does not authorize saved-image regeneration.
