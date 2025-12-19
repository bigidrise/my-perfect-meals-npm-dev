import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Activity, Pill, Trophy, ListChecks } from "lucide-react";

interface PlannerFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
}

export default function Planner() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Planner | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const plannerFeatures: PlannerFeature[] = [
    {
      title: "My Weekly Meal Builder",
      description:
        "AI generated meal plans for users that want to eat healthier meals their way",
      icon: Calendar,
      route: "/weekly-meal-board",
      testId: "card-weekly-meal-board",
    },
    {
      title: "Diabetic Hub and Meal Builder",
      description:
        "Blood sugar monitoring and meal AI created meal plans for diabetics",
      icon: Activity,
      route: "/diabetic-hub",
      testId: "card-diabetic-hub",
    },
    {
      title: "GLP-1 Hub and Meal Builder",
      description:
        "Shot, location logging and specialized AI created meal plans for GLP-1 users",
      icon: Pill,
      route: "/glp1-hub",
      testId: "card-glp1-hub",
    },
    {
      title: "Anti-Inflammatory Meal Builder",
      description:
        "Autoimmune support, joint relief, inflammation guardrails with AI created meal plans",
      icon: Pill,
      route: "/anti-inflammatory-menu-builder",
      testId: "card-anti-inflammatory",
    },
    {
      title: "Beach Body Meal Builder",
      description:
        "Contest prep and leaning out AI created meal plans designed for rapid change",
      icon: Trophy,
      route: "/beach-body-meal-board",
      testId: "card-competition-beachbody",
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
      className="min-h-full bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav flex flex-col"
    >
          {/* Header Banner - Planner */}
          <div
            className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
            style={{ top: "env(safe-area-inset-top, 0px)" }}
          >
              <div className="px-8 py-3 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-orange-500" />
              <h1 className="text-lg font-bold text-white">Planner</h1>
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
                  src="/images/planner-hero.jpg"
                  alt="Medical meal planning"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2314b8a6;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%233b82f6;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3EPlanner%3C/text%3E%3C/svg%3E";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-2xl font-bold text-white mb-1"></h2>
                  <p className="text-white/90 text-sm">
                    Tailored meal planning for your specific health needs and goals.
                  </p>
                </div>
              </div>

              {/* Planner Features - Vertical Stack */}
              <div className="flex flex-col gap-3">
                {plannerFeatures.map((feature) => {
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
