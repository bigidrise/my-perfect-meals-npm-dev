// Dismiss: localStorage  mpm.dismiss.patternAlert.<alertType>
// TTL:     high=12h · medium=24h · low=48h
// Voice:   supportive / observant / human — never punitive
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Sparkles } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { usePatternAlerts, dismissAlert } from "@/hooks/usePatternAlerts";
import {
  PATTERN_ALERT_MESSAGES,
  type PatternAlertType,
} from "@/lib/patternAlertMessages";

export function PatternAlertBanner() {
  const { alerts } = usePatternAlerts();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback((alertType: string) => {
    dismissAlert(alertType);
    setDismissed((prev) => new Set(prev).add(alertType));
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.type));

  if (visible.length === 0) return null;

  // Show the highest-priority alert only
  const alert = visible[0];
  const msg = PATTERN_ALERT_MESSAGES[alert.type as PatternAlertType];
  if (!msg) return null;

  return (
    <div
      className="rounded-xl border border-orange-700/30 bg-orange-950/40 px-4 py-3.5 flex gap-3 items-start"
      data-testid={`pattern-alert-${alert.type}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <Sparkles className="w-4 h-4 text-orange-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug">
          {msg.headline}
        </p>
        <p className="text-xs text-white/65 mt-1 leading-relaxed">{msg.body}</p>
        <div className="mt-2.5">
          <PillButton
            active
            variant="amber"
            onClick={() => {
              handleDismiss(alert.type);
              setLocation(msg.ctaRoute);
            }}
          >
            {msg.cta}
          </PillButton>
        </div>
      </div>

      <button
        onClick={() => handleDismiss(alert.type)}
        className="flex-shrink-0 p-1 rounded-md bg-white/5 text-white/40 active:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
