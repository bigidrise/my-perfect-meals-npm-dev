
import React, { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Activity,
  Target,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DiabetesSupportPage() {
  const [, setLocation] = useLocation();
  const [glucoseReading, setGlucoseReading] = useState("");
  const [targetRange, setTargetRange] = useState({ min: 80, max: 120 });
  const [readings] = useState([
    { date: "2025-01-15", time: "08:00", value: 95, type: "Fasting" },
    { date: "2025-01-15", time: "14:00", value: 142, type: "Post-meal" },
    { date: "2025-01-14", time: "08:00", value: 88, type: "Fasting" },
    { date: "2025-01-14", time: "20:00", value: 118, type: "Post-meal" },
  ]);

  const logReading = () => {
    if (glucoseReading.trim()) {
      // In a real app, this would save to the database
      console.log("Logging glucose reading:", glucoseReading);
      setGlucoseReading("");
    }
  };

  const currentReading = readings[0]?.value || 0;
  const isInRange =
    currentReading >= targetRange.min && currentReading <= targetRange.max;

  return (
    <>
      {/* Portal-like button positioned outside the main stacking context */}
      <div
        className="fixed top-4 left-4 pointer-events-auto"
        style={{ 
          zIndex: 2147483647,
          isolation: 'isolate',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      >
        <Button
          onClick={() => setLocation("/diabetic-hub")}
          className="flex items-center gap-2 text-white bg-black/20 backdrop-blur-sm border border-white/30 hover:bg-black/30 transition-all duration-200 font-medium rounded-2xl shadow-2xl"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
          
        </Button>
      </div>

      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 relative">
        {/* Enhanced Glass Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10 pointer-events-none" />

        <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24 relative z-10">
          {/* Navigation button moved to portal above */}

        {/* Enhanced Glass Header */}
        <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden mb-12 mt-14">
          {/* Inner glass shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
          <h1 className="text-2xl md:text-2xl font-semi-bold text-white mb-4 relative z-10">
            📊 Blood Sugar Tracker
          </h1>
          <p className="text-sm text-white/90 max-w-3xl mx-auto relative z-10">
            Log your blood sugar readings, view trends over time, and learn how to manage your glucose levels
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Enhanced Glass Log New Reading */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg">
                <Activity className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-medium text-white">
                Log Blood Glucose
              </h2>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-sm text-white font-sm mb-2">
                  Glucose Reading (mg/dL)
                </label>
                <input
                  type="number"
                  value={glucoseReading}
                  onChange={(e) => setGlucoseReading(e.target.value)}
                  placeholder="Enter reading..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/20 border border-white/40 text-white placeholder-white/60 focus:outline-none focus:border-orange-300"
                />
              </div>

              <button
                onClick={logReading}
                disabled={!glucoseReading.trim()}
                className="w-full px-6 py-4 rounded-xl bg-orange-500/90 backdrop-blur-sm hover:bg-orange-600/90 text-white font-bold transition-all shadow-xl border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
                <span className="relative z-10">Log Reading</span>
              </button>
            </div>
          </section>

          {/* Enhanced Glass Current Status */}
          <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg">
                <Target className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-medium text-white">
                Current Status
              </h2>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="text-center">
                <div className="text-2xl font-medium text-white mb-2">
                  {currentReading} mg/dL
                </div>
                <div
                  className={`text-lg font-medium ${isInRange ? "text-green-200" : "text-red-200"}`}
                >
                  {isInRange ? "✅ In Target Range" : "⚠️ Outside Target Range"}
                </div>
              </div>

              <div className="bg-amber-500/20 backdrop-blur-sm rounded-xl p-4 border border-amber-400/30">
                <div className="text-white font-medium mb-2">Target Range</div>
                <div className="text-white/90">
                  {targetRange.min} - {targetRange.max} mg/dL
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Enhanced Glass Recent Readings */}
        <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-white shadow-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-medium text-white">
              Recent Readings
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {readings.map((reading, index) => {
              const inRange =
                reading.value >= targetRange.min &&
                reading.value <= targetRange.max;
              return (
                <div
                  key={index}
                  className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-4 border border-yellow-400/30"
                >
                  <div className="text-white font-medium mb-1">
                    {reading.date}
                  </div>
                  <div className="text-white/80 text-sm mb-2">
                    {reading.time} • {reading.type}
                  </div>
                  <div
                    className={`text-lg font-medium ${inRange ? "text-green-200" : "text-red-200"}`}
                  >
                    {reading.value} mg/dL
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Enhanced Glass Meal Recommendations */}
        <section className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-medium text-white">
              Diabetes-Friendly Meal Recommendations
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative z-10">
            <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30">
              <h3 className="text-white font-medium text-md mb-3">
                Low-Carb Options
              </h3>
              <ul className="text-white/90 space-y-2">
                <li>• Grilled salmon with vegetables</li>
                <li>• Chicken salad with avocado</li>
                <li>• Cauliflower rice stir-fry</li>
              </ul>
            </div>

            <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30">
              <h3 className="text-white font-medium text-md mb-3">
                Balanced Meals
              </h3>
              <ul className="text-white/90 space-y-2">
                <li>• Quinoa bowl with lean protein</li>
                <li>• Sweet potato with black beans</li>
                <li>• Greek yogurt with berries</li>
              </ul>
            </div>

            <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30">
              <h3 className="text-white font-medium text-md mb-3">Snack Ideas</h3>
              <ul className="text-white/90 space-y-2">
                <li>• Apple slices with almond butter</li>
                <li>• Mixed nuts and seeds</li>
                <li>• Celery with cream cheese</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 text-center relative z-10">
            <button
              onClick={() => setLocation("/diabetic-menu-builder")}
              className="px-8 py-4 rounded-xl bg-orange-500/90 backdrop-blur-sm hover:bg-orange-600/90 text-white font-semi-bold transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border border-white/20 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
              <span className="relative z-10">Generate Custom Diabetic Meal Plan →</span>
            </button>
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
