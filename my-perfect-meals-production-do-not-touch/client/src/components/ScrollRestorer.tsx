import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Remembers scroll positions per path and restores them on navigation.
 * - First visit: top
 * - Back/forward: restore previous scroll
 * - One-time force-top via sessionStorage.setItem(`forceTop:<path>`, "1")
 * If the app scrolls in a container, pass a CSS selector via props.
 */
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
    if (prev) savePos(prev);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => restorePos(location));
    });

    prevLocationRef.current = location;
  }, [location]);

  // On first mount (hard refresh)
  useEffect(() => {
    if (location) {
      requestAnimationFrame(() => restorePos(location));
    }
  }, []);

  return null;
}