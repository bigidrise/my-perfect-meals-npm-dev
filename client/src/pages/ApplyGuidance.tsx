import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ApplyGuidance() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    struggle: "",
    commitment: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/apply-guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Application Submitted",
          description: "The founder will review your application within 48-72 hours.",
        });
        setLocation("/pricing");
      } else {
        toast({
          title: "Submission Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Submission Failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-20">
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/pricing")}
            className="flex items-center text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-white">Apply for Personal Guidance</h1>
        </div>
      </div>

      <div
        className="max-w-2xl mx-auto px-4 pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">MPM Personal Guidance</h2>
            <p className="text-white/70 text-sm">
              Work directly with the founder of My Perfect Meals.
              Applications are reviewed manually.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/90">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal" className="text-white/90">Primary Goal with My Perfect Meals</Label>
              <Textarea
                id="goal"
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                placeholder="What are you hoping to achieve?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="struggle" className="text-white/90">Biggest Current Struggle / Nutrition Challenge</Label>
              <Textarea
                id="struggle"
                value={formData.struggle}
                onChange={(e) => setFormData({ ...formData, struggle: e.target.value })}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                placeholder="What's been holding you back?"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="commitment"
                checked={formData.commitment}
                onChange={(e) => setFormData({ ...formData, commitment: e.target.checked })}
                required
                className="mt-1 accent-amber-500"
              />
              <Label htmlFor="commitment" className="text-white/80 text-sm leading-relaxed">
                I confirm a 6-month commitment and understand this is async, in-app guidance only.
                No video calls. No off-platform contact.
              </Label>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          </form>

          <p className="text-xs text-center text-white/50 mt-6">
            Applications reviewed manually. You'll hear back within 48-72 hours if selected.
          </p>
        </div>
      </div>
    </div>
  );
}
