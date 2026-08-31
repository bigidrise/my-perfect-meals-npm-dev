import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Droplets,
  HeartPulse,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HYDRATION_HUB_CONSIDERED_FOR_YOU,
  HYDRATION_HUB_MEDICAL_BOUNDARY,
} from "@/lib/hydrationHubContent";

const STEPS = [
  {
    title: "Choose the Hydration door that fits your situation",
    text: "Start with Everyday, Athletic, Sick-Day, or Liquid Nutrition Support. You can return and choose a different door when your needs change.",
  },
  {
    title: "Answer the questions for that door",
    text: "Depending on the door, you may enter preferences and barriers, training context, symptoms and tolerability, or temporary instructions already provided by your care team.",
  },
  {
    title: "Follow the Hydration support shown",
    text: "My Perfect Hydration Center may show practical strategies, organize instructions, offer beverage support, show Considered for you, or send you to a Beverage Creator when appropriate.",
  },
  {
    title: "Log what you drink",
    text: "Use Log a fluid to choose a beverage and tap a quick-add amount, or enter a custom amount in ounces or milliliters. Logging is useful even when you do not have a numeric Hydration target.",
  },
  {
    title: "Review Today and History",
    text: "Today shows what you have logged so far. Descriptive history lets you review previous entries and patterns without turning them into a diagnosis or an invented target.",
  },
  {
    title: "Adjust or revisit the plan",
    text: "Return to My Perfect Hydration Center whenever your situation changes. Current authorized professional guidance may appear here and, when applicable, in your Nutrition Life Plan.",
  },
] as const;

const DOOR_GUIDES = [
  {
    id: "everyday",
    title: "How to use Everyday Hydration",
    icon: Droplets,
    forText: "Choose this for everyday fluid tracking and practical help making hydration easier.",
    enterText:
      "Save any barriers or preferences that apply, such as forgetting, taste, temperature, bubbles, access, timing, bathroom concerns, nutrition conflicts, or low appetite. These are optional.",
    nextText:
      "After saving a barrier, select Get options in Help Me Get It In. You can try a practical strategy, or choose Create when a beverage suggestion connects to Beverage Creator.",
    expectText:
      "Log fluids in the Log a fluid card, then check Today or Descriptive history to see what you recorded.",
  },
  {
    id: "athletic",
    title: "How to use Athletic Hydration",
    icon: Activity,
    forText: "Choose this when you want hydration support organized around training or another activity.",
    enterText:
      "Select before, during, or recovery, then enter the activity, approximate duration if you know it, and environmental context. You can continue to Athletic Beverage Creator when that support is useful.",
    nextText:
      "Your activity context is passed into the Creator so it can keep the request focused and preserve your existing nutrition and safety constraints.",
    expectText:
      "Athletic Hydration provides bounded, practical guidance. It does not automatically prescribe fluid or electrolyte amounts unless a legitimate authorized numeric plan exists.",
  },
  {
    id: "sick-day",
    title: "How to use Sick-Day Hydration",
    icon: HeartPulse,
    forText: "Choose this when you are unwell and need practical support with fluids and tolerability.",
    enterText:
      "Select the symptoms or tolerability concerns that apply. Be as accurate as you can, especially if you are having trouble keeping fluids down.",
    nextText:
      "My Perfect Hydration Center uses what you selected to show practical, low-effort support and safety or escalation guidance when symptoms may need professional attention.",
    expectText:
      "This door does not diagnose you or create medical treatment. Seek medical care when symptoms are serious, worsening, or you cannot safely keep fluids down.",
  },
  {
    id: "liquid-nutrition",
    title: "How to use Liquid Nutrition Support",
    icon: ClipboardList,
    forText: "Choose this only for temporary liquid or fluid instructions already provided by a physician or care team.",
    enterText:
      "Enter the reason and original instruction, then review the dates, instruction type, allowed or restricted categories, texture requirements, and timing when those details were provided.",
    nextText:
      "The instruction stays in review until you confirm what was captured. Verified active instructions can limit Beverage Creator suggestions; missing or conflicting medical details remain withheld for clarification.",
    expectText:
      "MPM organizes the instructions you provide. It does not invent missing medical instructions, choose a protocol, or fill in a cadence or dosing amount.",
  },
] as const;

function GuideRow({
  title,
  text,
  index,
}: {
  title: string;
  text: string;
  index: number;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
        {index + 1}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/75">{text}</p>
      </div>
    </li>
  );
}

export default function HydrationHubGuide() {
  return (
    <Card
      data-testid="hydration-how-to-use"
      className="border-sky-300/20 bg-slate-950/55 text-white shadow-2xl backdrop-blur-xl"
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Start Here: How to Use My Perfect Hydration Center
              </h2>
              <Badge className="border-sky-300/20 bg-sky-400/10 text-sky-100">
                Quick guide
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Follow these steps to know what to click, what to enter, and what
              to expect next.
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-4">
          {STEPS.map((step, index) => (
            <GuideRow
              key={step.title}
              title={step.title}
              text={step.text}
              index={index}
            />
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-white/15 bg-white/[.04] p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <div className="text-xs leading-relaxed text-white/75">
              <p>
                <span className="font-semibold text-white">
                  “Considered for you”
                </span>{" "}
                means MPM checked applicable saved nutrition information,
                preferences, allergies, active programs, restrictions, or
                professional instructions when preparing the support shown.
                Only verified considerations are used.
              </p>
              <p className="mt-2">{HYDRATION_HUB_CONSIDERED_FOR_YOU}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <p className="text-xs leading-relaxed text-white/75">
              {HYDRATION_HUB_MEDICAL_BOUNDARY}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[.18em] text-white/60">
            Door-by-door instructions
          </p>
          {DOOR_GUIDES.map((guide, index) => {
            const Icon = guide.icon;
            return (
              <Collapsible key={guide.id} defaultOpen={index === 0}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-between border-white/15 bg-white/[.04] px-3 py-3 text-left text-white hover:bg-white/[.09] hover:text-white"
                    data-testid={`hydration-guide-${guide.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-sky-200" />
                      <span className="text-sm font-semibold">{guide.title}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/60" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="rounded-b-xl border-x border-b border-white/15 bg-black/15 px-4 pb-4 pt-3">
                  <div className="space-y-3 text-sm leading-relaxed text-white/75">
                    <p>
                      <span className="font-semibold text-white">What it is for: </span>
                      {guide.forText}
                    </p>
                    <p>
                      <span className="font-semibold text-white">What you enter: </span>
                      {guide.enterText}
                    </p>
                    <p>
                      <span className="font-semibold text-white">What happens next: </span>
                      {guide.nextText}
                    </p>
                    <p>
                      <span className="font-semibold text-white">What to expect: </span>
                      {guide.expectText}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}