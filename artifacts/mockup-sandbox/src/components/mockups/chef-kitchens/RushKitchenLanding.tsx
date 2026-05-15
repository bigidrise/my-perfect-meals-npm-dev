import React from "react";
import {
  Zap,
  Dumbbell,
  Flame,
  Shield,
  ArrowRight,
  UtensilsCrossed,
  Droplet,
  Quote,
  Trophy,
  ChefHat,
} from "lucide-react";

export function RushKitchenLanding() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans overflow-x-hidden selection:bg-orange-500/30">
      {/* 1. Hero Section */}
      <section className="relative pt-24 pb-16 px-6 sm:px-8 flex flex-col items-center text-center">
        {/* Background & Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-black via-[#1a0a00] to-black" />
          <div className="absolute inset-0 bg-orange-500/5 mix-blend-overlay" />
        </div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto">
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/70 backdrop-blur-md">
            <Zap size={12} className="text-orange-500" />
            Powered by My Perfect Meals AI
          </div>

          {/* Chef Photo */}
          <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-orange-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="w-32 h-32 rounded-full border-4 border-orange-500 relative z-10 shadow-2xl overflow-hidden">
              <img
                src="/__mockup/chef-rush.jpg"
                alt="Chef Rush"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="absolute -bottom-3 -right-3 bg-[#0f0f0f] p-2 rounded-full border border-white/10 z-20">
              <ChefHat size={20} className="text-orange-500" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white mb-2 tracking-tight">
            Chef Rush's Kitchen
          </h1>
          <p className="text-lg text-orange-400 font-medium mb-4">
            Chef Andre Rush — Performance Nutrition Expert
          </p>
          <p className="text-lg sm:text-xl text-white/80 max-w-xl mx-auto mb-10 leading-relaxed">
            Elite performance fuel, engineered for athletes who refuse to compromise on flavor
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold transition-all active:scale-95 shadow-lg shadow-orange-500/25">
              <UtensilsCrossed size={20} />
              Create a Dish
            </button>
            <button className="flex items-center justify-center gap-2 bg-transparent border border-white/20 hover:bg-white/5 text-white px-8 py-4 rounded-xl font-semibold transition-all active:scale-95">
              View Recipes
            </button>
          </div>
        </div>
      </section>

      {/* 2. "Your Kitchen Adapts To You" */}
      <section className="py-12 px-6 sm:px-8 max-w-4xl mx-auto relative z-10">
        <div className="mb-8 text-center sm:text-left">
          <h2 className="text-2xl font-bold mb-2">Built for Peak Performance</h2>
          <p className="text-white/60">
            Chef Rush's training-room recipes, adapted to your body's exact needs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Dumbbell size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Muscle Building</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              High-protein meals calibrated for hypertrophy and recovery
            </p>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Zap size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Pre & Post Workout</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Timing-optimized meals for energy, power, and rapid recovery
            </p>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Flame size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Fat Loss</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Caloric deficit meals that keep you satiated and performing
            </p>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Shield size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Clean & GLP-1</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Whole-food macros adapted for GLP-1 medication support
            </p>
          </div>
        </div>
      </section>

      {/* 3. Creator Tools */}
      <section className="py-12 px-6 sm:px-8 max-w-4xl mx-auto relative z-10">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Creator Tools</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="bg-orange-500/10 w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border border-orange-500/20">
              <UtensilsCrossed size={26} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Create a Dish</h3>
              <p className="text-white/60 text-sm">
                Generate a custom recipe using Chef Rush's performance profiles
              </p>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto">
              Launch
            </button>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="bg-orange-500/10 w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border border-orange-500/20">
              <Droplet size={26} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Beverage Creator</h3>
              <p className="text-white/60 text-sm">
                Protein shakes, pre-workout drinks, and recovery hydration
              </p>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto">
              Launch
            </button>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="bg-orange-500/10 w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border border-orange-500/20">
              <Trophy size={26} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Meal Planner</h3>
              <p className="text-white/60 text-sm">
                Full weekly performance nutrition plans built around your training schedule
              </p>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto">
              Launch
            </button>
          </div>
        </div>
      </section>

      {/* 4. Signature Recipes */}
      <section className="py-12 px-6 sm:px-8 max-w-5xl mx-auto relative z-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Signature Recipes</h2>
            <p className="text-white/60">Performance staples from Chef Rush's playbook</p>
          </div>
          <button className="text-orange-500 text-sm font-medium flex items-center gap-1 hover:text-orange-400">
            View All <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recipe 1 */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
            <div className="h-48 bg-gradient-to-br from-orange-900/40 to-black flex items-center justify-center relative">
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium border border-white/10">
                High-Protein
              </div>
              <div className="text-6xl">🥩</div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="text-lg font-bold mb-3 leading-snug">Smashed Beef & Sweet Potato Bowl</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">62g Protein</div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">48g Carbs</div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">14g Fat</div>
              </div>
              <div className="mt-auto pt-4 border-t border-white/5">
                <button className="w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 hover:border-orange-500 py-2.5 rounded-lg text-sm font-semibold transition-all">
                  Cook This
                </button>
              </div>
            </div>
          </div>

          {/* Recipe 2 */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
            <div className="h-48 bg-gradient-to-br from-orange-900/40 to-black flex items-center justify-center relative">
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium border border-white/10">
                Recovery
              </div>
              <div className="text-6xl">🍗</div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="text-lg font-bold mb-3 leading-snug">Grilled Chicken & Quinoa Power Plate</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">55g Protein</div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">52g Carbs</div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">10g Fat</div>
              </div>
              <div className="mt-auto pt-4 border-t border-white/5">
                <button className="w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 hover:border-orange-500 py-2.5 rounded-lg text-sm font-semibold transition-all">
                  Cook This
                </button>
              </div>
            </div>
          </div>

          {/* Recipe 3 */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
            <div className="h-48 bg-gradient-to-br from-orange-900/40 to-black flex items-center justify-center relative">
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium border border-white/10">
                Pre-Workout
              </div>
              <div className="text-6xl">🥚</div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="text-lg font-bold mb-3 leading-snug">Six-Egg White Skillet with Oats</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">48g Protein</div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">60g Carbs</div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">6g Fat</div>
              </div>
              <div className="mt-auto pt-4 border-t border-white/5">
                <button className="w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 hover:border-orange-500 py-2.5 rounded-lg text-sm font-semibold transition-all">
                  Cook This
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Chef's Philosophy */}
      <section className="py-20 px-6 sm:px-8 mt-8 border-t border-white/5 relative bg-black/20">
        <div className="max-w-3xl mx-auto text-center relative">
          <Quote className="text-white/5 mx-auto mb-6 w-20 h-20 rotate-180" />
          <p className="text-2xl sm:text-3xl font-serif text-white/90 leading-tight mb-8">
            "I've cooked for presidents and trained like a champion. Food is the original performance drug — and I'm here to make sure yours works as hard as you do."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-[1px] bg-orange-500/50" />
            <p className="text-orange-500 font-medium tracking-wide uppercase text-sm">Chef Andre Rush</p>
            <div className="w-10 h-[1px] bg-orange-500/50" />
          </div>
        </div>
      </section>
    </div>
  );
}
