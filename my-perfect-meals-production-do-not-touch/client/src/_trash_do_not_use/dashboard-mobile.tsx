// Mobile-First Dashboard - Optimized for smartphones
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChefHat, Calendar, TrendingUp, Heart, Brain, Users } from "lucide-react";

export default function MobileDashboard() {
  const [, setLocation] = useLocation();

  // Set proper page title and ensure scroll to top
  useEffect(() => {
    document.title = "Mobile Dashboard | My Perfect Meals";
    
    // Ensure we start at the top
    import("@/utils/scrollToTop").then(({ forceScrollToTop }) => {
      forceScrollToTop();
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 mb-4">
        <h1 className="text-xl font-bold text-center">My Perfect Meals</h1>
        <p className="text-center text-sm opacity-90">Your wellness companion</p>
      </div>

      <div className="px-4 pb-20">
        {/* Today's Focus Card */}
        <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Today's Focus</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setLocation("/food")}
              className="bg-gradient-to-br from-orange-400 to-red-400 text-white p-3 rounded-xl text-center"
            >
              <div className="text-2xl mb-1">🍽️</div>
              <span className="text-xs font-medium">Log Meals</span>
            </button>
            <button
              onClick={() => setLocation("/track-water")}
              className="bg-gradient-to-br from-blue-400 to-cyan-400 text-white p-3 rounded-xl text-center"
            >
              <div className="text-2xl mb-1">💧</div>
              <span className="text-xs font-medium">Track Water</span>
            </button>
          </div>
        </div>

        {/* Main Features */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => setLocation("/comprehensive-meal-planning-revised")}
            className="w-full bg-gradient-to-r from-emerald-400 to-teal-400 text-white p-4 rounded-xl shadow-lg flex items-center gap-3"
          >
            <ChefHat className="w-6 h-6" />
            <div className="text-left">
              <h3 className="font-bold">Meal Planning Hub</h3>
              <p className="text-xs opacity-90">AI-powered meal creation</p>
            </div>
          </button>

          <button
            onClick={() => setLocation("/my-biometrics")}
            className="w-full bg-gradient-to-r from-violet-400 to-purple-400 text-white p-4 rounded-xl shadow-lg flex items-center gap-3"
          >
            <TrendingUp className="w-6 h-6" />
            <div className="text-left">
              <h3 className="font-bold">My Biometrics</h3>
              <p className="text-xs opacity-90">Track health metrics</p>
            </div>
          </button>

          <button
            onClick={() => setLocation("/daily-journal")}
            className="w-full bg-gradient-to-r from-pink-400 to-rose-400 text-white p-4 rounded-xl shadow-lg flex items-center gap-3"
          >
            <Calendar className="w-6 h-6" />
            <div className="text-left">
              <h3 className="font-bold">Daily Journal</h3>
              <p className="text-xs opacity-90">Reflect and grow</p>
            </div>
          </button>
        </div>

        {/* Health Sections */}
        <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Health & Wellness</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setLocation("/womens-health")}
              className="bg-pink-50 border border-pink-200 p-3 rounded-xl text-center hover:bg-pink-100 transition-colors"
            >
              <Heart className="w-6 h-6 mx-auto text-pink-500 mb-1" />
              <span className="text-xs font-medium text-gray-700">Women's Health</span>
            </button>

            <button
              onClick={() => setLocation("/mens-health")}
              className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center hover:bg-blue-100 transition-colors"
            >
              <Brain className="w-6 h-6 mx-auto text-blue-500 mb-1" />
              <span className="text-xs font-medium text-gray-700">Men's Health</span>
            </button>

            <button
              onClick={() => setLocation("/ai-wellness-qa")}
              className="bg-green-50 border border-green-200 p-3 rounded-xl text-center hover:bg-green-100 transition-colors"
            >
              <div className="text-lg mb-1">💙</div>
              <span className="text-xs font-medium text-gray-700">AI Q&A</span>
            </button>

            <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center opacity-70 cursor-not-allowed">
              <Users className="w-6 h-6 mx-auto text-purple-500 mb-1" />
              <span className="text-xs font-medium text-gray-700">Groups & Challenges</span>
              <div className="text-xs font-bold text-orange-600 mt-1 bg-orange-100 px-2 py-1 rounded">🚧 Under Construction</div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Quick Stats</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-lg font-bold text-blue-600">0</div>
              <div className="text-xs text-gray-600">Meals Today</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-lg font-bold text-green-600">0</div>
              <div className="text-xs text-gray-600">Water Glasses</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-lg font-bold text-purple-600">0</div>
              <div className="text-xs text-gray-600">Day Streak</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}