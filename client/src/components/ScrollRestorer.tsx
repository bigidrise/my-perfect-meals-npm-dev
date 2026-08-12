import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Remembers scroll positions per path and restores them on navigation.
 * - First visit: top
 * - Back/forward: restore previous scroll
 * - One-time force-top via sessionStorage.setItem(`forceTop:<path>`, "1")
 * If the app scrolls in a container, pass a CSS selector via props.
 *
 * HUB_PATHS — hub landing pages always open at the top. ScrollManager already
 * calls forceScrollToTop on every route, but its RAF fires before this
 * restorer's double-RAF, so the restorer was winning and putting users
 * back mid-page. For hub paths we skip both saving and restoring scroll so
 * ScrollManager's top-of-page call is never overridden.
 *
 * Rules for adding paths here:
 *   ✓ Add: hub landing pages that show a list of features/tools
 *   ✗ Skip: conversational pages (Coach's Corner, Chef's Kitchen, creators),
 *     sub-pages, form pages, and any page where retained scroll is intentional.
 */
const HUB_PATHS = new Set([
  "/lifestyle",
  "/lifestyle/pairings-hub",
  "/lifestyle/beverage-hub",
  "/craving-creator-landing",
  "/social-hub",
  "/performance",
  "/kitchens",
  "/tutorials",
  "/companion",
  "/companion/dogs",
  "/companion/cats",
  "/diabetic-hub",
  "/glp1-hub",
  "/supplement-hub",
  "/learning",
  "/business-center/partners",
  "/business-center/academy",
  "/business-center/promotions",
  "/creator-studio",
]);

export default function ScrollRestorer({ selector }: { selector?: string }) {
  const [location] = useLocation();
  const prevLocationRef = useRef<string | null>(null);

  const getTarget = () => {
    if (selector) {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) return el;
    }
    return document.scrollingElement || document.documentElement;
  };

  const savePos = (path: string | null) => {
    if (!path) return;
    const target = getTarget();
    const top = target instanceof HTMLElement ? target.scrollTop : window.scrollY;
    sessionStorage.setItem(`scroll:${path}`, String(top));
  };

  const scrollTo = (top: number) => {
    const target = getTarget();
    if (target instanceof HTMLElement) {
      target.scrollTo({ top, behavior: "auto" });
    } else {
      window.scrollTo({ top, behavior: "auto" });
    }
  };

  const restorePos = (path: string) => {
    const forceKey = `forceTop:${path}`;
    if (sessionStorage.getItem(forceKey) === "1") {
      sessionStorage.removeItem(forceKey);
      scrollTo(0);
      return;
    }
    const raw = sessionStorage.getItem(`scroll:${path}`);
    if (!raw) {
      scrollTo(0);
      return;
    }
    const stored = parseInt(raw, 10);
    scrollTo(Number.isFinite(stored) ? stored : 0);
  };

  // Use manual restoration so the browser doesn't fight us
  useEffect(() => {
    if ("scrollRestoration" in history) {
      const h = history as History & { scrollRestoration?: "auto" | "manual" };
      const prev = h.scrollRestoration;
      h.scrollRestoration = "manual";
      return () => { h.scrollRestoration = prev ?? "auto"; };
    }
  }, []);

  // On route change: save previous, then restore new
  useEffect(() => {
    const prev = prevLocationRef.current;
    // Never save scroll for hub landings — they always open at the top
    if (prev && !HUB_PATHS.has(prev)) savePos(prev);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (HUB_PATHS.has(location)) {
          scrollTo(0);
        } else {
          restorePos(location);
        }
      });
    });

    prevLocationRef.current = location;
  }, [location]);

  // On first mount (hard refresh)
  useEffect(() => {
    if (location) {
      requestAnimationFrame(() => {
        if (HUB_PATHS.has(location)) {
          scrollTo(0);
        } else {
          restorePos(location);
        }
      });
    }
  }, []);

  return null;
}