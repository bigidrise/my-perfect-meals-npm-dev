import { LanguagePreferenceSelector } from "@/components/profile/LanguagePreferenceSelector";
import { useMemo, useState } from "react";
import "@/styles/entry-readability.css";
import { entryReadabilityClassName } from "@/styles/entryReadabilityGate";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { NarrationBar } from "@/components/NarrationBar";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

const COPILOT_SECTIONS = [
  {
    heading: "A quick intro from Chef",
    text: "Hey, welcome to My Perfect Meals. I'm Chef — your AI nutrition coach in your pocket. I'm here to help guide your food decisions so you can enjoy the meals you love while staying aligned with your goals. Before we get started, take a moment to read the information below. It will explain how the system works and what to expect. When you're ready, continue to onboarding so we can set up your personal nutrition plan.",
  },
];

// Preserve the two approved emphasis spans; never interpret translated HTML.
function renderApprovedEmphasis(text: string) {
  return text.split("**").map((part, index) =>
    index % 2 ? <span key={index} className="font-semibold text-white">{part}</span> : part,
  );
}

export default function ConsumerWelcome() {
  const { t, i18n } = useConsumerCopy();
  const [, setLocation] = useLocation();
  const [hasReadExplanation, setHasReadExplanation] = useState(false);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false);
  const narrationSections = useMemo(() => COPILOT_SECTIONS.map(section => ({
    heading: t(section.heading),
    text: t(section.text),
  })), [t]);
  const narrationControls = useMemo(() => Object.fromEntries(
    ["Listen", "Pause", "Resume", "Play", "10s Back", "Next", "Start Over", "Hide", "Transcript", "Stop"]
      .map(label => [label, t(label)]),
  ), [t]);

  return (
    <div className={`min-h-screen bg-black text-white flex flex-col ${entryReadabilityClassName}`}>
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="pt-10 pb-2" />

        <div className="mb-5">
          <LanguagePreferenceSelector />
        </div>

        <div className="flex flex-col items-center mb-4 -mt-2">
          <img
            src="/assets/WelcomeChef2026.png"
            alt="Chef"
            className="w-[26rem] h-auto -mb-3"
          />
          <h1 className="text-2xl font-bold italic mt-0">
              {t("Welcome to My Perfect Meals")}
          </h1>
          <p className="text-white/60 text-sm leading-relaxed text-center mt-1 max-w-xs">
              {t("Meals built around your goals, your preferences, and your life.")}
          </p>
        </div>

        <div className="mb-6 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-900/50 to-amber-900/50 border border-orange-400/20">
          <p className="text-xs text-white/50 mb-2">
              {t("Hear a quick intro from Chef — your AI nutrition coach")}
          </p>
          <NarrationBar
            key={i18n.resolvedLanguage || i18n.language}
            sections={narrationSections}
            controlLabels={narrationControls}
            speedOverride="1.0"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 mb-6">
          <h2 className="text-lg font-bold text-white mb-3">
                {t("How My Perfect Meals Works")}
          </h2>
          <div className="space-y-3 text-sm text-white/70 leading-relaxed">
            <p>{t("My Perfect Meals works like a real nutrition coach.")}</p>
            <p>
              {t("During setup you will answer a few questions about your goals, how you normally eat, your lifestyle, and any health considerations that may affect your food choices. This information allows the system to calculate your personal nutrition targets and guide your daily food decisions.")}
            </p>
            <p>
              {t("For people managing real health concerns such as diabetes, inflammation, digestive sensitivities, or other dietary restrictions, the system includes built-in guardrails designed to help filter and guide food choices more responsibly.")}
            </p>
            <p>
              {renderApprovedEmphasis(t("Instead of simply logging food after you eat it, My Perfect Meals helps guide what to eat **before** you eat it."))}
            </p>
            <p>
              {renderApprovedEmphasis(t("Think of it as a ** nutrition coach in your pocket ** helping you make smarter food decisions wherever you eat."))}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-4">
          <Checkbox
            id="read-explanation"
            checked={hasReadExplanation}
            onCheckedChange={(checked) =>
              setHasReadExplanation(checked as boolean)
            }
            className="mt-0.5 border-white/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
          />
          <label
            htmlFor="read-explanation"
            className="text-sm text-white/80 leading-tight cursor-pointer"
          >
            {t("I have read and understand how My Perfect Meals works")}
          </label>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-5 mb-4">
          <h2 className="text-lg font-bold text-red-400 mb-3">
            {t("MEDICAL DISCLAIMER")}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            {t("My Perfect Meals is not a medical service. The information you provide during onboarding is used to generate personalized meal suggestions based on your preferences, goals, and health inputs. This app does not diagnose, treat, or cure any medical conditions. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your physician or a qualified healthcare provider before making changes to your diet, medications, or lifestyle.")}
          </p>

          <div className="space-y-3">
            <div className="bg-yellow-950/30 border border-yellow-500/20 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">
                {t("CONSULT YOUR HEALTHCARE PROVIDER")}
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>{t("Before starting any new diet or nutrition plan")}</li>
                <li>{t("If you have any medical conditions or take medications")}</li>
                <li>
                  {t("If you are pregnant, breastfeeding, or have special dietary needs")}
                </li>
                <li>{t("If you have food allergies or intolerances")}</li>
              </ul>
            </div>

            <div className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">
                {t("AI-GENERATED CONTENT")}
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>
                  {t("Meal suggestions are generated by artificial intelligence")}
                </li>
                <li>
                  {t("Content may contain errors or be inappropriate for your specific needs")}
                </li>
                <li>{t("Always verify nutritional information independently")}</li>
                <li>
                  {t("Use your own judgment when following meal recommendations")}
                </li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-white/80 mb-2">
                {t("YOUR RESPONSIBILITY")}
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>{t("You are responsible for your own health and safety")}</li>
                <li>{t("This app does not provide medical advice or treatment")}</li>
                <li>
                  {t("Never ignore professional medical advice because of information from this app")}
                </li>
                <li>
                  {t("Seek immediate medical attention for any health emergencies")}
                </li>
              </ul>
            </div>

            <div className="bg-red-950/40 border border-red-500/20 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-red-400 mb-2">
                {t("LIMITATIONS")}
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/60">
                <li>{t("This app is not approved by the FDA")}</li>
                <li>
                  {t("Not intended to diagnose, treat, cure, or prevent any disease")}
                </li>
                <li>{t("Individual results may vary")}</li>
                <li>{t("No guarantee of accuracy of nutritional information")}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-6">
          <Checkbox
            id="accept-disclaimer"
            checked={hasAcceptedDisclaimer}
            onCheckedChange={(checked) =>
              setHasAcceptedDisclaimer(checked as boolean)
            }
            className="mt-0.5 border-white/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
          />
          <label
            htmlFor="accept-disclaimer"
            className="text-sm text-white/80 leading-tight cursor-pointer"
          >
            {t("I accept the medical disclaimer and understand this app does not replace professional medical advice")}
          </label>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={() => setLocation("/onboarding")}
          disabled={!hasReadExplanation || !hasAcceptedDisclaimer}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
                {t("Continue to Onboarding")}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
