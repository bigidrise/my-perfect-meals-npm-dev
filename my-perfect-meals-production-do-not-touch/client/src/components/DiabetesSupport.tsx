import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Heart, Activity, TrendingUp, Clock, Home, ArrowUp } from "lucide-react";
import { useLocation } from "wouter";
import { 
  useDiabetesProfile, 
  useGlucoseLogs, 
  useMealConstraints,
  useSaveDiabetesProfile,
  useLogGlucose,
  type DiabetesType,
  type GlucoseContext 
} from "@/hooks/useDiabetes";
// Remove auth import for now - will use demo user ID
import { useToast } from "@/hooks/use-toast";

export function DiabetesSupport() {
  // Using demo user ID for development
  const demoUserId = "demo-user-123";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [glucoseValue, setGlucoseValue] = useState("");
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>("RANDOM");
  const [diabetesType, setDiabetesType] = useState<DiabetesType>("NONE");

  useEffect(() => {
    window.scrollTo(0, 0);
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  const { data: profile } = useDiabetesProfile(demoUserId);
  const { data: glucoseLogs } = useGlucoseLogs(demoUserId);
  const { data: constraints } = useMealConstraints(demoUserId);
  const saveMutation = useSaveDiabetesProfile();
  const logMutation = useLogGlucose();

  const handleSaveProfile = async () => {
    if (!demoUserId) return;
    
    try {
      await saveMutation.mutateAsync({
        userId: demoUserId,
        type: diabetesType,
        hypoHistory: false,
      });
      toast({ title: "Profile saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save profile", variant: "destructive" });
    }
  };

  const handleLogGlucose = async () => {
    if (!demoUserId || !glucoseValue) return;
    
    try {
      await logMutation.mutateAsync({
        userId: demoUserId,
        valueMgdl: parseInt(glucoseValue),
        context: glucoseContext,
      });
      setGlucoseValue("");
      toast({ title: "Glucose reading logged" });
    } catch (error) {
      toast({ title: "Failed to log glucose", variant: "destructive" });
    }
  };

  const getAlertBadge = (level: string) => {
    switch (level) {
      case "warning":
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          High Alert
        </Badge>;
      case "caution":
        return <Badge variant="secondary" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Caution
        </Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          Normal
        </Badge>;
    }
  };

  const recentGlucose = glucoseLogs?.data?.[0];
  const avgGlucose = glucoseLogs?.data?.length 
    ? Math.round(glucoseLogs.data.slice(0, 10).reduce((sum: number, log: any) => sum + log.valueMgdl, 0) / Math.min(10, glucoseLogs.data.length))
    : null;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600 relative">
      {/* Enhanced Glass Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10 pointer-events-none" />
      
      <div className="container mx-auto p-6 space-y-6 pb-20 relative z-10">
        {/* Navigation Button */}
        <button
          onClick={() => setLocation("/diabetic-hub")}
          className="mb-6 flex items-center gap-2 bg-black/30 backdrop-blur-lg border border-white/20 hover:bg-black/40 text-white transition-all duration-200 px-4 py-2 rounded-lg shadow-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
          <Home className="h-4 w-4 relative z-10" />
          <span className="relative z-10">Diabetic Hub</span>
        </button>

        {/* Enhanced Glass Header */}
        <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Inner glass shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
          <h1 className="text-4xl font-bold text-white relative z-10">
            Blood Sugar Tracker
          </h1>
          <p className="text-white/90 mt-2 relative z-10">
            Advanced glucose monitoring and meal planning for optimal health management
          </p>
        </div>

        {/* Current Status Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Recent Glucose */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-white">Recent Glucose</CardTitle>
              <Activity className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-2xl font-bold text-white">
                {recentGlucose ? `${recentGlucose.valueMgdl} mg/dL` : "No data"}
              </div>
              <p className="text-xs text-white/70">
                {recentGlucose && (
                  <>
                    <Clock className="inline w-3 h-3 mr-1" />
                    {new Date(recentGlucose.recordedAt).toLocaleString()}
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Average Glucose */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-white">10-Day Average</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-2xl font-bold text-white">
                {avgGlucose ? `${avgGlucose} mg/dL` : "No data"}
              </div>
              <p className="text-xs text-white/70">
                Based on recent readings
              </p>
            </CardContent>
          </Card>

          {/* Current Alert Level */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-white">Alert Level</CardTitle>
              <AlertTriangle className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-2">
                {constraints?.data?.constraints && getAlertBadge(constraints.data.constraints.alertLevel)}
                {constraints?.data?.constraints?.alertReason && (
                  <p className="text-xs text-white/70">
                    {constraints.data.constraints.alertReason}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Enhanced Glass Profile Card */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Heart className="w-5 h-5 text-emerald-400" />
                Diabetes Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="space-y-2">
                <Label htmlFor="diabetes-type" className="text-white">Diabetes Type</Label>
                <Select value={diabetesType} onValueChange={(value: DiabetesType) => setDiabetesType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select diabetes type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Diabetes</SelectItem>
                    <SelectItem value="T1D">Type 1 Diabetes</SelectItem>
                    <SelectItem value="T2D">Type 2 Diabetes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {profile?.data && (
                <div className="p-3 bg-emerald-500/20 backdrop-blur-sm rounded-lg border border-emerald-400/30">
                  <p className="text-sm text-emerald-200">
                    Current profile: {profile.data.type === "NONE" ? "No diabetes" : `Type ${profile.data.type.replace("T", "").replace("D", "")} diabetes`}
                  </p>
                </div>
              )}
              
              <Button 
                onClick={handleSaveProfile} 
                disabled={saveMutation.isPending} 
                className="bg-emerald-600/90 backdrop-blur-sm hover:bg-emerald-700/90 text-white border border-white/20 shadow-xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
                <span className="relative z-10">
                  {saveMutation.isPending ? "Saving..." : "Save Profile"}
                </span>
              </Button>
            </CardContent>
          </Card>

          {/* Enhanced Glass Logging Card */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-emerald-400" />
                Log Glucose Reading
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="space-y-2">
                <Label htmlFor="glucose-value" className="text-white">Glucose Level (mg/dL)</Label>
                <Input
                  id="glucose-value"
                  type="number"
                  placeholder="Enter glucose reading"
                  value={glucoseValue}
                  onChange={(e) => setGlucoseValue(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="glucose-context" className="text-white">Reading Context</Label>
                <Select value={glucoseContext} onValueChange={(value: GlucoseContext) => setGlucoseContext(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select context" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FASTED">Fasted</SelectItem>
                    <SelectItem value="PRE_MEAL">Before Meal</SelectItem>
                    <SelectItem value="POST_MEAL_1H">1 Hour After Meal</SelectItem>
                    <SelectItem value="POST_MEAL_2H">2 Hours After Meal</SelectItem>
                    <SelectItem value="RANDOM">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleLogGlucose} 
                disabled={logMutation.isPending || !glucoseValue}
                className="bg-emerald-600/90 backdrop-blur-sm hover:bg-emerald-700/90 text-white border border-white/20 shadow-xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 pointer-events-none" />
                <span className="relative z-10">
                  {logMutation.isPending ? "Logging..." : "Log Reading"}
                </span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Glucose History */}
        {glucoseLogs?.data && glucoseLogs.data.length > 0 && (
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2 text-white">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Recent Glucose History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="space-y-3">
                {glucoseLogs.data.slice(0, 5).map((log: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                    <div>
                      <span className="text-white font-semibold">{log.valueMgdl} mg/dL</span>
                      <span className="text-white/70 text-sm ml-2">({log.context})</span>
                    </div>
                    <span className="text-white/60 text-sm">
                      {new Date(log.recordedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Glass Floating Back to Top */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-black/30 backdrop-blur-lg hover:bg-black/40 text-white rounded-full flex items-center justify-center border border-white/40 hover:border-white/60 transition-all shadow-2xl relative overflow-hidden"
            aria-label="Back to top"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />
            <ArrowUp className="h-5 w-5 relative z-10" />
          </button>
        )}
      </div>
    </div>
  );
}