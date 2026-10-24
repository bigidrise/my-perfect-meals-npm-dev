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

Model lifecycle evidence is advisory, not authority to switch models or activate scheduled monitoring and notifications. Paid comparison tests and runtime restarts require their own approval.

**Why:** The user explicitly separated approval for the image reliability foundation from approval for provider/model selection, paid generation, monitoring activation, and release operations.

**How to apply:** Implementing provider-independent contracts and safeguards must not select a replacement, enable another provider, or repair saved photographs as a side effect. Keep spending reservations distinct from a guaranteed provider billing cap, and never report an abort request as confirmed provider cancellation.

An explicitly approved provisional primary does not authorize automatic failover to a tested alternative.

**Why:** The user accepted the controlled comparison and selected its provisional primary while explicitly keeping automatic alternative switching unauthorized.

**How to apply:** Obtain separate approval for failover, even when the alternative has already passed a paid comparison. Source preparation, paid execution, runtime activation, monitoring/alerts, native release and Production release remain distinct approvals.

Controlled Development activation is not authorization to generate a new live photograph.

**Why:** The user explicitly approved Development Flare activation while forbidding paid generation, saved-meal/storage modifications, recovery, Production changes, publishing, native builds, automatic failover and monitoring scheduler activation.

**How to apply:** An enabled Development image gate does not authorize an agent-initiated paid request. Stop after activation verification and obtain separate approval before generating a new live meal photograph.

Controlled end-to-end image tests require isolated disposable records, isolated image storage, and enforcement of the exact authorized number of provider calls.

**Why:** The user required the normal snack workflow with a synthetic Development identity, at most one initial image generation and its normal verification, and no fidelity regeneration. They explicitly required stopping before generation if normal writes could not be isolated from Production-visible records.

**How to apply:** A synthetic identity alone is not an isolation boundary for shared image caches or canonical storage. Verify those write paths and the server's retry policy before creating test records or dispatching paid calls. Do not substitute a direct provider test for the required normal application workflow.

Bind controlled image-test scope before all authenticated downstream work, not only at the explicit image endpoint.

**Why:** Normal food creation can launch inline image generation or asynchronous prewarm before the client requests its image. Endpoint-only scoping would leave those provider calls and shared writes outside the authorized limit.

**How to apply:** Preserve normal authentication first, bind only the operator-selected synthetic account, and propagate scope through asynchronous work. Source preparation does not authorize setting its diagnostic flags, restarting, creating the identity or spending.
