import React from "react";
import type { ConciergePresentation } from "@shared/coaching/types";
import { isCoachDestinationId } from "@shared/coaching/navigation";
import CoachFeatureAction from "./CoachFeatureAction";
import ChefResponseAvatar from "./ChefResponseAvatar";
import { chefResponseText } from "./chefResponseText";

interface PlanItem {
  text: string;
  horizon?: string;
  kind?: string;
  dueAt?: string;
  completionSignal?: string;
  featureTarget?: string;
  destinationId?: string;
}

export interface CoachStructuredResponse {
  presentation?: ConciergePresentation;
  meta?: { redFlag?: boolean };
  whatIFound: string;
  whatItCouldMean: string;
  todayPlan: {
    why: string;
    items: Array<PlanItem | string>;
    successMetric: string;
    nextCheckIn: string;
  } | null;
  learningOpportunity: string | null;
}

export function ProfessionalBoundaryNotice() {
  return (
    <p className="text-white/35 text-[11px] leading-snug">
      These are suggestions to help you make an informed choice right now. If you're working with
      a coach, dietitian, or physician, please follow their guidance and check with them about
      concerns or changes to your nutrition or health plan.
    </p>
  );
}

export function isConciergeMessage(structured: CoachStructuredResponse): boolean {
  return structured.presentation?.kind === "concierge" &&
    typeof structured.presentation.message === "string" &&
    structured.presentation.message.trim().length > 0 &&
    !structured.meta?.redFlag &&
    !structured.todayPlan?.items.some(item => typeof item !== "string" && item.kind === "contact_care");
}

/** Explicit presentation, not text heuristics, separates ordinary and coaching UI. */
export default function CoachBubble({
  structured, enableConcierge = false, emphasizeFeatureNames = false, messageId,
}: { structured: CoachStructuredResponse; enableConcierge?: boolean; emphasizeFeatureNames?: boolean; messageId?: string }) {
  const responseText = (text: string) => chefResponseText(text, enableConcierge, emphasizeFeatureNames);
  const compact = enableConcierge && isConciergeMessage(structured);
  const planItems = structured.todayPlan?.items ?? [];
  const planWhy = structured.todayPlan?.why;
  const target = compact ? structured.presentation?.destinationId : undefined;
  const navigation = structured.presentation?.navigation;
  const approvedNavigation = navigation?.state === "navigation_confirmed" || navigation?.state === "direct_navigation";
  const showButton = approvedNavigation && navigation?.destinationId === target &&
    isCoachDestinationId(target) && planItems.some(item =>
    typeof item !== "string" && item.kind === "use_feature" && item.destinationId === target);
  const escalation = planItems.some(item => typeof item !== "string" && item.kind === "contact_care");
  // Historical safety envelopes copied the same guidance into paragraphs and
  // contact_care items. Preserve every distinct instruction, but show it once.
  const safetyTexts = [...new Set([
    structured.whatIFound, structured.whatItCouldMean, planWhy,
    ...planItems.map(item => typeof item === "string" ? item : item.text),
  ].filter((text): text is string => !!text?.trim()).map(text => text.trim()))];
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        <ChefResponseAvatar />
        <div className="bg-zinc-900 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-white/90 leading-relaxed space-y-3">
          {escalation ? <>
            {safetyTexts.map((text, i) =>
              <p key={i} className="whitespace-pre-wrap">{responseText(text)}</p>)}
          </> : compact ? <>
            <p className="whitespace-pre-wrap">{responseText(structured.presentation!.message)}</p>
            {showButton && <CoachFeatureAction destinationId={target}
              creatorRequest={structured.presentation?.creatorRequest} messageId={messageId} />}
          </> : <>
            {[structured.whatIFound, structured.whatItCouldMean].filter(Boolean).map((text, i) =>
              <p key={i}>{responseText(text)}</p>)}
            {(planWhy || planItems.length > 0) && (
              <div className="space-y-2">
                {planWhy && <p>{responseText(planWhy)}</p>}
                {planItems.length > 0 && <ul className="space-y-1.5 mt-1">
                  {planItems.map((item, i) => enableConcierge && typeof item !== "string" &&
                    item.kind === "use_feature" && isCoachDestinationId(item.destinationId) && !escalation &&
                      (!enableConcierge || (approvedNavigation && navigation?.destinationId === item.destinationId))
                    ? <li key={i}><CoachFeatureAction destinationId={item.destinationId} messageId={messageId} /></li>
                    : <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5 shrink-0 select-none">•</span>
                      <span className="min-w-0">{responseText(typeof item === "string" ? item : item.text)}</span>
                    </li>)}
                </ul>}
              </div>
            )}
            {structured.learningOpportunity && <p className="text-white/60 italic text-[13px] border-t border-white/5 pt-3">
              {responseText(structured.learningOpportunity)}
            </p>}
            <div className="border-t border-white/8 pt-3 mt-1"><ProfessionalBoundaryNotice /></div>
          </>}
        </div>
      </div>
    </div>
  );
}
