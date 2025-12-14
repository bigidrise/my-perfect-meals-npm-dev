
import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Pill, GraduationCap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SupplementFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
}

export default function SupplementHubLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Supplement Hub | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const supplementFeatures: SupplementFeature[] = [
    {
      title: "Supplement Hub",
      description: "Browse curated supplement partners and products",
      icon: Pill,
      route: "/supplement-hub",
      testId: "card-supplement-hub",
    },
    {
      title: "Supplement Education",
      description: "Learn about supplements with AI guidance and evidence-based information",
      icon: GraduationCap,
      route: "/supplement-education",
      testId: "card-supplement-education",
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
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">   
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setLocation("/procare-cover")}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              data-testid="button-back-to-procare"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Pill className="h-6 w-6 text-orange-400" />
              <h1 className="text-xl font-bold text-white">Supplement Hub</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Info Banner */}
          <div className="rounded-2xl p-[1px] bg-gradient-to-r from-orange-500/50 via-orange-500/40 to-orange-500/50 animate-pulse">
            <div className="rounded-2xl bg-orange-900/20 backdrop-blur-lg px-4 py-3 border border-orange-500/30">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-orange-300 font-semibold text-sm mb-1">Supplement Resources</div>
                  <div className="text-white/80 text-sm">
                    Browse trusted supplement partners and learn about evidence-based supplementation. Click any card below to get started.
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Hero Image Section */}
          <div className="relative h-40 rounded-xl overflow-hidden">
            <img 
              src="/images/supplements/supplement-hero.jpg" 
              alt="Supplement Hub"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f97316;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%23ea580c;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='160' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='20' font-family='sans-serif' dy='.3em'%3ESupplement Hub%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white/90 text-sm">
                Evidence-based supplement guidance and trusted partner products
              </p>
            </div>
          </div>

          {/* Supplement Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {supplementFeatures.map((feature) => {
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
}
