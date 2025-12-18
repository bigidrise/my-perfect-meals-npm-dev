import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Utensils, SlidersHorizontal, LayoutGrid, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function PlanBuilderHub() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-black to-black p-4 sm:p-6">
      {/* Fixed Back to Meal Planning Hub Button */}
      <Button
        variant="ghost"
        onClick={() => setLocation("/comprehensive-meal-planning-revised")}
        className="fixed top-4 left-4 z-[2147483647] transform translateZ(0) isolation-isolate flex items-center gap-2 text-white bg-black/20 backdrop-blur-md border border-white/20 hover:bg-black/30 transition-all duration-200 rounded-2xl"
        data-testid="button-back-meal-hub"
      >
        <Home className="w-4 h-4" /> Meal Planning Hub
      </Button>

      <div className="max-w-4xl mx-auto pt-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block rounded-2xl px-6 py-5 bg-black/30 border border-white/20 backdrop-blur-sm shadow-xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
              Plan Builder Hub
            </h1>
            <p className="text-sm sm:text-base text-white/80">
              Choose your approach: quick and simple, advanced customization, or
              ready-made templates.
            </p>
          </div>
        </div>

        {/* Plan Builder Options */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {/* Weekly Meal Board */}
          <Card className="bg-black/30 border-white/10 backdrop-blur-sm hover:bg-black/40 transition-all duration-200">
            <CardHeader>
              <div className="flex items-center gap-2 text-white/80">
                <Utensils className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wide text-emerald-400">
                  Recommended
                </span>
              </div>
              <CardTitle className="text-white">Weekly Meal Board</CardTitle>
              <CardDescription className="text-white/70">
                4-List System - Breakfast • Lunch • Dinner • Snacks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-white/80">
                Build your week with meals from Cafeteria, Templates, or manual
                entry. Tracks weekly macro targets automatically.
              </p>
              <Button
                className="w-full bg-white text-black hover:bg-white/90 transition-colors"
                onClick={() => setLocation("/weekly-meal-board")}
                data-testid="button-weekly-board"
              >
                Open Weekly Meal Board
              </Button>
            </CardContent>
          </Card>

          {/* Cafeteria Setup */}
          <Card className="bg-black/30 border-white/10 backdrop-blur-sm hover:bg-black/40 transition-all duration-200">
            <CardHeader>
              <div className="flex items-center gap-2 text-white/80">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Macro Counter</CardTitle>
              <CardDescription className="text-white/70">
                {" "}
                Macro Counter – Finally learn how your macros really work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-white/80">
                Stop guessing—start understanding. The Macro Counter shows how
                protein, carbs, and fats add up in real time, with clear
                examples of low-GI, starchy, sugary, and fiber carbs. Build your
                totals, match your goal, and finally know why your numbers
                matter.
              </p>
              <Button
                className="w-full bg-white text-black hover:bg-white/90 transition-colors"
                onClick={() => setLocation("/macro-counter")}
                data-testid="button-macro-counter"
              >
                Open Macro Counters
              </Button>
            </CardContent>
          </Card>

          

          {/* Template Hub */}
          <Card className="bg-black/30 border-white/10 backdrop-blur-sm hover:bg-black/40 transition-all duration-200">
            <CardHeader>
              <div className="flex items-center gap-2 text-white/80">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Template Hub</CardTitle>
              <CardDescription className="text-white/70">
                Quick, pre-made meals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-white/80">
                Pick from curated meal templates and add them directly to your
                calendar. Adjust serving sizes in seconds.
              </p>
              <Button
                className="w-full bg-white text-black hover:bg-white/90 transition-colors"
                onClick={() => setLocation("/template-hub")}
                data-testid="button-template-hub"
              >
                Browse Templates
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
