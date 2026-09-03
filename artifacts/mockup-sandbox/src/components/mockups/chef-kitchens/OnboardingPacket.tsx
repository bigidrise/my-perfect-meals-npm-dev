import React from 'react';
import { ChefHat, Sparkles, Users, Check, Upload, Calendar, Star, ArrowRight } from 'lucide-react';

export function OnboardingPacket() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-neutral-100 font-sans selection:bg-orange-500/30 pb-32">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 space-y-24">
        
        {/* Header */}
        <header className="text-center space-y-6">
          <div className="inline-block border border-orange-500/30 px-4 py-1.5 rounded-full text-xs tracking-widest text-orange-400 uppercase font-medium mb-4 bg-orange-500/5">
            My Perfect Meals
          </div>
          <h1 className="text-4xl md:text-6xl font-serif tracking-tight text-[#fdfbf7]">
            Chef Partnership Program
          </h1>
          <p className="text-xl md:text-2xl text-white/60 font-serif italic max-w-2xl mx-auto">
            Your culinary identity, scaled digitally.
          </p>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent mx-auto mt-12" />
        </header>

        {/* Section 1: What is a Chef Kitchen? */}
        <section className="space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h2 className="text-2xl md:text-3xl font-serif text-amber-50">What is a Chef Kitchen?</h2>
            <p className="text-lg md:text-xl leading-relaxed text-white/70 font-light">
              A Chef Kitchen is your own branded space inside My Perfect Meals — where your culinary style, recipes, and personality shape every dish our AI generates for your fans and followers. <span className="text-white font-medium">Your name. Your flavors. Your legacy.</span>
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <ChefHat className="w-8 h-8 text-orange-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-medium text-amber-50">Your Identity</h3>
              <p className="text-sm text-white/50">Your brand, voice, and visual style front and center.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <Sparkles className="w-8 h-8 text-orange-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-medium text-amber-50">AI Powered</h3>
              <p className="text-sm text-white/50">Trained exclusively on your techniques and flavor profiles.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <Users className="w-8 h-8 text-orange-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-medium text-amber-50">Your Audience</h3>
              <p className="text-sm text-white/50">Connect directly with fans who want to eat like you cook.</p>
            </div>
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Section 2: What We Build For You */}
        <section className="space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-serif text-amber-50">What We Build For You</h2>
            <p className="text-white/60">Everything you need to launch a digital culinary presence, handled by our team.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 max-w-3xl mx-auto">
            {[
              "Branded kitchen page with your photo, bio, and tagline",
              "AI trained on your cooking style, techniques, and flavor profile",
              "Your signature recipes featured and AI-adaptable",
              "All dietary restrictions respected automatically (diabetic, GLP-1, anti-inflammatory, etc.)",
              "Featured placement on the Lifestyle page",
              "Powered by My Perfect Meals' clinical nutrition engine",
              "Shopping list integration for your recipes",
              "Optional: Seasonal drops, premium content, branded challenges"
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-orange-400" strokeWidth={3} />
                </div>
                <p className="text-white/80 leading-relaxed">{feature}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Section 3: What We Need From You */}
        <section className="space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-serif text-amber-50">What We Need From You</h2>
            <p className="text-white/60">The raw ingredients to train your AI and build your kitchen.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Identity */}
            <div className="space-y-6 bg-white/[0.01] p-8 rounded-3xl border border-white/[0.05]">
              <h3 className="text-xl font-serif text-orange-400 border-b border-white/10 pb-4">1. Your Identity</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Kitchen Name</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm">Chef Nolan's Kitchen</div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Full Name & Title</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm">Nolan Smith, Executive Chef</div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Tagline</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm">Bold flavors, wood-fired finishes, unpretentious dining.</div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Short Bio</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm h-24">Tell us your culinary story in 2-3 sentences...</div>
                </div>
              </div>
            </div>

            {/* Culinary Style */}
            <div className="space-y-6 bg-white/[0.01] p-8 rounded-3xl border border-white/[0.05]">
              <h3 className="text-xl font-serif text-orange-400 border-b border-white/10 pb-4">2. Your Culinary Style</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Primary Techniques</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm">e.g., smoking, braising, pastry...</div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Flavor Profile</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm">e.g., bold, delicate, bright, comfort...</div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Signature Ingredients</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm h-20">List ingredients you're known for...</div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Forbidden Words</label>
                  <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/40 text-sm">Words you'd NEVER use to describe your food...</div>
                </div>
              </div>
            </div>

            {/* Recipes & Assets */}
            <div className="space-y-6 bg-white/[0.01] p-8 rounded-3xl border border-white/[0.05]">
              <h3 className="text-xl font-serif text-orange-400 border-b border-white/10 pb-4">3. Recipes & Assets</h3>
              <div className="space-y-6">
                <div className="bg-black/40 border border-orange-500/30 border-dashed rounded-xl p-6 text-center space-y-3">
                  <Upload className="w-6 h-6 text-orange-400 mx-auto" />
                  <p className="text-sm text-white/80">Upload Spreadsheet, PDF, or Google Doc</p>
                  <p className="text-xs text-white/50">"We handle the import — you just send us what you have"</p>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">Professional Headshot</span>
                    <span className="text-orange-400 text-xs px-2 py-1 bg-orange-500/10 rounded">Required</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">Restaurant Photos</span>
                    <span className="text-white/30 text-xs px-2 py-1 bg-white/5 rounded">Optional</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">Logo / Wordmark</span>
                    <span className="text-white/30 text-xs px-2 py-1 bg-white/5 rounded">Optional</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tools */}
            <div className="space-y-6 bg-white/[0.01] p-8 rounded-3xl border border-white/[0.05]">
              <h3 className="text-xl font-serif text-orange-400 border-b border-white/10 pb-4">4. Tools to Activate</h3>
              <p className="text-sm text-white/60 mb-4">Select which AI creator tools should be available in your kitchen.</p>
              <div className="flex flex-wrap gap-3">
                <div className="px-5 py-2.5 rounded-full bg-orange-500 text-white text-sm font-medium flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                  <Check className="w-4 h-4" /> Create a Dish
                </div>
                <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors cursor-pointer">
                  Dessert Creator
                </div>
                <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors cursor-pointer">
                  Beverage Creator
                </div>
                <div className="px-5 py-2.5 rounded-full bg-orange-500 text-white text-sm font-medium flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                  <Check className="w-4 h-4" /> Meal Planner
                </div>
              </div>
            </div>

          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Section 4: Launch Timeline */}
        <section className="space-y-12 max-w-3xl mx-auto">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-serif text-amber-50">Your Launch Timeline</h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-white/10" />
            
            <div className="space-y-10">
              {[
                { step: "Step 1", title: "Onboarding Call (30 min)", desc: "We walk through your style, goals, and vision", icon: Calendar },
                { step: "Step 2", title: "Kitchen Setup (3-5 days)", desc: "We configure your AI profile and import your recipes", icon: ChefHat },
                { step: "Step 3", title: "Review & Refine (1-2 days)", desc: "You review sample outputs and we fine-tune", icon: Sparkles },
                { step: "Step 4", title: "Launch Day", desc: "Your kitchen goes live to all MPM users", icon: Star, highlight: true }
              ].map((item, idx) => (
                <div key={idx} className="relative flex items-start gap-8">
                  <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${item.highlight ? 'bg-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.4)]' : 'bg-[#1a1a1a] border border-white/20'}`}>
                    <item.icon className={`w-6 h-6 ${item.highlight ? 'text-white' : 'text-orange-400'}`} />
                  </div>
                  <div className="pt-2 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-orange-400">{item.step}</p>
                    <h4 className={`text-lg font-medium ${item.highlight ? 'text-amber-50' : 'text-white/90'}`}>{item.title}</h4>
                    <p className="text-white/60">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-16 pb-8 text-center space-y-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 mb-4">
            <img src="/icons/MPMFlameChefLogo.png" alt="MPM" className="w-10 h-10 opacity-50 grayscale mix-blend-screen" onError={(e) => e.currentTarget.style.display = 'none'} />
            {/* Fallback if image fails */}
            <ChefHat className="w-8 h-8 text-white/30 absolute" />
          </div>
          <h2 className="text-3xl md:text-4xl font-serif text-amber-50">Ready to build your kitchen?</h2>
          <button className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-medium transition-all inline-flex items-center gap-3">
            Let's talk <ArrowRight className="w-5 h-5" />
          </button>
          <div className="pt-12 text-sm text-white/40 tracking-widest uppercase">
            My Perfect Meals Partner Program
          </div>
        </footer>

      </div>
    </div>
  );
}
