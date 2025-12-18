import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pill, Activity, TrendingUp } from "lucide-react";

export default function GLP1MealsTracking() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "GLP-1 Meals & Tracking | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 pb-20"
    >
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setLocation("/lifestyle")}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              data-testid="button-back-to-lifestyle"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Pill className="h-6 w-6 text-violet-400" />
              <h1 className="text-xl font-bold text-white">GLP-1 Meals & Tracking</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-black/30 backdrop-blur-lg border border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-400" />
              Specialized Meal Plans for GLP-1 Medications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-white/80 space-y-3">
              <p className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0" />
                <span>Meal timing optimized for your medication schedule</span>
              </p>
              <p className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0" />
                <span>Portion-controlled meals to support your weight management goals</span>
              </p>
              <p className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0" />
                <span>Nutrition tracking aligned with GLP-1 therapy</span>
              </p>
            </div>

            <div className="pt-6 border-t border-white/10">
              <p className="text-white/60 text-sm text-center">
                Coming soon! This feature is under development.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
