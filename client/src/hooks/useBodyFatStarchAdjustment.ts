import { useState, useEffect, useMemo } from "react";
import { getCurrentUser } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

interface BodyFatEntry {
  id: number;
  userId: string;
  currentBodyFatPct: string;
  goalBodyFatPct: string | null;
  scanMethod: string;
  source: "client" | "trainer" | "physician";
  createdById: string | null;
  notes: string | null;
  recordedAt: string;
}

interface BodyFatStarchAdjustment {
  slotDelta: number;
  reason: string;
  currentBf: number | null;
  goalBf: number | null;
  source: string | null;
  hasData: boolean;
  isLoading: boolean;
}

export function useBodyFatStarchAdjustment(
  builderType?: string
): BodyFatStarchAdjustment {
  const [latestEntry, setLatestEntry] = useState<BodyFatEntry | null>(null);
  const [latestSource, setLatestSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const user = getCurrentUser();
  const userId = user?.id;

  const isRelevantBuilder =
    builderType === "beach_body" || builderType === "performance_competition";

  useEffect(() => {
    if (userId && isRelevantBuilder) {
      loadLatest();
    } else {
      setIsLoading(false);
    }
  }, [userId, isRelevantBuilder]);

  const loadLatest = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/users/${userId}/body-composition/latest`)
      );
      if (res.ok) {
        const data = await res.json();
        if (data.entry) {
          setLatestEntry(data.entry);
          setLatestSource(data.source);
        }
      }
    } catch (err) {
      console.error("Error loading body composition:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const adjustment = useMemo(() => {
    if (!isRelevantBuilder || !latestEntry) {
      return {
        slotDelta: 0,
        reason: "No body composition data",
        currentBf: null,
        goalBf: null,
        source: null,
        hasData: false,
        isLoading,
      };
    }

    const currentBf = parseFloat(latestEntry.currentBodyFatPct);
    const goalBf = latestEntry.goalBodyFatPct
      ? parseFloat(latestEntry.goalBodyFatPct)
      : null;

    if (!goalBf) {
      return {
        slotDelta: 0,
        reason: "No goal body fat set",
        currentBf,
        goalBf: null,
        source: latestSource,
        hasData: true,
        isLoading,
      };
    }

    const diff = currentBf - goalBf;

    let slotDelta = 0;
    let reason = "";

    if (diff >= 5) {
      slotDelta = -1;
      reason = `Body fat ${currentBf.toFixed(1)}% is 5%+ above goal (${goalBf.toFixed(1)}%) - reducing starchy carbs`;
    } else if (diff <= -3 && builderType === "performance_competition") {
      slotDelta = 1;
      reason = `Body fat ${currentBf.toFixed(1)}% is below goal (${goalBf.toFixed(1)}%) - adding starchy carbs for performance`;
    } else if (Math.abs(diff) <= 3) {
      slotDelta = 0;
      reason = `Body fat ${currentBf.toFixed(1)}% is within target range of goal (${goalBf.toFixed(1)}%)`;
    } else {
      slotDelta = 0;
      reason = `Body fat ${currentBf.toFixed(1)}% is moderately above goal (${goalBf.toFixed(1)}%)`;
    }

    return {
      slotDelta,
      reason,
      currentBf,
      goalBf,
      source: latestSource,
      hasData: true,
      isLoading,
    };
  }, [latestEntry, latestSource, isRelevantBuilder, builderType, isLoading]);

  return adjustment;
}
