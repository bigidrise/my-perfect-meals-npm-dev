// Extended Dashboard - With enhanced daily tracking from alternate version
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { consumeScrollTarget } from "@/utils/scroll";
import {
  saveScrollPosition,
  restoreScrollPosition,
  saveNavigationHistory,
} from "@/utils/scrollUtils";

import { ChefHat, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
// Avatar assistant functionality now integrated into SmartAvatarConcierge

// Extended Dashboard with Enhanced Daily Tracking
export default function ExtendedDashboard() {
  const [, setLocation] = useLocation();
  const [showAIBanner, setShowAIBanner] = useState(true);

  // Set proper page title
  useEffect(() => {
    document.title = "Extended Dashboard | My Perfect Meals";
  }, []);

  // Get user profile to determine userId for progress metrics
  const { data: userProfile } = useQuery({
    queryKey: ["/api/profile"],
  });

  // Get full user data including avatar and voice settings for greeting
  const { data: fullUserData } = useQuery({
    queryKey: ["/api/users/1"],
  });

  // For beta testing, default to user 1 since profile endpoint returns basic data
  const userId = 1;

  // Fetch user streak data
  const { data: streakResponse, isLoading: streakLoading } = useQuery({
    queryKey: ["userStreak", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/streak`);
      if (!res.ok) {
        if (res.status === 404) return null; // No streak data yet
        throw new Error("Failed to fetch streak data");
      }
      return res.json();
    },
  });

  // Unwrap the streak data from the API response
  const streakData = streakResponse?.currentStreak || null;

  // Fetch user badge data
  const { data: badgeData, isLoading: badgeLoading } = useQuery({
    queryKey: ["userBadges", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/badges`);
      if (!res.ok) {
        if (res.status === 404) return []; // No badges yet
        throw new Error("Failed to fetch badge data");
      }
      return res.json();
    },
  });

  // Check if AI banner should be shown (dismiss after 3 views)
  useEffect(() => {
    const bannerViews = parseInt(
      localStorage.getItem("ai-wellness-banner-views") || "0",
    );
    if (bannerViews >= 3) {
      setShowAIBanner(false);
    }
  }, []);

  // Restore scroll position when returning to dashboard
  useEffect(() => {
    restoreScrollPosition("dashboardScroll");
  }, []);

  // Handle scroll to dashboard sections from navigation
  useEffect(() => {
    const id = consumeScrollTarget();
    if (!id) return;

    // Primary attempt: scroll immediately if element already in DOM
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Fallback #1: poll DOM for ≤ 1 s
    let attempts = 0;
    const interval = setInterval(() => {
      const elTry = document.getElementById(id);
      if (elTry) {
        clearInterval(interval);
        elTry.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (++attempts > 10) clearInterval(interval); // stop after 1 s
    }, 100);

    // Fallback #2 (safety): final try after 2 s
    setTimeout(() => {
      const elFinal = document.getElementById(id);
      if (elFinal)
        elFinal.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 2000);
  }, []);

  const dismissAIBanner = () => {
    const currentViews = parseInt(
      localStorage.getItem("ai-wellness-banner-views") || "0",
    );
    localStorage.setItem(
      "ai-wellness-banner-views",
      (currentViews + 1).toString(),
    );
    setShowAIBanner(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Full-width responsive container like mobile */}
      <div className="w-full min-h-screen p-4 sm:p-6">
        {/* Header with Logo */}
        <div className="mb-8">
          <div className="flex flex-col items-center justify-center mb-2">
            <img
              src="/assets/MPMTransparentLogo.png"
              alt="My Perfect Meals Logo"
              style={{
                filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.9)) drop-shadow(0 12px 18px rgba(0,0,0,0.7)) drop-shadow(-3px 10px 12px rgba(0,0,0,0.6)) drop-shadow(3px 10px 12px rgba(0,0,0,0.6))'
              }}
              className="h-32 w-auto object-contain select-none pointer-events-none mb-4"
              draggable={false}
              onError={(e) => {
                console.log("Logo failed to load, showing fallback");
                // Create fallback logo design
                const fallback = document.createElement("div");
                fallback.className =
                  "h-32 w-32 bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center shadow-2xl shadow-black/80 mb-4";
                fallback.innerHTML = `
                  <div class="text-white text-center">
                    <div class="text-lg font-bold">My Perfect</div>
                    <div class="text-sm">Meals</div>
                  </div>
                `;
                e.currentTarget.parentElement?.replaceChild(
                  fallback,
                  e.currentTarget,
                );
              }}
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800">Extended Dashboard</h1>
              <p className="text-gray-600">Enhanced Daily Tracking</p>
            </div>
          </div>

          {/* AI Wellness Q&A Awareness Banner */}
          {showAIBanner && (
            <div className="mt-4 bg-indigo-100 border-l-4 border-indigo-500 text-indigo-900 p-4 rounded shadow-md relative">
              <button
                onClick={dismissAIBanner}
                className="absolute top-2 right-2 text-indigo-700 hover:text-indigo-900 transition-colors"
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
              <p className="font-semibold">Private Health Q&A Now Available</p>
              <p className="text-sm mt-1">
                Got a personal question about pregnancy, menopause, mental
                health, or anything else? Use our private, judgment-free Q&A to
                get trusted answers anytime.
              </p>
              <button
                className="mt-2 text-sm font-medium underline text-indigo-600 hover:text-indigo-800"
                onClick={() => {
                  saveNavigationHistory("/ai-wellness-qa", "/");
                  setLocation("/ai-wellness-qa");
                }}
              >
                Ask Now – It's Anonymous
              </button>
            </div>
          )}
        </div>

        {/* Avatar assistant functionality now available through floating SmartAvatarConcierge */}

        {/* Express Navigator - Compact Version */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-purple-300 rounded-xl shadow-2xl shadow-black/80 p-4 text-black">
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold">Quick Access</h2>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* My Perfect Meals Game Hub (single door for all games) */}
              <button
                onClick={() => {
                  saveScrollPosition("dashboardScroll");
                  saveNavigationHistory("/game-hub", "/");
                  setLocation("/game-hub");
                }}
                className="bg-gradient-to-br from-purple-500 via-pink-600 to-red-600 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-center border-2 border-yellow-300/40 hover:border-yellow-300/60"
                aria-label="Open Game Hub"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🎮</span>
                  <span className="font-bold text-sm">My Perfect Meals Game Hub</span>
                </div>
              </button>

              {/* Express to Meal Planning Hub */}
              <button
                onClick={() => {
                  saveScrollPosition("dashboardScroll");
                  saveNavigationHistory("/plan-builder-hub", "/");
                  setLocation("/plan-builder-hub");
                }}
                className="bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🍽️</span>
                  <span className="font-bold text-sm">Plan Builder Hub</span>
                </div>
              </button>

              {/* Express to Weekly Meal Board */}
              <button
                onClick={() => {
                  saveScrollPosition("dashboardScroll");
                  saveNavigationHistory("/weekly-meal-board", "/");
                  setLocation("/weekly-meal-board");
                }}
                className="bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">📅</span>
                  <span className="font-bold text-sm">Weekly Meal Board</span>
                </div>
              </button>

              {/* Express to My Biometrics */}
              <button
                onClick={() => {
                  saveScrollPosition("dashboardScroll");
                  saveNavigationHistory("/my-biometrics", "/");
                  setLocation("/my-biometrics");
                }}
                className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">📈</span>
                  <span className="font-bold text-sm">My Biometrics</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Daily's Section */}
        <div id="food-tracking-section" className="mb-6">
          <div className="w-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-purple-300 text-black p-4 rounded-xl shadow-2xl shadow-black/80 hover:shadow-2xl hover:shadow-black/90 transform hover:scale-105 transition-all duration-200 relative overflow-hidden">
            <div className="text-center mb-4">
              <div className="text-2xl mb-2">⭐ 📅 ⭐</div>
              <h2 className="text-xl font-bold mb-2">Enhanced Daily Tracking</h2>
              <p className="text-sm opacity-90">Complete your wellness activities</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Smart Shopping List - Enhanced Feature */}
              <div className="rounded-xl p-[1px] bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 transition">
                <button
                  onClick={() => setLocation("/shopping-list-v2")}
                  className="w-full bg-black/30 backdrop-blur-lg text-white p-3 rounded-xl shadow-2xl shadow-orange-500/50 hover:shadow-2xl hover:shadow-red-500/50 transition-all duration-200 text-center relative border-transparent"
                >
                  <div className="text-2xl mb-2">🛒</div>
                  <h3 className="font-bold text-lg mb-1">Smart Shopping</h3>
                  <p className="text-xs opacity-90">Groceries synced to meals</p>
                  <div className="absolute top-2 right-2 text-green-300 text-lg">✓</div>
                </button>
              </div>

              {/* Voice Food Log */}
              <button
                onClick={() => setLocation("/food")}
                className="bg-sky-300/30 hover:bg-sky-300/40 text-white p-3 rounded-xl shadow-2xl shadow-black/80 hover:shadow-2xl hover:shadow-black/90 transition-all duration-200 text-center relative border-2 border-sky-200/40 hover:border-sky-200/60"
              >
                <div className="text-2xl mb-2">🍽️</div>
                <h3 className="font-bold text-lg mb-1">Log Meals</h3>
                <p className="text-xs opacity-90">Voice & photo logging</p>
                <div className="absolute top-2 right-2 text-green-300 text-lg">✓</div>
              </button>

              {/* Daily Journal */}
              <button
                onClick={() => setLocation("/daily-journal")}
                className="bg-blue-400/30 hover:bg-blue-400/40 text-white p-3 rounded-xl shadow-2xl shadow-black/80 hover:shadow-2xl hover:shadow-black/90 transition-all duration-200 text-center relative border-2 border-blue-300/40 hover:border-blue-300/60"
              >
                <div className="text-2xl mb-2">📝</div>
                <h3 className="font-bold text-lg mb-1">Write Journal</h3>
                <p className="text-xs opacity-90">Daily reflection</p>
                <div className="absolute top-2 right-2 text-green-300 text-lg">✓</div>
              </button>

              {/* Water Tracking */}
              <button
                onClick={() => setLocation("/track-water")}
                className="bg-blue-600/30 hover:bg-blue-600/40 text-white p-3 rounded-xl shadow-2xl shadow-black/80 hover:shadow-2xl hover:shadow-black/90 transition-all duration-200 text-center relative border-2 border-blue-500/40 hover:border-blue-500/60"
              >
                <div className="text-2xl mb-2">💧</div>
                <h3 className="font-bold text-lg mb-1">Track Water</h3>
                <p className="text-xs opacity-90">Stay hydrated</p>
                <div className="absolute top-2 right-2 text-green-300 text-lg">✓</div>
              </button>
            </div>
          </div>
        </div>

        {/* Health & Wellness Section */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Health & Wellness</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLocation("/body-composition")}
                className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center hover:bg-blue-100 transition-colors"
              >
                <div className="text-2xl mb-1">🏋️</div>
                <span className="text-xs font-medium text-gray-700">Body Composition</span>
              </button>

              <button
                onClick={() => setLocation("/cycle-tracking")}
                className="bg-pink-50 border border-pink-200 p-3 rounded-xl text-center hover:bg-pink-100 transition-colors"
              >
                <div className="text-2xl mb-1">🌸</div>
                <span className="text-xs font-medium text-gray-700">Cycle Tracking</span>
              </button>

              <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center opacity-70 cursor-not-allowed relative">
                <div className="text-2xl mb-1">👥</div>
                <span className="text-xs font-medium text-gray-700">Groups & Challenges</span>
                <div className="text-xs font-bold text-orange-600 mt-1 bg-orange-100 px-2 py-1 rounded">🚧 Under Construction</div>
              </div>

              <button
                onClick={() => setLocation("/daily-summary")}
                className="bg-green-50 border border-green-200 p-3 rounded-xl text-center hover:bg-green-100 transition-colors"
              >
                <div className="text-2xl mb-1">📊</div>
                <span className="text-xs font-medium text-gray-700">Daily Summary</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}