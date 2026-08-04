/**
 * My Perfect Beginning — Parent's Corner page wrapper
 *
 * Reads the active child from the hub's session storage and passes it as
 * childContext into ParentsCorner so the AI knows who it's advising.
 * Falls back gracefully to an empty profile if no child is selected.
 */

import { Suspense, useMemo } from "react";
import { useLocation } from "wouter";
import ParentsCorner from "@/components/my-perfect-beginning/ParentsCorner";

// ── Keys must match MyPerfectBeginningPage.tsx ────────────────────────────────

const SESSION_KEY = "mpb.activeChild.v1";
const SESSION_CHILDREN_KEY = "mpb.children.v1";

// ── Minimal shape read from sessionStorage ────────────────────────────────────

interface StoredChild {
  id: string;
  nickname: string;
  age: number; // years (approximate)
  stage: string;
  emoji?: string;
}

function readActiveChild(): StoredChild | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CHILDREN_KEY);
    const activeId = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const children: StoredChild[] = JSON.parse(raw);
    if (!children.length) return null;
    const found = activeId ? children.find((c) => c.id === activeId) : null;
    return found ?? children[0];
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyPerfectBeginningParentsCornerPage() {
  const [, setLocation] = useLocation();

  // Read once on mount — sessionStorage is synchronous so no async needed.
  const childContext = useMemo(() => {
    const child = readActiveChild();
    if (!child) return undefined;
    return {
      nickname: child.nickname,
      developmentalStage: child.stage,
      // Hub stores age in whole years; convert to approximate months for the AI.
      currentAgeMonths: Math.round(child.age * 12),
    };
  }, []);

  function handleBack() {
    setLocation("/lifestyle/my-perfect-beginning");
  }

  return (
    <Suspense fallback={null}>
      <ParentsCorner childContext={childContext} onBack={handleBack} />
    </Suspense>
  );
}
