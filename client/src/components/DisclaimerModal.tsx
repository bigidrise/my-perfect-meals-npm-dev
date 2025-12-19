/*
 * LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 * Feature: Medical Disclaimer Modal
 * Locked: August 3, 2025
 *
 * This component contains critical medical disclaimer content and legal requirements.
 * Any modifications must be approved by the user to ensure compliance and functionality.
 *
 * Key features locked:
 * - Mobile-optimized scrollable layout with proper height calculations
 * - Medical disclaimer content and legal warnings
 * - Checkbox validation system for user acceptance
 * - Navigation skip buttons for testing purposes
 * - Responsive design for mobile and desktop
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DisclaimerModalProps {
  onAccept: () => void;
}

export default function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const [hasRead, setHasRead] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  console.log("DisclaimerModal mounted and rendering");

  // DEV BYPASS: Auto-skip disclaimer in development with Ctrl+D (disabled in production)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        console.log("🚀 DEV BYPASS: Ctrl+D pressed - skipping directly to dashboard");
        localStorage.setItem("acceptedDisclaimer", "true");
        localStorage.setItem("emotionalState", "excited");
        localStorage.setItem("onboardingCompleted", "true");
        onAccept();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onAccept]);

  const handleAccept = () => {
    console.log("Disclaimer accepted, calling onAccept");
    localStorage.setItem("acceptedDisclaimer", "true");
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl h-[95vh] sm:max-h-[90vh] bg-white rounded-lg shadow-2xl border-4 border-red-600 overflow-hidden p-4 sm:p-6 flex flex-col">
        <div className="relative mb-4 flex-shrink-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-center text-red-600 pr-8">
            ⚠️ IMPORTANT MEDICAL DISCLAIMER ⚠️
          </h1>
          {import.meta.env.DEV && (
            <div className="text-center mt-1">
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                💡 Dev Tip: Press <kbd className="bg-white border border-gray-300 px-1 rounded">Ctrl+D</kbd> to skip
              </span>
            </div>
          )}
          <button
            onClick={() => {
              localStorage.setItem("acceptedDisclaimer", "true");
              localStorage.setItem("emotionalState", "excited");
              localStorage.setItem("onboardingCompleted", "true");
              onAccept();
            }}
            className="absolute top-0 right-0 text-white bg-red-600 hover:bg-red-700 text-lg font-bold w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shadow-lg z-[10000] border-2 border-white"
          >
            ×
          </button>
        </div>

        <div
          className="flex-1 min-h-0 mb-3 overflow-y-auto pr-2 sm:pr-4"
          style={{ maxHeight: "calc(100dvh - 200px)" }}
        >
          <div className="space-y-3 text-sm pb-2">
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <h3 className="font-semibold text-red-800 mb-2">
                MEDICAL DISCLAIMER
              </h3>
              <p className="text-red-700">
                My Perfect Meals is not a medical service. The information you
                provide during onboarding is used to generate personalized meal
                suggestions based on your preferences, goals, and health inputs.
                This app does not diagnose, treat, or cure any medical
                conditions. It is not a substitute for professional medical
                advice, diagnosis, or treatment. Always consult your physician
                or a qualified healthcare provider before making changes to your
                diet, medications, or lifestyle. By continuing, you agree that
                you understand and accept this disclaimer.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Before Using This App:</h3>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  🩺 CONSULT YOUR HEALTHCARE PROVIDER
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-yellow-700">
                  <li>Before starting any new diet or nutrition plan</li>
                  <li>
                    If you have any medical conditions or take medications
                  </li>
                  <li>
                    If you are pregnant, breastfeeding, or have special dietary
                    needs
                  </li>
                  <li>If you have food allergies or intolerances</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                <h4 className="font-semibold text-blue-800 mb-2">
                  🔬 AI-GENERATED CONTENT
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-blue-700">
                  <li>
                    Meal suggestions are generated by artificial intelligence
                  </li>
                  <li>
                    Content may contain errors or be inappropriate for your
                    specific needs
                  </li>
                  <li>Always verify nutritional information independently</li>
                  <li>
                    Use your own judgment when following meal recommendations
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                <h4 className="font-semibold text-gray-800 mb-2">
                  ⚖️ YOUR RESPONSIBILITY
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  <li>You are responsible for your own health and safety</li>
                  <li>This app does not provide medical advice or treatment</li>
                  <li>
                    Never ignore professional medical advice because of
                    information from this app
                  </li>
                  <li>
                    Seek immediate medical attention for any health emergencies
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 p-4 rounded">
                <h4 className="font-semibold text-red-800 mb-2">
                  🚫 LIMITATIONS
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-red-700">
                  <li>This app is not approved by the FDA</li>
                  <li>
                    Not intended to diagnose, treat, cure, or prevent any
                    disease
                  </li>
                  <li>Individual results may vary</li>
                  <li>No guarantee of accuracy of nutritional information</li>
                </ul>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-600">
                By using this application, you acknowledge that you have read,
                understood, and agree to this disclaimer. You understand that
                this app is for informational purposes only and should not
                replace professional medical advice.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t flex-shrink-0">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="read"
              checked={hasRead}
              onCheckedChange={(checked) => setHasRead(checked as boolean)}
              className="mt-1"
            />
            <label htmlFor="read" className="text-xs leading-tight">
              I have read and understood the entire disclaimer above
            </label>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="accept"
              checked={hasAccepted}
              onCheckedChange={(checked) => setHasAccepted(checked as boolean)}
              disabled={!hasRead}
              className="mt-1"
            />
            <label htmlFor="accept" className="text-xs leading-tight">
              I accept the terms and understand this is not medical advice
            </label>
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => {
              // Accept & Continue - Route to Emotional Gate
              localStorage.setItem("acceptedDisclaimer", "true");
              localStorage.setItem("emotionalState", "excited");
              localStorage.removeItem("onboardingCompleted"); // Ensure normal flow
              onAccept();
            }}
            disabled={!hasRead || !hasAccepted}
            data-testid="button-accept-disclaimer"
          >
            Accept & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
