---
name: Bundled-first iOS startup
description: The approved mobile startup architecture and its native-auth transition constraint.
---

The production iOS shell must start from Capacitor-packaged web assets rather than a remote `server.url`. Keep a native splash auto-hide deadline as a safety net, while allowing JavaScript to hide it sooner during healthy boot.

**Why:** A remote initial document makes app startup depend on DNS, network availability, server health, cache state, and JavaScript download before the interface can render. A native splash must never wait indefinitely for JavaScript.

**How to apply:** Keep API access explicit through the centralized native API resolver, and ensure relative API calls from `capacitor://localhost` are routed to that API rather than the local WebView origin. Before a rollout that moves an existing remote-startup app to bundled-first, test one-time authentication behavior on a physical device: browser local storage is origin-scoped and old cached auth state may not transfer.

Do not assume the native API origin must equal the primary web domain. An intentionally configured, verified alias can serve the same Production application directly.

**Why:** A release review found a stale test insisting on the primary web domain while the preserved native resolver, its companion test, and the actual deployed JavaScript all intentionally used a verified alias. Both domains served the same release without redirects; changing routing merely to satisfy that test would have changed the established contract.

**How to apply:** Establish primary/alias status from deployment metadata, compare read-only release responses, and inspect the deployed resolver before correcting conflicting tests. Preserve routing when that evidence agrees; stop for owner disposition when it does not.

For native regressions, establish the installed binary's packaged web version
before attributing behavior to current source or a web release. A retained local
native bundle is evidence about that artifact, not the founder's installed app.

**Why:** Reminder restoration existed in current source but was absent from an
older retained native bundle. Source-level tests alone could not establish what
code the phone was running or whether iOS had pending notification requests.

**How to apply:** Compare the installed build, plugin availability, permission
and pending OS state before declaring a native delivery fix shipped or working.
Do not substitute a web publication or a copied bundle for device evidence.

Keep the Dashboard web release and native reminder restoration as separate
workstreams. Verify the installed iOS build before seeking authorization for
a native rebuild; the packaged reminder-JavaScript constraint is not a claim
that every web feature update requires a new native binary.

**Why:** The founder approved the Dashboard correction direction but explicitly
withheld native rebuild approval until installed-device evidence establishes
the notification failure.

**How to apply:** Finish signed-in or real-device Dashboard verification before
promotion. Gather native reminder evidence read-only and obtain separate
authorization for native builds or schedule-changing tests.