import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Baby, Users } from "lucide-react";

interface KidsFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  gradient: string;
  testId: string;
}

export default function HealthyKidsMeals() {
  const [, setLocation] = useLocation();
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    document.title = "Healthy Kids Meals | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const kidsFeatures: KidsFeature[] = [
    {
      title: "Kids Meals",
      description: "21 predesigned healthy meals your kids will love",
      icon: Baby,
      route: "/kids-meals",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "card-kids-meals",
    },
    {
      title: "Toddler Meals",
      description: "Soft textures and veggie-smart ideas for toddlers (1-3)",
      icon: Users,
      route: "/toddler-meals",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "card-toddler-meals",
    },
  ];

  const handleCardClick = (route: string) => {
    setLocation(route);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav flex flex-col"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Healthy Kids Meals</h1>

          
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero Image Section */}
          <div className="relative h-40 rounded-xl overflow-hidden">
            <img 
              src="/images/kids-meals/happy-kids-eating.jpg" 
              alt="Happy kids eating"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2310b981;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%233b82f6;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='160' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='20' font-family='sans-serif' dy='.3em'%3EKids Love It!%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white/90 text-sm">
                Nutritious meals designed for little ones — they'll actually eat them!
              </p>
            </div>
          </div>
          {/* Kids Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {kidsFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.testId}
                  className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl shadow-md"
                  onClick={() => handleCardClick(feature.route)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-white flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-white">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-xs text-white/80 ml-6">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">How to Use Healthy Kids Meals</h2>
            <div className="space-y-3 text-white/90 text-sm mb-6">
              <p>
                <strong>1. Choose Your Category:</strong> Select between Kids Meals (ages 4-12) or Toddler Meals (ages 1-3).
              </p>
              <p>
                <strong>2. Browse Recipes:</strong> Each category has nutritious, kid-friendly meals designed for different age groups.
              </p>
              <p>
                <strong>3. Scale Servings:</strong> Adjust recipes to feed the right number of kids.
              </p>
              <p>
                <strong>4. Add to Shopping:</strong> Ingredients automatically scale and can be added to your shopping list.
              </p>
              <p className="text-lime-400 font-medium mt-4">
                💡 Tip: All meals are designed with balanced nutrition and fun presentations kids will love!
              </p>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
