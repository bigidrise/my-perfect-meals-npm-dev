import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { Crown, Lock, Stethoscope, Dumbbell, LogOut, KeyRound, ClipboardEdit, CheckCircle2, Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface ProCareFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
  roleKey: "physician" | "trainer" | null;
}

type ConnectedResult = {
  member: any;
  studio: { studioId: string; studioName: string; membershipId: string } | null;
};

export default function ProCareCover() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const userRole = user?.professionalRole || null;

  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedResult, setConnectedResult] = useState<ConnectedResult | null>(null);

  useEffect(() => {
    document.title = "ProCare | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    /* All users can access the ProCare landing page — locking happens on individual features inside */
  }, []);

  const proCareFeatures: ProCareFeature[] = [
    {
      title: "Physicians Clinic",
      description: "Medical oversight, guardrails, and clinical nutrition tools",
      icon: Stethoscope,
      route: "/care-team/physician",
      testId: "card-procare-physician",
      roleKey: "physician",
    },
    {
      title: "Trainers Studio",
      description: "Coaching, personalization, and performance meal planning",
      icon: Dumbbell,
      route: "/care-team/trainer",
      testId: "card-procare-trainer",
      roleKey: "trainer",
    },
    {
      title: "Supplement Hub",
      description: "Evidence-based supplement guidance and trusted partners",
      icon: Crown,
      route: "/supplement-hub",
      testId: "card-supplement-hub",
      roleKey: null,
    },
  ];

  const isFeatureLocked = (feature: ProCareFeature) => {
    if (isAdmin) return false;
    if (feature.roleKey === null) return false;
    return feature.roleKey !== userRole;
  };

  const handleCardClick = (feature: ProCareFeature) => {
    if (isFeatureLocked(feature)) return;
    setLocation(feature.route);
  };

  async function connectWithCode() {
    setError(null);
    setConnectedResult(null);
    if (!accessCode.trim()) {
      setError("Enter an access code.");
      return;
    }
    try {
      setLoading(true);
      const response = await apiRequest("/api/care-team/connect", {
        method: "POST",
        body: JSON.stringify({ code: accessCode }),
      });
      setAccessCode("");
      setConnectedResult(response);
    } catch (e: any) {
      setError(e?.message ?? "Invalid or expired access code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {/* Header Banner - ProCare */}
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
          <div className="px-6 py-3 flex items-center gap-3">
          <Crown className="h-6 w-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white flex-1">ProCare</h1>
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 active:scale-[0.98] transition-transform"
          >
            <LogOut className="h-3.5 w-3.5 text-white/70" />
            <span className="text-xs text-white/70 font-medium">Exit</span>
          </button>
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

          {/* Getting Started Guidance */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <p className="text-orange-300 text-sm font-semibold mb-1">
              Your Workspace
            </p>
            <p className="text-white/70 text-xs leading-relaxed">
              This is your professional workspace
              {userRole === "trainer"
                ? " — Trainers Studio"
                : userRole === "physician"
                ? " — Physicians Clinic"
                : ""}. Manage clients and build plans here. Tap <span className="text-orange-400 font-medium">Exit</span> in the top
              right to return to your personal space anytime. You can always come back via
              the <span className="text-orange-400 font-medium">ProCare</span> tab below.
            </p>
          </div>

          {/* Saved Meals / Favorites */}
          <Card
            className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-red-500/20 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
            onClick={() => setLocation("/saved-meals")}
            data-testid="card-saved-meals"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Heart className="h-5 w-5 text-red-400" fill="currentColor" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">Favorites</h3>
                  <p className="text-xs text-white/70">Your saved meals — tap to view and reuse</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ProCare Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {/* 1. Professional Studios (locked for non-pros) */}
            {proCareFeatures.filter(f => f.roleKey !== null).map((feature) => {
              const Icon = feature.icon;
              const isLocked = isFeatureLocked(feature);
              const lockedLabel = feature.roleKey === "physician"
                ? "Physician ProCare is available to licensed physicians."
                : "Trainer ProCare is available to certified trainers and coaches.";

              return (
                <Card
                  key={feature.testId}
                  className={`transition-all duration-300 rounded-xl shadow-md relative overflow-hidden ${
                    isLocked
                      ? "bg-black/20 backdrop-blur-lg border border-white/5 opacity-60 cursor-default"
                      : "cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-white/10"
                  }`}
                  onClick={() => handleCardClick(feature)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isLocked ? "text-white/30" : "text-orange-500"}`} />
                        <h3 className={`text-sm font-semibold flex-1 ${isLocked ? "text-white/40" : "text-white"}`}>
                          {feature.title}
                        </h3>
                        {isLocked && (
                          <Lock className="h-4 w-4 text-white/40 shrink-0" />
                        )}
                      </div>
                      <p className={`text-xs ml-6 ${isLocked ? "text-white/30" : "text-white/80"}`}>
                        {isLocked ? lockedLabel : feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* 2. Connect with Access Code — exact working card from TrainerCareTeam */}
            <GlassCard className="border-2 border-orange-500/40">
              <GlassCardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-orange-500" />
                  <h2 className="text-xl font-bold text-white">
                    Connect with Access Code
                  </h2>
                </div>
                <p className="text-sm text-white/70">
                  If your professional gave you a code, enter it here to link
                  instantly.
                </p>
                <div>
                  <Label className="text-white/80">Access Code</Label>
                  <Input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="e.g. MP-9ZX4-QL"
                    className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                    data-testid="input-careteam-code"
                  />
                </div>
                {error && (
                  <div className="rounded-xl border border-red-500/50 bg-red-900/30 text-red-100 p-3">
                    {error}
                  </div>
                )}
                <Button
                  disabled={loading}
                  onClick={connectWithCode}
                  className="w-full bg-lime-600 hover:bg-lime-600 text-white"
                  data-testid="button-submit-code"
                >
                  <ClipboardEdit className="h-4 w-4 mr-2" />
                  Link with Code
                </Button>
              </GlassCardContent>
            </GlassCard>

            {/* Connected Success Card */}
            {connectedResult && (
              <GlassCard className="border-2 border-green-500/40">
                <GlassCardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <h2 className="text-lg font-bold text-white">
                      Connected!
                    </h2>
                  </div>
                  {connectedResult.studio && (
                    <p className="text-sm text-white/80">
                      You are now linked to <span className="text-green-300 font-semibold">{connectedResult.studio.studioName}</span>. Your trainer can now manage your meal plan.
                    </p>
                  )}
                  {!connectedResult.studio && (
                    <p className="text-sm text-white/80">
                      You are now linked to your professional. They can manage your meal plan.
                    </p>
                  )}
                  <p className="text-xs text-white/60">
                    Your trainer will assign your meal builder. Check back on your dashboard to see updates.
                  </p>
                </GlassCardContent>
              </GlassCard>
            )}

            {/* 3. Other features (Supplement Hub, etc.) */}
            {proCareFeatures.filter(f => f.roleKey === null).map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.testId}
                  className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-white/10 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
                  onClick={() => handleCardClick(feature)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 flex-shrink-0 text-orange-500" />
                        <h3 className="text-sm font-semibold flex-1 text-white">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-xs ml-6 text-white/80">
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
