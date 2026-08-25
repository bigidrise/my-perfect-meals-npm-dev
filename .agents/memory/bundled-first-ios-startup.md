---
name: Bundled-first iOS startup
description: The approved mobile startup architecture and its native-auth transition constraint.
---

The production iOS shell must start from Capacitor-packaged web assets rather than a remote `server.url`. Keep a native splash auto-hide deadline as a safety net, while allowing JavaScript to hide it sooner during healthy boot.

**Why:** A remote initial document makes app startup depend on DNS, network availability, server health, cache state, and JavaScript download before the interface can render. A native splash must never wait indefinitely for JavaScript.

**How to apply:** Keep API access explicit through the centralized native API resolver, and ensure relative API calls from `capacitor://localhost` are routed to that API rather than the local WebView origin. Before a rollout that moves an existing remote-startup app to bundled-first, test one-time authentication behavior on a physical device: browser local storage is origin-scoped and old cached auth state may not transfer.