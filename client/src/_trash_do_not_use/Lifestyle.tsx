
import React from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Sparkles, Brain, UtensilsCrossed, Wine, Baby, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Lifestyle = ({ user }: { user?: any }) => {
  const [, setLocation] = useLocation();

  const lifestyleFeatures = [
    {
      title: "Craving Creator",
      description: "Enjoy the foods you love without destroying your goals",
      icon: Brain,
      route: "/craving-creator-landing",
      testId: "lifestyle-craving-creator"
    },
    {
      title: "Fridge Rescue",
      description: "Turn what's in your kitchen into a meal",
      icon: UtensilsCrossed,
      route: "/fridge-rescue",
      testId: "lifestyle-fridge-rescue"
    },
    {
      title: "Socializing Hub",
      description: "Eat smart anywhere — by restaurant or food category",
      icon: UtensilsCrossed,
      route: "/social-hub",
      testId: "lifestyle-socializing-hub"
    },
    {
      title: "Kids & Toddler Meals",
      description: "Fast, simple, and healthy meals for young ones",
      icon: Baby,
      route: "/kids-meals",
      testId: "lifestyle-kids-meals"
    },
    {
      title: "Spirits & Lifestyle",
      description: "Drinks, date nights, and social living",
      icon: Wine,
      route: "/alcohol-hub-landing",
      testId: "lifestyle-spirits"
    },
    {
      title: "Supplement Hub",
      description: "Personalized supplement recommendations",
      icon: Activity,
      route: "/supplement-hub",
      testId: "lifestyle-supplement-hub"
    }
  ];

  const handleCardClick = (route: string) => {
    setLocation(route);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {/* Header Banner */}
      <div
        className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Lifestyle</h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero Image Section */}
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img 
              src="/images/lifestyle-hero.jpg" 
              alt="Lifestyle nutrition"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f97316;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%23ec4899;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3ELifestyle%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/90 text-sm">
                Navigate cravings, dining out, and social moments with AI-powered guidance.
              </p>
            </div>
          </div>

          {/* Lifestyle Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {lifestyleFeatures.map((feature) => {
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
                        <Icon className="h-4 w-4 text-orange-500 flex-shrink-0" />
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
    </motion.div>
  );
};

export default Lifestyle;
