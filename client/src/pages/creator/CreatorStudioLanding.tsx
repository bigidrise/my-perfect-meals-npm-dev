import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ChefHat, Droplets, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";

export default function CreatorStudioLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Creator Studio — My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-orange-950/20 to-black pb-24"
    >
      <div className="px-6 pt-12 max-w-lg mx-auto">

        <button
          onClick={() => setLocation("/lifestyle")}
          className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 mb-5">
            <ChefHat className="h-7 w-7 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Creator Studio</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            We build a custom system inside My Perfect Meals — your style, your identity, your audience.
          </p>
        </div>

        <div className="space-y-4 mb-10">

          {/* Chef Studio */}
          <div className="rounded-2xl border border-orange-500/30 bg-orange-950/20 backdrop-blur p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0">
                <ChefHat className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Chef Studio</h2>
                <p className="text-orange-300/70 text-xs">Full custom build</p>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              Turn your cooking identity into a system your audience can actually use. Your techniques, flavor philosophy, and style shape every meal generated under your name.
            </p>
            <div className="space-y-1.5 mb-5">
              {[
                "Your studio name appears above the platform sections",
                "Your cooking techniques & flavors power the AI",
                "Your signature meal catalog for your audience",
                "Product code gives your community access to your system",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/70 text-xs">{item}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-4 mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-white font-bold text-xl">$2,500</span>
                <span className="text-white/50 text-sm">full build</span>
              </div>
              <p className="text-orange-300/70 text-xs mt-1">$1,250 deposit to start · $1,250 on delivery</p>
            </div>
            <button
              onClick={() => setLocation("/creator/start")}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold text-sm transition-colors"
            >
              Apply for Chef Studio
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Brand Beverage Studio */}
          <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20 flex-shrink-0">
                <Droplets className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Brand Beverage Studio</h2>
                <p className="text-blue-300/70 text-xs">Product integration layer</p>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              Put your branded products inside the beverage and supplement experience. Your product names replace the generics — your audience sees your brand at every recommendation.
            </p>
            <div className="space-y-1.5 mb-5">
              {[
                "Your product names in beverage recipes and the builder",
                "Branded supplement recommendations throughout",
                "Your labels replace generic ingredient names",
                "Faster setup — no deep kitchen build required",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/70 text-xs">{item}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-4 mb-4">
              <p className="text-white/50 text-sm">Custom pricing</p>
              <p className="text-white/40 text-xs mt-0.5">Contact us for a quote</p>
            </div>
            <button
              onClick={() => window.location.href = "mailto:partnerships@myperfectmeals.com?subject=Brand%20Beverage%20Studio%20Inquiry"}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-semibold text-sm transition-colors border border-white/20"
            >
              Get in Touch
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-white/30 text-xs leading-relaxed">
            Every Creator Studio is reviewed and built by our team. Applications are not automatically activated — we contact you within 2–3 business days to confirm and collect your deposit.
          </p>
        </div>

      </div>
    </motion.div>
  );
}
