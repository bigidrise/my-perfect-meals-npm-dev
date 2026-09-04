import * as Sentry from "@sentry/react";
import { scrubSentryBreadcrumb, scrubSentryData, scrubSentryEvent } from "@shared/sentryScrubber";

let initialized = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    console.log("[Sentry] VITE_SENTRY_DSN not set — frontend error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0.0,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Replay only captures sessions with errors, not all sessions
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Only record replays when an error occurs
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    // Filter noisy / unactionable errors
    ignoreErrors: [
      "WebSocket closed without opened",
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /Loading chunk \d+ failed/,
      /Loading CSS chunk \d+ failed/,
    ],
    beforeSend(event) {
      // Don't send events in development
      if (import.meta.env.DEV) return null;
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb);
    },
  });

  initialized = true;
  console.log(`[Sentry] ✅ Initialized — env: ${import.meta.env.MODE}`);
}

export function setUserContext(userId: string, email: string): void {
  if (!initialized) return;
  // Signature remains stable while identity collection is disabled.
  void userId;
  void email;
  Sentry.setUser(null);
}

export function clearUserContext(): void {
  if (!initialized) return;
  Sentry.setUser(null);
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      const scrubbed = scrubSentryData(context) as Record<string, unknown>;
      Object.entries(scrubbed).forEach(([key, val]) => scope.setExtra(key, val));
    }
    Sentry.captureException(err);
  });
}

export { Sentry };
