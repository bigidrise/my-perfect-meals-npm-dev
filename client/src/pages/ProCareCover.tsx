import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, Stethoscope, Crown } from "lucide-react";

interface ProCareFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
  gradient: string;
}

export default function ProCareCover() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "ProCare | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const proCareFeatures: ProCareFeature[] = [
    {
      title: "Trainer Portal",
      description: "Performance coaching and athlete meal planning",
      icon: Dumbbell,
      route: "/procare/trainer",
      testId: "card-trainer-portal",
      gradient: "from-lime-600/20 to-green-600/20",
    },
    {
      title: "Physician Portal",
      description: "Clinical nutrition management for patients",
      icon: Stethoscope,
      route: "/procare/physician",
      testId: "card-physician-portal",
      gradient: "from-blue-600/20 to-indigo-600/20",
    },
    {
      title: "Supplement Hub",
      description: "Evidence-based supplement guidance and trusted partners",
      icon: Crown,
      route: "/supplement-hub",
      testId: "card-supplement-hub",
      gradient: "from-orange-600/20 to-amber-600/20",
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
      {/* Header Banner - ProCare */}
      <div
        className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
          <div className="px-8 py-3 flex items-center gap-3">
          <Crown className="h-6 w-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">ProCare</h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero Image Section */}
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img 
              src="/images/procare-hero.jpg" 
              alt="Professional coaching"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%238b5cf6;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%23ec4899;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3EProCare%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-bold text-white mb-1"></h2>
              <p className="text-white/90 text-sm">
                Empower your coaching practice with precision macro planning.
              </p>
            </div>
          </div>

          {/* ProCare Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {proCareFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.testId}
                  className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-gradient-to-br ${feature.gradient} backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl shadow-md`}
                  onClick={() => handleCardClick(feature.route)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/10">
                          <Icon className="h-5 w-5 text-white flex-shrink-0" />
                        </div>
                        <h3 className="text-base font-semibold text-white">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-sm text-white/80 ml-12">
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
