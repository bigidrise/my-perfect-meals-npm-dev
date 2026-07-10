---
name: Router lazy routes need a Suspense boundary
description: Why clicking a lazy-loaded route can trigger the global error boundary instead of navigating
---

`client/src/components/Router.tsx` defines most routes as `lazy(() => import(...))`. The `<Switch>` of routes must be wrapped in a React `<Suspense>` boundary (with a fallback), or navigating into a route whose JS chunk hasn't been loaded yet in the browser throws:

`Error: A component suspended while responding to synchronous input. This will cause the UI to be replaced with a loading indicator. To fix, updates that suspend should be wrapped with startTransition.`

This gets caught by the app's error boundary and surfaces as a generic "Something went wrong" screen — with no indication the destination route itself is fine. It reproduces on the *first* click into any lazy route in a fresh session/browser (before Vite/webpack has cached that chunk), so it can look like a specific feature is broken when the real cause is a routing infrastructure gap.

**Why:** wouter's `setLocation()` triggers a synchronous state update; React 18 requires either a Suspense boundary or `startTransition` to handle a component suspending during that update, otherwise it throws instead of silently showing a fallback.

**How to apply:** if a user reports "clicking X gives 'something went wrong'" but the route/component clearly exists in code, check browser console for this exact suspense error before assuming a logic bug in the destination page. Keep the `<Suspense>` wrapper around the route `<Switch>` in `Router.tsx` — don't remove it when adding new lazy routes.
