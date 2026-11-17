import { useEffect, useState } from "react";

/** Local to the portaled Coach: dvh alone does not follow an iOS keyboard. */
export function useGroceryCoachViewport(open: boolean) {
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    const update = () => setViewport({
      height: visual?.height ?? window.innerHeight,
      top: visual?.offsetTop ?? 0,
    });
    update();
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Fixed-body locking also prevents Safari rubber-banding the page behind
    // the portal. Restore exact inline values and the original scroll position.
    const body = document.body;
    const previous = {
      position: body.style.position, top: body.style.top,
      width: body.style.width, overflow: body.style.overflow,
    };
    const scrollY = window.scrollY;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      Object.assign(body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  return viewport;
}
