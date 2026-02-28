import { useLocation } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { Crown, Lock, Stethoscope, Dumbbell, LogOut, KeyRound, ClipboardEdit, CheckCircle2, Heart, Briefcase, MessageSquare, Send, Loader2, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

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

export default function MorePage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === "admin";
  const userRole = user?.professionalRole || null;

  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedResult, setConnectedResult] = useState<ConnectedResult | null>(null);
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);

  const isProCareClient = !!user?.isProCare;
  const [tabletOpen, setTabletOpen] = useState(false);
  const [tabletMessages, setTabletMessages] = useState<any[]>([]);
  const [tabletLoading, setTabletLoading] = useState(false);
  const [tabletError, setTabletError] = useState<string | null>(null);
  const [tabletInput, setTabletInput] = useState("");
  const [tabletSending, setTabletSending] = useState(false);
  const [tabletTranslatingId, setTabletTranslatingId] = useState<string | null>(null);
  const tabletScrollRef = useRef<HTMLDivElement>(null);
  const tabletTranslationCache = useRef(new Map<string, string>());

  const fetchClientTablet = useCallback(async () => {
    setTabletLoading(true);
    setTabletError(null);
    try {
      const res = await fetch(apiUrl("/api/client/tablet"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) setTabletError("No active coach connection");
        else setTabletError("Failed to load messages");
        return;
      }
      const data = await res.json();
      setTabletMessages(data.messages || []);
    } catch {
      setTabletError("Failed to load messages");
    } finally {
      setTabletLoading(false);
    }
  }, []);

  const handleTabletSend = async () => {
    if (!tabletInput.trim() || tabletSending) return;
    setTabletSending(true);
    try {
      const res = await fetch(apiUrl("/api/client/tablet/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: tabletInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const data = await res.json();
      setTabletMessages((prev) => [...prev, data.entry]);
      setTabletInput("");
    } catch {
      setTabletError("Failed to send message");
    } finally {
      setTabletSending(false);
    }
  };

  const handleTabletTranslate = async (entry: any) => {
    if (tabletTranslatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (tabletTranslationCache.current.has(cacheKey)) {
      setTabletMessages((prev) =>
        prev.map((n: any) =>
          n.id === entry.id
            ? { ...n, translatedBody: n.translatedBody ? undefined : tabletTranslationCache.current.get(cacheKey) }
            : n
        )
      );
      return;
    }
    setTabletTranslatingId(entry.id);
    try {
      const res = await fetch(apiUrl("/api/translate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          content: { name: "Message", description: entry.body },
          targetLanguage: navigator.language?.split("-")[0] || "es",
        }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      const translated = data.translated?.description || data.description || entry.body;
      tabletTranslationCache.current.set(cacheKey, translated);
      setTabletMessages((prev) =>
        prev.map((n: any) => (n.id === entry.id ? { ...n, translatedBody: translated } : n))
      );
    } catch {
      setTabletError("Translation failed");
    } finally {
      setTabletTranslatingId(null);
    }
  };

  useEffect(() => {
    if (tabletOpen && isProCareClient) {
      fetchClientTablet();
    }
  }, [tabletOpen, isProCareClient, fetchClientTablet]);

  useEffect(() => {
    if (tabletScrollRef.current) {
      tabletScrollRef.current.scrollTop = tabletScrollRef.current.scrollHeight;
    }
  }, [tabletMessages]);

  useEffect(() => {
    document.title = "More | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
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
      await refreshUser();
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
          <h1 className="text-lg font-bold text-white flex-1">More</h1>
          
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
              src="/images/procare-hero.png" 
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

          

          {/* Switch to Workspace — only for professionals */}
          {(userRole === "trainer" || userRole === "physician") && (
            <Card
              className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-orange-500/30 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
              onClick={() => setShowWorkspaceChooser(true)}
              data-testid="card-switch-workspace"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Briefcase className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">
                      {userRole === "physician" ? "Switch to Physicians Clinic" : "Switch to Trainers Studio"}
                    </h3>
                    <p className="text-xs text-white/70">Enter your professional workspace</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workspace Chooser Overlay */}
          {showWorkspaceChooser && (
            <WorkspaceChooser
              onChoose={(choice: "personal" | "workspace") => {
                setShowWorkspaceChooser(false);
                if (choice === "workspace") {
                  const workspaceRoute = userRole === "physician" ? "/care-team/physician" : "/care-team/trainer";
                  setLocation(workspaceRoute);
                }
              }}
            />
          )}

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
            {/* 1. Professional Studios — HIDDEN: professionals must use workspace chooser to enter clinics */}
            {false && proCareFeatures.filter(f => f.roleKey !== null).map((feature) => {
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

            {isProCareClient && (
              <Card
                className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-purple-500/30 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
                onClick={() => setTabletOpen(!tabletOpen)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <MessageSquare className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">Messages From Your Coach</h3>
                      <p className="text-xs text-white/70">View and reply to your coach</p>
                    </div>
                    {tabletOpen ? (
                      <ChevronUp className="h-4 w-4 text-white/40" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/40" />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {isProCareClient && tabletOpen && (
              <div className="bg-black/30 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 space-y-3">
                {tabletLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                  </div>
                )}
                {tabletError && (
                  <p className="text-sm text-red-400">{tabletError}</p>
                )}
                {!tabletLoading && !tabletError && (
                  <>
                    <div ref={tabletScrollRef} className="max-h-64 overflow-y-auto space-y-2">
                      {tabletMessages.length === 0 && (
                        <p className="text-xs text-white/30 py-2">No messages yet</p>
                      )}
                      {tabletMessages.map((entry: any) => (
                        <div
                          key={entry.id}
                          className={`rounded-md p-2.5 border ${
                            entry.sender === "client"
                              ? "bg-blue-500/10 border-blue-500/20 ml-6"
                              : "bg-white/5 border-white/5 mr-6"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white/40">
                              {entry.sender === "client" ? "You" : "Coach"} &middot;{" "}
                              {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                              {new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleTabletTranslate(entry); }}
                              disabled={tabletTranslatingId === entry.id}
                              className="text-white/30 hover:text-white/60 p-0.5"
                              title="Translate"
                            >
                              {tabletTranslatingId === entry.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Globe className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                            {entry.translatedBody || entry.body}
                          </p>
                          {entry.translatedBody && (
                            <p className="text-[10px] text-white/30 mt-1 italic">
                              Original: {entry.body}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <textarea
                        value={tabletInput}
                        onChange={(e) => setTabletInput(e.target.value)}
                        placeholder="Reply to your coach..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-purple-500/50"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleTabletSend();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={!tabletInput.trim() || tabletSending}
                        onClick={handleTabletSend}
                        className="bg-purple-600 hover:bg-purple-700 px-3 self-end"
                      >
                        {tabletSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
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
