import React from "react";
import {
  Heart,
  Zap,
  Leaf,
  Shield,
  ChefHat,
  ArrowRight,
  UtensilsCrossed,
  Coffee,
  Quote,
  Flame
} from "lucide-react";

export function KitchenLanding() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans overflow-x-hidden selection:bg-orange-500/30">
      {/* 1. Hero Section */}
      <section className="relative pt-24 pb-16 px-6 sm:px-8 flex flex-col items-center text-center">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/__mockup/images/southern-kitchen-bg.png"
            alt="Southern Comfort Kitchen"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f0f]/40 via-[#0f0f0f]/80 to-[#0f0f0f]"></div>
          <div className="absolute inset-0 bg-orange-500/10 mix-blend-overlay"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto">
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/70 backdrop-blur-md">
            <Zap size={12} className="text-orange-500" />
            Powered by My Perfect Meals AI
          </div>

          <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-orange-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
            <img
              src="/__mockup/images/chef-nolan-avatar.png"
              alt="Chef David Nolan"
              className="w-32 h-32 rounded-full border-4 border-orange-500 object-cover relative z-10 shadow-2xl"
            />
            <div className="absolute -bottom-3 -right-3 bg-[#0f0f0f] p-2 rounded-full border border-white/10 z-20">
              <ChefHat size={20} className="text-orange-500" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white mb-2 tracking-tight">
            Chef Nolan's Kitchen
          </h1>
          <p className="text-lg text-orange-400 font-medium mb-4">
            Executive Chef David Nolan
          </p>
          <p className="text-lg sm:text-xl text-white/80 max-w-xl mx-auto mb-10 leading-relaxed">
            Elevated Southern comfort, reimagined for your nutrition goals
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

      {/* 2. "Your Kitchen Adapts To You" section */}
      <section className="py-12 px-6 sm:px-8 max-w-4xl mx-auto relative z-10">
        <div className="mb-8 text-center sm:text-left">
          <h2 className="text-2xl font-bold mb-2">Your Kitchen Adapts To You</h2>
          <p className="text-white/60">
            Chef's signature style, perfectly tailored to your dietary needs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Heart size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Diabetic-Friendly</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Chef's techniques adapted for blood sugar balance
            </p>
          </div>
          
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Zap size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">High-Protein</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Macro-optimized versions of signature dishes
            </p>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Leaf size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Anti-Inflammatory</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Southern comfort without inflammatory triggers
            </p>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="bg-orange-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20">
              <Shield size={24} className="text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">GLP-1 Support</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Portion and satiety adapted for your medication
            </p>
          </div>
        </div>
      </section>

      {/* 3. Featured Tools section */}
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
                Generate a custom recipe using Chef Nolan's flavor profiles
              </p>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto">
              Launch
            </button>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="bg-orange-500/10 w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border border-orange-500/20">
              <Flame size={26} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Dessert Creator</h3>
              <p className="text-white/60 text-sm">
                Guilt-free Southern sweets and baked goods
              </p>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto">
              Launch
            </button>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-start sm:items-center opacity-60">
            <div className="bg-white/5 w-14 h-14 shrink-0 rounded-xl flex items-center justify-center border border-white/10">
              <Coffee size={26} className="text-white/40" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Beverage Creator</h3>
              <p className="text-white/40 text-sm">
                Sweet teas, lemonades, and zero-proof cocktails
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 border border-white/5">
              Coming Soon
            </div>
          </div>
        </div>
      </section>

      {/* 4. Signature Recipes carousel/grid */}
      <section className="py-12 px-6 sm:px-8 max-w-5xl mx-auto relative z-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Signature Recipes</h2>
            <p className="text-white/60">Classics from Chef Nolan's repertoire</p>
          </div>
          <button className="text-orange-500 text-sm font-medium flex items-center gap-1 hover:text-orange-400">
            View All <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recipe 1 */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col group">
            <div className="h-48 relative overflow-hidden bg-[#1a1a1a]">
              <img
                src="/__mockup/images/brisket-mac.png"
                alt="Smoked Brisket Mac & Cheese"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium border border-white/10">
                Southern Comfort
              </div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="text-lg font-bold mb-3 leading-snug">Smoked Brisket Mac & Cheese</h3>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  45g Protein
                </div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  32g Carbs
                </div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  18g Fat
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/5">
                <button className="w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 hover:border-orange-500 py-2.5 rounded-lg text-sm font-semibold transition-all">
                  Cook This
                </button>
              </div>
            </div>
          </div>

          {/* Recipe 2 */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col group">
            <div className="h-48 relative overflow-hidden bg-[#1a1a1a]">
              <img
                src="/__mockup/images/glazed-salmon.png"
                alt="Peach Bourbon Glazed Salmon"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium border border-white/10">
                Anti-Inflammatory
              </div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="text-lg font-bold mb-3 leading-snug">Peach Bourbon Glazed Salmon</h3>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  38g Protein
                </div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  24g Carbs
                </div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  22g Fat
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/5">
                <button className="w-full bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 hover:border-orange-500 py-2.5 rounded-lg text-sm font-semibold transition-all">
                  Cook This
                </button>
              </div>
            </div>
          </div>

          {/* Recipe 3 */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col group">
            <div className="h-48 relative overflow-hidden bg-[#1a1a1a]">
              <img
                src="/__mockup/images/cornbread.png"
                alt="Cast Iron Cornbread Skillet"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium border border-white/10">
                Side Dish
              </div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="text-lg font-bold mb-3 leading-snug">Cast Iron Cornbread Skillet</h3>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  8g Protein
                </div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  42g Carbs
                </div>
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/70">
                  14g Fat
                </div>
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

      {/* 5. Chef's Philosophy quote */}
      <section className="py-20 px-6 sm:px-8 mt-8 border-t border-white/5 relative bg-black/20">
        <div className="max-w-3xl mx-auto text-center relative">
          <Quote className="text-white/5 mx-auto mb-6 w-20 h-20 rotate-180" />
          <p className="text-2xl sm:text-3xl font-serif text-white/90 leading-tight mb-8">
            "Great food doesn't need to choose between soul and science. Every dish I create is built to nourish your body without sacrificing an ounce of flavor."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-[1px] bg-orange-500/50"></div>
            <p className="text-orange-500 font-medium tracking-wide uppercase text-sm">Chef David Nolan</p>
            <div className="w-10 h-[1px] bg-orange-500/50"></div>
          </div>
        </div>
      </section>
    </div>
  );
}
