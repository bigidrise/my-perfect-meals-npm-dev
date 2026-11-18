import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { useConsumerNotice } from "@/i18n/ConsumerNotice";
import { useHydrationInterventionDisplay } from "@/i18n/useHydrationInterventionDisplay";
import {
  createHydrationHandoff,
  recordHydrationInterventionEvent,
  type HydrationCenterState,
  type HydrationPreferences,
} from "@/lib/hydrationApi";

type Intervention = NonNullable<HydrationCenterState["interventions"]>[number];

export default function HydrationInterventionCards({
  options, preferences, barrierLabel, navigate, reload,
}: {
  options: Intervention[];
  preferences: HydrationPreferences;
  barrierLabel: (code: Intervention["barrierCode"]) => string;
  navigate: (path: string) => void;
  reload: () => Promise<void>;
}) {
  const { t } = useConsumerCopy();
  const notice = useConsumerNotice();
  const display = useHydrationInterventionDisplay();
  const { toast } = useToast();
  // The ref closes the interval before React renders the disabled buttons.
  const actionInFlight = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; error: boolean; text: React.ReactNode } | null>(null);

  const chooseIntervention = async (option: Intervention) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setPendingId(option.id);
    setFeedback(null);
    const createsBeverage = option.destinationType === "beverage_creator";
    try {
      await recordHydrationInterventionEvent(option.id, "accepted");
      if (createsBeverage) {
        await recordHydrationInterventionEvent(option.id, "opened", { destination: "beverage_creator" });
        const handoff = await createHydrationHandoff({
          door: "everyday",
          description: [
            `Practical Hydration support for barrier: ${option.barrierCode}`,
            `Flavor preference: ${preferences.flavor || "no preference"}`,
            option.description,
          ].join(". "),
        });
        if (!handoff.token) throw new Error("The Hydration handoff was unavailable.");
        navigate(`/lifestyle/beverage-creator?${new URLSearchParams({ hydrationHandoff: handoff.token })}`);
      } else {
        // Choosing to try is not evidence that the strategy was completed.
        setFeedback({ id: option.id, error: false, text: notice("Saved as something to try.") });
        toast({ title: notice("Saved as something to try"), description: notice("Come back to My Perfect Hydration Center and tell us what worked.") });
        await reload();
      }
    } catch (error) {
      const title = createsBeverage ? "Could not open Beverage Creator" : "Could not save this strategy";
      const source = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : null;
      const detail = source === "The Hydration handoff was unavailable."
        ? notice("The Hydration handoff was unavailable.")
        : source ?? notice("Please try again.");
      setFeedback({ id: option.id, error: true, text: <>{notice(title)}. {detail}</> });
      toast({ title: notice(title), description: detail, variant: "destructive" });
    } finally {
      actionInFlight.current = false;
      setPendingId(null);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {options.length ? options.map((option) => (
        <div key={option.id} className="rounded-xl border border-white/30 bg-white/[.04] p-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="outline" className="mb-2 border-white/30 text-[10px] text-white">{barrierLabel(option.barrierCode)}</Badge>
              <h3 className="text-sm font-semibold text-white">{display(option).title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white">{display(option).description}</p>
            </div>
            <Button
              size="sm"
              disabled={pendingId !== null}
              aria-busy={pendingId === option.id}
              onClick={() => void chooseIntervention(option)}
              className="shrink-0 bg-white/10 text-white hover:bg-white/20"
            >
              {pendingId === option.id
                ? option.destinationType === "beverage_creator" ? t("Opening…") : t("Saving…")
                : option.destinationType === "beverage_creator" ? t("Create") : t("Try it")}
            </Button>
          </div>
          {feedback?.id === option.id && (
            <p role={feedback.error ? "alert" : "status"} className={`mt-3 text-sm ${feedback.error ? "text-rose-200" : "text-sky-200"}`}>
              {feedback.text}
            </p>
          )}
        </div>
      )) : (
        <div className="rounded-xl border border-dashed border-slate-300/45 bg-slate-400/15 p-6 text-center text-sm text-slate-200">
          {t("Save a barrier, then ask for practical options.")}
        </div>
      )}
    </div>
  );
}
