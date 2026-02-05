import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChefVoice } from "@/lib/useChefVoice";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Scale,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
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

interface BodyCompositionSectionProps {
  builderType?: string;
}

export default function BodyCompositionSection({
  builderType,
}: BodyCompositionSectionProps) {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [latestEntry, setLatestEntry] = useState<BodyFatEntry | null>(null);
  const [latestSource, setLatestSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasSpokenRef = useRef(false);
  const { speak, stop, preload } = useChefVoice();

  const user = getCurrentUser();
  const userId = user?.id;

  const BODY_COMP_EXPLANATION = `Your body composition affects how we calculate your starchy carb allocation. If you're above your goal body fat, we reduce starchy carbs to help you lean out. When you reach your goal, we can add them back.`;

  useEffect(() => {
    preload?.();
  }, [preload]);

  useEffect(() => {
    if (userId) {
      loadLatest();
    } else {
      setIsLoading(false);
    }
  }, [userId]);

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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      speak(BODY_COMP_EXPLANATION);
    }
  };

  const goToBiometrics = () => {
    stop();
    setLocation("/biometrics/body-composition");
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case "trainer":
        return "Trainer";
      case "physician":
        return "Physician";
      default:
        return "Self-Reported";
    }
  };

  const hasOverride = latestSource === "trainer" || latestSource === "physician";
  const hasData = !!latestEntry;

  const isRelevantBuilder =
    builderType === "beach_body" ||
    builderType === "performance_competition" ||
    !builderType;

  if (!isRelevantBuilder) {
    return null;
  }

  return (
    <Card className="bg-zinc-900/80 border border-white/30 text-white mt-5">
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-5 cursor-pointer hover:bg-white/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Scale className="h-5 w-5 text-blue-400" />
                  Body Composition
                  {hasData && (
                    <span className="text-xs bg-black/60 text-blue-200 px-2 py-0.5 rounded-full ml-2">
                      {latestEntry.currentBodyFatPct}% BF
                    </span>
                  )}
                  {hasOverride && (
                    <span className="text-xs bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded-full">
                      {sourceLabel(latestSource!)}
                    </span>
                  )}
                </h3>
                {!isOpen && (
                  <span className="text-sm text-blue-300/80 ml-7 mt-1">
                    {hasData
                      ? "Tap to view how this affects your carbs"
                      : "Tap to add your body fat %"}
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-white/60" />
              ) : (
                <ChevronDown className="h-5 w-5 text-white/60" />
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-5 pb-5 space-y-4">
            {isLoading ? (
              <div className="text-white/60 text-sm py-4">Loading...</div>
            ) : hasData ? (
              <>
                <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl font-bold text-white">
                      {latestEntry.currentBodyFatPct}%
                    </div>
                    <div className="text-right text-sm text-white/70">
                      <div>{latestEntry.scanMethod}</div>
                      <div>
                        {new Date(latestEntry.recordedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {latestEntry.goalBodyFatPct && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white/60">Goal:</span>
                      <span className="text-green-400 font-medium">
                        {latestEntry.goalBodyFatPct}%
                      </span>
                    </div>
                  )}

                  {hasOverride && (
                    <div className="mt-3 p-2 bg-amber-900/30 rounded border border-amber-400/30 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-200">
                        Set by your {latestSource}. This value takes precedence
                        for meal planning.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-200/90">
                      <p className="mb-2">
                        <strong>How this affects your meals:</strong>
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>
                          Above goal by 5%+: Fewer starchy carb options to help
                          you lean out
                        </li>
                        <li>Within 3% of goal: Standard starchy carb allocation</li>
                        <li>
                          Below goal: Additional carbs for performance (if
                          applicable)
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={goToBiometrics}
                  variant="outline"
                  className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Update Body Composition
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 bg-black/40 rounded-lg border border-white/10 text-center">
                  <Scale className="h-10 w-10 text-white/30 mx-auto mb-3" />
                  <p className="text-white/70 text-sm mb-2">
                    No body composition data yet
                  </p>
                  <p className="text-white/50 text-xs">
                    Add your body fat % to get personalized starchy carb
                    recommendations
                  </p>
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-200/90">
                      Body composition helps us tailor your starchy carb
                      allocation. You can get this from DEXA scans, BodPod,
                      calipers, or smart scales.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={goToBiometrics}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Add Body Composition
                </Button>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
