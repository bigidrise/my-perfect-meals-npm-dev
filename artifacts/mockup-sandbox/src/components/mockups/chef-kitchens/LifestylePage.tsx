import React from 'react';
import { ChefHat, Star, Lock, ArrowRight, Utensils, Sparkles, Wine, Search, User, Flame, Droplet, Coffee } from 'lucide-react';

export function LifestylePage() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center font-sans">
      {/* Mobile container constraint */}
      <div className="w-full max-w-[390px] bg-[#121212] min-h-screen pb-20 overflow-x-hidden border-x border-white/5 relative">
        
        {/* Subtle top gradient */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-orange-600/10 to-transparent pointer-events-none" />

        {/* Page Header */}
        <div className="pt-12 px-6 pb-6 relative z-10">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Lifestyle</h1>
          <p className="text-white/60 text-sm flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            AI-powered experiences
          </p>
        </div>

        {/* Partner Kitchens Section */}
        <div className="mb-10 relative z-10">
          <div className="px-6 mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
              Featured Kitchens
            </h2>
            <span className="text-xs text-white/40 font-medium tracking-wide uppercase">New</span>
          </div>

          {/* Horizontal Scroll Row */}
          <div className="flex overflow-x-auto gap-4 px-6 pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            
            {/* Card 1: Chef Nolan */}
            <div className="min-w-[280px] snap-center bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/20 blur-3xl rounded-full -mr-10 -mt-10" />
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-full border-2 border-orange-500/50 bg-gradient-to-br from-orange-900/60 to-black flex items-center justify-center">
                  <ChefHat size={22} className="text-orange-400" />
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Live
                </div>
              </div>

              <div className="relative z-10 mb-4">
                <h3 className="text-xl font-bold mb-1">Chef Nolan's Kitchen</h3>
                <p className="text-sm text-white/60">Elevated Southern comfort, reimagined</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                <span className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/80">Southern</span>
                <span className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/80">Comfort</span>
                <span className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/80">Soulful</span>
              </div>

              <div className="mt-auto space-y-3 relative z-10">
                <div className="flex gap-2">
                  <div className="text-[10px] font-medium bg-orange-500/10 text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                    <Utensils className="w-3 h-3" /> Create a Dish
                  </div>
                  <div className="text-[10px] font-medium bg-orange-500/10 text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                    <Coffee className="w-3 h-3" /> Dessert Creator
                  </div>
                </div>
                
                <button className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 transition-all text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                  Enter Kitchen <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card 2: Chef Rush */}
            <div className="min-w-[280px] snap-center bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/20 blur-3xl rounded-full -mr-10 -mt-10" />
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-full border-2 border-orange-500/50 overflow-hidden">
                  <img src="/__mockup/chef-rush.jpg" alt="Chef Rush" className="w-full h-full object-cover object-top" />
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Live
                </div>
              </div>

              <div className="relative z-10 mb-4">
                <h3 className="text-xl font-bold mb-1">Rush Performance</h3>
                <p className="text-sm text-white/60">Fuel built for elite athletes</p>
              </div>

              <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                <span className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/80">Performance</span>
                <span className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/80">High-Protein</span>
                <span className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white/80">Clean</span>
              </div>

              <div className="mt-auto space-y-3 relative z-10">
                <div className="flex gap-2">
                  <div className="text-[10px] font-medium bg-orange-500/10 text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                    <Utensils className="w-3 h-3" /> Create a Dish
                  </div>
                  <div className="text-[10px] font-medium bg-orange-500/10 text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                    <Droplet className="w-3 h-3" /> Beverage Creator
                  </div>
                </div>
                
                <button className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 transition-all text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                  Enter Kitchen <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card 3: Coming Soon */}
            <div className="min-w-[280px] snap-center bg-black/20 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-white/40" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-white/60">More Kitchens</h3>
              <p className="text-sm text-white/40 mb-6">New chef partners are cooking up something special.</p>
              
              <div className="bg-white/5 border border-white/10 text-white/50 text-xs px-4 py-2 rounded-lg font-medium">
                Coming Soon
              </div>
            </div>

          </div>
        </div>

        {/* Existing Features Section */}
        <div className="px-6 relative z-10">
          <h2 className="text-lg font-semibold mb-4 text-white/90">More Experiences</h2>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Feature 1 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center mb-3">
                <Utensils className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Create a Dish</h3>
              <p className="text-xs text-white/40">AI recipe generation</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Cravings Hub</h3>
              <p className="text-xs text-white/40">Sushi & Desserts</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center mb-3">
                <Droplet className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Beverage Creator</h3>
              <p className="text-xs text-white/40">Custom drinks</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center mb-3">
                <Wine className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Spirit & Wine</h3>
              <p className="text-xs text-white/40">Expert pairings</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center mb-3">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Fridge Rescue</h3>
              <p className="text-xs text-white/40">Use what you have</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center mb-3">
                <User className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Socializing Hub</h3>
              <p className="text-xs text-white/40">Share and connect</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
