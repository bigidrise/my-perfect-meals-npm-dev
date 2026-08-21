/**
 * ModalBoundsTestPage — DEV-ONLY responsive regression harness
 *
 * Renders real app modal/dialog components in open state so Playwright can
 * measure their actual Tailwind-rendered bounds at each viewport. This is NOT
 * a fabricated HTML fixture — the components imported here are the same files
 * that ship in production, so any CSS regression (removed max-width, negative
 * margin, flex restructuring) will cause real layout changes that the tests catch.
 *
 * This module is statically imported in Router.tsx (not lazy-loaded) so it is
 * already in the main bundle when Playwright navigates to /test-modal-bounds.
 * There is no Vite cold-compile or HMR cycle to wait for, which is what was
 * causing waitForSelector to time out.
 *
 * InspirationCaptureModal is lazy-loaded within this page (below) so its heavy
 * dependency graph is NOT pulled into the main production bundle.
 *
 * URL: /test-modal-bounds?variant=<name>
 *
 * Variants:
 *   (default)   — UniversalDialog, standard content, close button + CTA
 *   tall        — UniversalDialog, 30-line body (tests max-height + scroll)
 *   inspiration — InspirationCaptureModal (the reference incident component)
 *
 * This route is only registered in development (see Router.tsx) and should
 * never appear in a production build.
 */

import { lazy, Suspense } from "react";
import { UniversalDialog } from "@/components/ui/universal-modal";

// Lazy-import InspirationCaptureModal so its large module graph stays out of
// the main bundle.  It is only loaded when variant=inspiration is requested,
// which only happens in Playwright tests — never in a production context.
const LazyInspirationCaptureModal = lazy(
  () => import("@/components/InspirationCaptureModal")
);

export default function ModalBoundsTestPage() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const variant = new URLSearchParams(search).get("variant") ?? "universal-dialog";

  // open={true} is passed as a literal — no useState — so the dialog can never
  // be dismissed by Radix focus management or onOpenChange calls during tests.
  // At desktop viewport, Radix's focus-trap can call onOpenChange(false) if a
  // sidebar nav element gets focus; a constant true prevents that from closing
  // the dialog and causing waitForSelector to time out.
  const noop = () => {};

  if (variant === "inspiration") {
    return (
      <div className="min-h-screen bg-gray-900" data-testid="modal-test-page">
        {/*
          InspirationCaptureModal: the reference incident component.
          Renders UniversalDialog → DialogContent → Radix [role="dialog"],
          with the real Tailwind max-width, positioning, and overflow styles.
          A CSS regression that broke the August 2026 incident (negative margin,
          removed max-width) will produce a real layout change here.

          The Suspense fallback is null because the Playwright test waits for
          [role="dialog"][data-state="open"] — if the modal hasn't loaded yet,
          the selector simply isn't found yet and the test waits.
        */}
        <Suspense fallback={null}>
          <LazyInspirationCaptureModal
            open={true}
            onOpenChange={noop}
            destination="recipe"
          />
        </Suspense>
      </div>
    );
  }

  const tall = variant === "tall";

  return (
    <div className="min-h-screen bg-gray-900" data-testid="modal-test-page">
      {/*
        UniversalDialog renders DialogContent which renders Radix [role="dialog"].
        The Tailwind classes on DialogContent (max-w-md, w-[calc(100vw-2rem)],
        max-h-[90vh], overflow-hidden) determine viewport overflow behaviour.
        These are tested here with the REAL component, not fabricated CSS.
      */}
      <UniversalDialog
        open={true}
        onOpenChange={noop}
        title="Modal Bounds Test"
      >
        {tall ? (
          <div data-testid="tall-body">
            {Array.from({ length: 30 }, (_, i) => (
              <p key={i} className="text-sm text-gray-700 my-2">
                Scroll content line {i + 1}: testing max-height constraint and
                overflow-y:auto behaviour when content is taller than 90% of the
                viewport.
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            Modal body content — viewport bounds test.
          </p>
        )}
        <button
          className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          data-testid="primary-cta"
        >
          Continue
        </button>
      </UniversalDialog>
    </div>
  );
}
