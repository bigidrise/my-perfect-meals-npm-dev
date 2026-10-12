/**
 * Guidance yields to existing interactions. This is not a second modal system:
 * it only observes blockers and withdraws guidance, never closes their UI.
 * Native/headless integrations can opt into a lease without changing their UI.
 */
const leases = new Set<object>();
const listeners = new Set<() => void>();
const pausedAccounts = new Set<string>();

export function pauseGuidanceForSession(accountId: string) { pausedAccounts.add(accountId); }
export function resumeGuidanceForSession(accountId: string) { pausedAccounts.delete(accountId); }
export function guidancePausedForSession(accountId: string) { return pausedAccounts.has(accountId); }

export function acquireGuidanceInteractionBlock() {
  const lease = {};
  leases.add(lease);
  listeners.forEach(listener => listener());
  return () => {
    leases.delete(lease);
    listeners.forEach(listener => listener());
  };
}

function displayed(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute("hidden")) return false;
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style?.display === "none" || style?.visibility === "hidden") return false;
  }
  return element.isConnected;
}

export function guidanceInteractionBlocked(doc: Document = document): boolean {
  if (leases.size || doc.visibilityState === "hidden") return true;
  const own = Array.from(doc.querySelectorAll('[role="dialog"]'))
    .find(node => node.querySelector("[data-guided-journey-explanation]"));
  const candidates = doc.querySelectorAll(
    '[role="dialog"],[role="alertdialog"],[aria-modal="true"],dialog[open],'
    + '[data-testid="welcome-gate"],[data-guidance-blocker],'
    + '[class*="fixed"][class*="inset-0"],'
    + 'button[aria-label*="stop recording" i],button[title*="stop recording" i],'
    + 'button[title*="stop listening" i],[data-testid*="stop-recording"],[data-testid="stop-video-recording"]',
  );
  for (const candidate of candidates) {
    if (!displayed(candidate) || candidate === own || own?.contains(candidate)) continue;
    // The shared Radix overlay is the sibling immediately before our content.
    if (own && candidate.nextElementSibling === own && candidate.getAttribute("data-state") === "open") continue;
    if (candidate.matches('[class*="fixed"][class*="inset-0"]')
      && !candidate.matches('[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-guidance-blocker],[data-testid="welcome-gate"]')) {
      const styleZ = Number.parseInt(doc.defaultView?.getComputedStyle(candidate).zIndex ?? "", 10);
      const classZ = (candidate.getAttribute("class") ?? "").match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/);
      if (!(styleZ >= 40 || Number(classZ?.[1] ?? classZ?.[2]) >= 40)) continue;
    }
    return true;
  }
  for (const button of Array.from(doc.querySelectorAll("button"))) {
    if (!own?.contains(button) && displayed(button)
      && /^stop\s+(?:(?:voice|video|audio)\s+)?(?:recording|listening)$/i.test(button.textContent?.trim() ?? "")) return true;
  }
  for (const media of Array.from(doc.querySelectorAll<HTMLMediaElement>("video,audio"))) {
    const stream = media.srcObject;
    if (displayed(media) && stream && "getTracks" in stream
      && stream.getTracks().some(track => track.readyState === "live")) return true;
  }
  return false;
}

/** Observe before opening and while open; no pending request is auto-launched. */
export function observeGuidanceInteractions(onBlock: () => void, doc: Document = document) {
  const inspect = () => { if (guidanceInteractionBlocked(doc)) onBlock(); };
  const observer = new MutationObserver(inspect);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true });
  listeners.add(inspect);
  doc.addEventListener("visibilitychange", inspect);
  inspect();
  return () => {
    observer.disconnect();
    listeners.delete(inspect);
    doc.removeEventListener("visibilitychange", inspect);
  };
}
