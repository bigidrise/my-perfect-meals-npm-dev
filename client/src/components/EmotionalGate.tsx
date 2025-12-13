/*
 * LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 * Feature: Comprehensive Emotional Intro Gate
 * Locked: August 3, 2025
 *
 * This component contains the complete app philosophy, personal story, and educational system.
 * Any modifications must be approved by the user to maintain the intended user experience.
 *
 * Key features locked:
 * - 40+ years experience story and professional background
 * - Complete feature showcase (Fridge Rescue, Alcohol Log, Restaurant Guide, etc.)
 * - 3-step educational system with completion tracking
 * - App creation motivation and philosophy
 * - Interactive learning modules for stress eating, craving control, and food shame
 */

// EmotionalIntroGate.tsx – Full-length, pain-zone version (Coach Idrise)
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

const COACH_NAME =
  (import.meta as any).env?.VITE_COACH_DISPLAY_NAME ?? "Coach Idrise";
const COACH_PHOTO =
  (import.meta as any).env?.VITE_COACH_PHOTO_URL ?? "/images/coach-idrise.jpg";

export default function EmotionalIntroGate() {
  const [stressComplete, setStressComplete] = useState(
    localStorage.getItem("stressComplete") === "true",
  );
  const [cravingComplete, setCravingComplete] = useState(
    localStorage.getItem("cravingComplete") === "true",
  );
  const [shameComplete, setShameComplete] = useState(
    localStorage.getItem("shameComplete") === "true",
  );
  const [location, setLocation] = useLocation();

  const isReadyToContinue = stressComplete && cravingComplete && shameComplete;

  useEffect(() => {
    if (isReadyToContinue) {
      localStorage.setItem("emotionalIntroComplete", "true");
    }
  }, [isReadyToContinue]);

  const handleNav = (path: string) => {
    localStorage.setItem("emotionalIntroComplete", "true");
    setLocation(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-2 sm:px-6">
        <div className="bg-white/85 backdrop-blur-sm rounded-xl shadow-2xl p-4 sm:p-8 border border-indigo-200/50">
          {/* Header with coach photo */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-8">
            <img
              src={COACH_PHOTO}
              alt={`${COACH_NAME} headshot`}
              className="h-28 w-28 rounded-2xl object-cover shadow-xl ring-2 ring-indigo-200"
              loading="eager"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-4xl font-bold text-indigo-800">
                Hey there — I'm {COACH_NAME}.
              </h1>
              <p className="text-indigo-700 text-base sm:text-lg mt-2">
                Before we start, I want to talk to you like we're sitting at the
                kitchen table—no buzzwords, no hype, just real talk.
              </p>
            </div>
          </div>

          {/* Coach Credentials */}
          <div className="mb-8 text-center sm:text-left max-w-3xl mx-auto">
            <p className="text-sm sm:text-base text-indigo-800/90 leading-relaxed">
              <span className="font-semibold">Former Surgical ICU EMT.</span>{" "}
              USA National Title (2002) & California State Title (2001) IFBB Pro.
              <br />
              <span className="font-semibold">30 years coaching, 40 years in fitness.</span>{" "}
              NASM—Women's Fitness (WFS), Nutrition Coach (CNC), Behavior Change Specialist (BCS).
            </p>

            {/* Certification badges */}
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              <Badge className="bg-indigo-100 border border-indigo-300 text-indigo-800 hover:bg-indigo-200">
                NASM WFS
              </Badge>
              <Badge className="bg-indigo-100 border border-indigo-300 text-indigo-800 hover:bg-indigo-200">
                NASM CNC
              </Badge>
              <Badge className="bg-indigo-100 border border-indigo-300 text-indigo-800 hover:bg-indigo-200">
                NASM BCS
              </Badge>
            </div>

            {/* Compliance line */}
            <p className="mt-3 text-xs text-indigo-600/70">
              Education-based guidance; not a substitute for personalized medical advice.
            </p>
          </div>

          {/* Pull quote */}
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-5 sm:p-6 rounded-lg mb-8">
            <p className="text-lg leading-relaxed italic font-medium text-yellow-800">
              "You don't need a new lifestyle. You need a plan that fits the
              one you already have."
            </p>
          </div>

          {/* Long-form message */}
          <div className="space-y-6 text-gray-800 mb-10">
            <p className="text-lg leading-relaxed">
              If you've ever felt ignored by the fitness and nutrition world,
              you're not imagining it. This industry talks loudly to athletes,
              to people who already love the gym, and to folks who want to
              obsess about macros. But if you're busy, tired, overwhelmed, or
              just don't want your life to revolve around food rules and
              workouts—most of the industry stops talking to you. And that's not
              okay.
            </p>

            <p className="text-lg leading-relaxed">
              When you get left out of that conversation, who's left to talk to
              you? Pharmaceutical companies. Plastic surgeons. Quick fixes. And
              if you listen long enough, the message starts to sound like,
              "You're the problem." You're not. You've just been ignored.
            </p>

            <p className="text-lg leading-relaxed">
              Here's what I know after 40+ years in this world—professional
              bodybuilder, Air Force surgical ICU medic, EMT, certified
              nutrition coach, trainer, women's fitness specialist, behavior
              change coach: we built a culture that <em>measures</em> people,
              but doesn't always <em>help</em> them. Apps track, diets restrict,
              plans promise—but when real life hits, most tools disappear.{" "}
              <span className="font-semibold">
                My Perfect Meals is different.
              </span>
            </p>

            <p className="text-lg leading-relaxed">
              This isn't another diet. It's not another "try harder" speech.
              It's a system designed to think with you and fit around the life
              you already have. Whether you sit all day or you're on your feet,
              whether you skip breakfast or eat late, whether you enjoy wine,
              love your coffee, travel for work, chase toddlers, or don't plan
              on stepping into a gym—this app meets you where you are and helps
              you move forward from there.
            </p>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
              <h3 className="text-indigo-900 font-semibold mb-2">
                What that means, in plain language:
              </h3>
              <ul className="list-disc pl-5 space-y-2 text-indigo-800">
                <li>No workouts required.</li>
                <li>No perfect days needed.</li>
                <li>No "start over Monday" guilt cycles.</li>
                <li>
                  We build around your routines—late dinners, grab-and-go, night
                  shifts, travel, family schedules, cravings, and all.
                </li>
              </ul>
            </div>

            <p className="text-lg leading-relaxed">
              Most apps are fancy journals. They let you log food but don't help
              you decide <em>what</em> to eat when it matters—when you're tired,
              stressed, out of groceries, or craving something sweet.{" "}
              <span className="font-semibold">This one does.</span> It looks at
              who you are, what you like, what your body needs, and what your
              day really looks like—and then helps you choose, simply and
              confidently.
            </p>

            <p className="text-lg leading-relaxed">
              <span className="font-semibold">
                Onboarding is the key that unlocks it all.
              </span>{" "}
              Give the app a few minutes: your lifestyle, goals, medical needs,
              cravings, body type, preferences. From there, your meals and
              guidance adjust to your actual life. No guessing. No generic
              templates. Just a plan that fits.
            </p>

            <p className="text-lg leading-relaxed">
              We also talk about the *why* behind choices—because biology,
              stress, habits, and emotions all drive eating. When those are
              supported instead of judged, results last. That's the difference
              between short-term willpower and long-term change.
            </p>

            <p className="text-lg leading-relaxed">
              I care about this because I've struggled too—and because I've
              watched too many people feel like they're failing when the system
              around them was never built for their reality. You deserve to feel
              good in your body without starving, stressing, or shrinking your
              life to fit a diet.
            </p>

            <p className="text-lg leading-relaxed font-semibold">
              This is your tool. Your partner. Your plan.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-10">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">🔄 Fridge Rescue</h3>
              <p className="text-blue-700">
                Not sure what to eat? Type what's in your kitchen (or snap a
                picture). Get three meal options using what you already have—less
                stress, less waste.
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">🍷 Alcohol Log</h3>
              <p className="text-green-700">
                Nights out included—no guilt. We auto-adjust your plan so your
                goals keep moving.
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-800 mb-2">⏰ Meal Reminders</h3>
              <p className="text-purple-700">
                Busy days lead to skipped meals and crashes. Gentle nudges help
                you stay steady and clear.
              </p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-800 mb-2">🍽️ Restaurant Guide</h3>
              <p className="text-orange-700">
                Eat out with confidence. We help you pick meals that fit{" "}
                <em>your</em> numbers—no stress.
              </p>
            </div>

            <div className="bg-pink-50 p-4 rounded-lg">
              <h3 className="font-semibold text-pink-800 mb-2">💡 Craving Creator</h3>
              <p className="text-pink-700">
                Craving something specific? Build a satisfying swap around it so
                you stay on track without feeling restricted.
              </p>
            </div>

            <div className="bg-indigo-50 p-4 rounded-lg">
              <h3 className="font-semibold text-indigo-800 mb-2">🧬 Lab-Aware Meals</h3>
              <p className="text-indigo-700">
                Nutrition that respects your bloodwork and medical needs—not
                one-size-fits-all rules.
              </p>
            </div>
          </div>

          {/* Educational Foundations */}
          <div className="space-y-6 mb-8">
            {/* Step 1 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-red-800">
                  Step 1: Stress Eating Solution
                </h2>
                {stressComplete ? (
                  <span className="text-green-600 font-semibold">✓ Complete</span>
                ) : (
                  <button
                    onClick={() => {
                      setStressComplete(true);
                      localStorage.setItem("stressComplete", "true");
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
              <p className="text-red-700 mb-4">
                Stress eating isn't a willpower problem—it's biology. Cortisol and
                decision fatigue push you toward quick-fix foods. We steady blood
                sugar, simplify choices, and break that crash-and-crave cycle.
              </p>
              <div className="space-y-3 text-red-800">
                <p>
                  Every meal is engineered to keep energy stable so your brain
                  can say "no" without a fight.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-blue-800">Step 2: Craving Control</h2>
                {cravingComplete ? (
                  <span className="text-green-600 font-semibold">✓ Complete</span>
                ) : (
                  <button
                    onClick={() => {
                      setCravingComplete(true);
                      localStorage.setItem("cravingComplete", "true");
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
              <p className="text-blue-700 mb-4">
                You can eat a solid meal and still crave cake. That's not hunger;
                that's association. We recreate the feeling you want with options
                that still move you forward.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-green-800">
                  Step 3: Breaking Food Shame
                </h2>
                {shameComplete ? (
                  <span className="text-green-600 font-semibold">✓ Complete</span>
                ) : (
                  <button
                    onClick={() => {
                      setShameComplete(true);
                      localStorage.setItem("shameComplete", "true");
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
              <p className="text-green-700 mb-4">
                No single meal defines you. We focus on patterns, not perfection.
                Make a choice, adjust, keep going. That's how change sticks.
              </p>
            </div>
          </div>

          {/* Continue button + DEV bypass */}
          <div className="text-center space-y-4">
            {import.meta.env.DEV && !isReadyToContinue && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-xs text-yellow-700 mb-2">
                  <strong>Testing Bypass:</strong> Skip reading modules and go
                  straight to onboarding
                </p>
                <button
                  onClick={() => handleNav("/onboarding")}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                >
                  Skip to Onboarding (Dev Only)
                </button>
              </div>
            )}

            <button
              onClick={() => handleNav("/onboarding")}
              disabled={!isReadyToContinue}
              className={`px-6 py-4 rounded-full text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 w-full max-w-sm mx-auto ${
                isReadyToContinue
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <span className="block sm:hidden">
                {isReadyToContinue ? "🚀 Start Your Journey" : "Complete Steps Above"}
              </span>
              <span className="hidden sm:block">
                {isReadyToContinue
                  ? "🚀 Start Your Personalized Journey"
                  : "Complete All Steps Above to Continue"}
              </span>
            </button>

            <p className="text-xs text-gray-500">
              You can revisit these foundations anytime: Settings → Foundations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
