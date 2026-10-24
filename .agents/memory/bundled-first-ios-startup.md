---
name: Bundled-first iOS startup
description: The approved mobile startup architecture and its native-auth transition constraint.
---

The production iOS shell must start from Capacitor-packaged web assets rather than a remote `server.url`. Keep a native splash auto-hide deadline as a safety net, while allowing JavaScript to hide it sooner during healthy boot.

**Why:** A remote initial document makes app startup depend on DNS, network availability, server health, cache state, and JavaScript download before the interface can render. A native splash must never wait indefinitely for JavaScript.

**How to apply:** Keep API access explicit through the centralized native API resolver, and ensure relative API calls from `capacitor://localhost` are routed to that API rather than the local WebView origin. Before a rollout that moves an existing remote-startup app to bundled-first, test one-time authentication behavior on a physical device: browser local storage is origin-scoped and old cached auth state may not transfer.

The user has observed that publishing Production has historically updated what they see in the installed iPhone app. Do not infer the installed binary's startup mode from the current repository configuration alone: older native configurations loaded the Production website directly, whereas the current source packages web assets. A home-screen web installation is another possible explanation; the installed build's distribution metadata is needed to distinguish them without asking the user to test the phone.

**Why:** The user's observation is evidence about their actual installed app, while a checked-in Capacitor config describes only builds made from that config.

**How to apply:** Separate remotely updated server responses from packaged client JavaScript. Investigate which build the user actually installed before requiring a native release or promising that a web publish updates its UI; keep Production publishing and device testing behind their separate approvals.

The user identified the installed app and matching App Store Connect release as version **1.0.150**. Treat this as user-confirmed release identity, not independent verification of its packaging. Do not use the older checked-in project version as a proxy or ask the user to repeat the phone lookup.

**Why:** The user's goal is Flare-generated meal photographs in the existing iPhone app with the fewest possible changes, preferably through compatible backend responses rather than another native build.

**How to apply:** Seek the matching release archive or effective build configuration and client bundle. Absolute HTTPS photograph URLs are a backend-only candidate, not confirmed compatibility for that release until its actual client is identified.

Keep absolute photograph URLs as a transport concern, not a new stored identity. A client returning one of our exact transport URLs must reach the existing canonical-object authority/save path, not external-image ingestion.

**Why:** A backend-only compatibility fix must not cause a saved photograph to be downloaded and re-uploaded as a different object simply because its delivery URL gained an HTTPS origin. The user explicitly requires existing cache identity and saved-photo associations to survive.

**How to apply:** Keep canonical storage references relative, bind transport URLs to the exact environment-owned origin and bucket, and test round trips with mocked storage/database calls. Development compatibility preparation does not authorize activation or Production rollout.

The user has stopped additional image-system development. The sole approved objective is replacing retired `gpt-image-1` with the tested Flare model while preserving existing My Perfect Meals behavior. Do not expand database, storage, synchronization, iOS or application architecture work. Leave the three preliminary cache-isolation edits untouched: do not commit, revert or expand them without approval.

**Why:** The user explicitly narrowed the scope after the compatibility investigation grew beyond the model replacement.

**How to apply:** Distinguish a minimal model/request compatibility patch from optional reliability, diagnostics and URL changes. Further implementation, generation, restarts, publishing, deployment and GitHub pushes require new approval.

The existing Flare implementation supports the user's manual Development meal-card image test; applying the isolated pre-replacement model-only patch is not a prerequisite.

**Why:** The user confirmed that images worked after the approved graceful Development restart with the existing shared-cache protection, without applying that patch.

**How to apply:** Preserve the working Development implementation. This confirmation establishes the manual Development path only; it does not authorize further changes or establish Production or installed-iOS compatibility.