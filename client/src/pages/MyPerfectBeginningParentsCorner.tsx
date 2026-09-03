/**
 * My Perfect Beginning — Parent's Corner page wrapper
 *
 * Reads the active child ID from localStorage, fetches the full child profile
 * from the API, and passes the complete context to ParentsCorner so the AI
 * knows the child's allergies, conditions, feeding challenges, and stage.
 *
 * Falls back gracefully to an empty profile if no child is selected or if
 * the fetch fails.
 */

import { Suspense, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import ParentsCorner from "@/components/my-perfect-beginning/ParentsCorner";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/apiRequest";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useIsDesktop } from "@/hooks/useIsDesktop";

// ── Key must match MyPerfectBeginningPage.tsx ─────────────────────────────────

const LS_ACTIVE_CHILD_KEY = "mpb.activeChildId.v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbChild {
  id: string;
  name: string;
  age_stage: string;
  emoji: string;
  date_of_birth?: string | null;
  allergies?: any[];
  dietary_preferences?: string[];
  medical_conditions?: string[];
  feeding_concerns?: string[];
  sensory_issues?: string[];
  dislikes?: string[];
  cultural_preferences?: string | null;
}

function deriveAgeMonths(child: DbChild): number | undefined {
  if (child.date_of_birth) {
    const dob = new Date(child.date_of_birth);
    if (!isNaN(dob.getTime())) {
      const now = new Date();
      const months =
        (now.getFullYear() - dob.getFullYear()) * 12 +
        (now.getMonth() - dob.getMonth());
      return Math.max(0, months);
    }
  }
  // Derive approximate age from stage as fallback
  const stageAgeMap: Record<string, number> = {
    early_infant: 3,
    beginning_foods: 8,
    young_toddler: 18,
    toddler: 30,
    preschool: 54,
    early_school_age: 84,
    growing_child: 120,
  };
  return stageAgeMap[child.age_stage];
}

function buildChildContext(child: DbChild | null) {
  if (!child) return undefined;

  const allergies = child.allergies ?? [];
  const allergyProfile = allergies.length > 0
    ? { entries: allergies }
    : undefined;

  const diagnosedConditions = child.medical_conditions?.length
    ? child.medical_conditions
    : undefined;

  const feedingConcerns = child.feeding_concerns ?? [];
  const sensoryIssues = child.sensory_issues ?? [];
  const dislikes = child.dislikes ?? [];

  const eatingBehavior =
    feedingConcerns.length > 0 || sensoryIssues.length > 0 || dislikes.length > 0
      ? {
          sensorySensitivities: sensoryIssues.length > 0,
          foodsRefused: dislikes.slice(0, 5),
          parentsBiggestFeedingChallenge: feedingConcerns[0] ?? undefined,
        }
      : undefined;

  const householdDiet = child.dietary_preferences?.length
    ? { dietaryPattern: child.dietary_preferences[0] }
    : undefined;

  return {
    id: child.id,
    nickname: child.name,
    developmentalStage: child.age_stage,
    currentAgeMonths: deriveAgeMonths(child),
    allergyProfile,
    diagnosedConditions,
    eatingBehavior,
    householdDiet,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyPerfectBeginningParentsCornerPage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle("Parent's Corner");
  const [activeChild, setActiveChild] = useState<DbChild | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const activeId = (() => {
          try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY); } catch { return null; }
        })();

        const data = await apiRequest(apiUrl("/api/my-perfect-beginning/children"));
        const children: DbChild[] = data.children ?? [];

        const found = activeId ? children.find(c => c.id === activeId) : null;
        setActiveChild(found ?? children[0] ?? null);
      } catch {
        // Silently fall back to no child context
      } finally {
        setLoading(false);
      }
    }

    load();

    // Re-fetch on window focus in case the user switched children on the hub
    const handler = () => load();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);

  function handleBack() {
    setLocation("/lifestyle/my-perfect-beginning");
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" }}
      >
        <div className="w-6 h-6 border-2 border-teal-400/40 border-t-teal-400 rounded-full animate-spin" />
      </div>
    );
  }

  const childContext = buildChildContext(activeChild);

  return (
    <Suspense fallback={null}>
      <ParentsCorner childContext={childContext} onBack={handleBack} />
    </Suspense>
  );
}
