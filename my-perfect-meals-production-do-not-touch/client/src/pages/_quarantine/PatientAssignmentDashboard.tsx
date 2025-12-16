import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Filter, User, Activity, Clock, Edit2, Eye, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DIABETIC_PRESETS } from "@/data/diabeticPresets";
import { usePatients } from "@/hooks/usePatients";
import { Card } from "@/components/ui/card";

interface PatientRecord {
  id: string;
  name: string;
  email: string;
  condition: "T2D" | "GLP1" | "CARDIAC";
  currentPreset?: string;
  latestGlucose?: number;
  lastUpdated?: string;
  guardrails?: {
    fastingMin: number;
    fastingMax: number;
    postMealMax: number;
    carbLimit: number;
  };
  // These are added for the new table view
  inRange: boolean | null;
  preset?: string;
  carbLimit?: number;
  lastUpdatedReadable?: string;
}

// Mock data - will be replaced with real API calls
const mockPatients: PatientRecord[] = [
  {
    id: "patient-1",
    name: "John Doe",
    email: "john@example.com",
    condition: "T2D",
    currentPreset: "standard",
    latestGlucose: 145,
    lastUpdated: "2024-01-15T10:30:00Z",
    guardrails: { fastingMin: 80, fastingMax: 130, postMealMax: 180, carbLimit: 150 },
    inRange: true,
    preset: "Standard Care",
    carbLimit: 150,
    lastUpdatedReadable: "2024-01-15",
  },
  {
    id: "patient-2",
    name: "Jane Smith",
    email: "jane@example.com",
    condition: "GLP1",
    currentPreset: "glp1",
    latestGlucose: 115,
    lastUpdated: "2024-01-15T09:15:00Z",
    guardrails: { fastingMin: 80, fastingMax: 120, postMealMax: 160, carbLimit: 120 },
    inRange: true,
    preset: "GLP-1 Focus",
    carbLimit: 120,
    lastUpdatedReadable: "2024-01-15",
  },
  {
    id: "patient-3",
    name: "Robert Johnson",
    email: "robert@example.com",
    condition: "CARDIAC",
    currentPreset: "cardiac",
    latestGlucose: 98,
    lastUpdated: "2024-01-14T16:45:00Z",
    guardrails: { fastingMin: 80, fastingMax: 130, postMealMax: 180, carbLimit: 130 },
    inRange: true,
    preset: "Cardiac Support",
    carbLimit: 130,
    lastUpdatedReadable: "2024-01-14",
  }
];

export default function PatientAssignmentDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCondition, setFilterCondition] = useState<string>("all");
  const [filterPreset, setFilterPreset] = useState<string>("all");

  const { data: patientsData, isLoading } = usePatients();
  const patients = patientsData || [];

  // Authorization check
  if (user?.role !== 'doctor' && user?.role !== 'coach' && user?.role !== 'trainer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-red-600 to-black/80 flex items-center justify-center p-4">
        <div className="bg-black/40 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center max-w-md">
          <h2 className="text-2xl font-semibold text-white mb-4">Access Denied</h2>
          <p className="text-white/80 mb-6">This dashboard is only accessible to healthcare professionals.</p>
          <Button onClick={() => setLocation("/planner")} className="bg-white/20 hover:bg-white/30">
            Return to Planner
          </Button>
        </div>
      </div>
    );
  }

  // Filter patients
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCondition = filterCondition === "all" || patient.condition === filterCondition;
    const matchesPreset = filterPreset === "all" || patient.currentPreset === filterPreset;
    return matchesSearch && matchesCondition && matchesPreset;
  });

  const getPresetLabel = (presetId?: string) => {
    if (!presetId) return "Custom";
    const preset = DIABETIC_PRESETS.find(p => p.id === presetId);
    return preset ? preset.name : "Custom";
  };

  const getGlucoseStatus = (glucose?: number) => {
    if (!glucose) return { color: "gray", text: "No data" };
    if (glucose < 70) return { color: "red", text: "Low" };
    if (glucose > 180) return { color: "yellow", text: "High" };
    return { color: "green", text: "In range" };
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <>
      {/* Back Button */}
      <div
        className="fixed top-4 left-4 pointer-events-auto"
        style={{ 
          zIndex: 2147483647,
          isolation: 'isolate',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      >
        <Button
          onClick={() => setLocation("/clinical-lifestyle-hub")}
          className="flex items-center gap-2 text-white bg-black/20 backdrop-blur-none border border-white/30 hover:bg-black/40 transition-all duration-200 font-medium rounded-xl shadow-2xl"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
          Back
        </Button>
      </div>

      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-600 to-black/80 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10 pointer-events-none" />

        <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24 relative z-10">

          {/* Header */}
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden mb-8 mt-14">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
            <h1 className="text-2xl md:text-3xl font-semibold text-white mb-4 relative z-10">
              👨‍⚕️ Patient Assignment Dashboard
            </h1>
            <p className="text-sm text-white/90 max-w-3xl mx-auto relative z-10">
              Manage diabetic guardrails and monitor patient progress
            </p>
          </div>

          {/* Filters & Search */}
          <div className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none" />
            <div className="grid md:grid-cols-3 gap-4 relative z-10">
              <div>
                <label className="block text-sm text-white mb-2">Search Patients</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name or email..."
                    className="pl-10 bg-white/20 border-white/40 text-white placeholder-white/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white mb-2">Filter by Condition</label>
                <Select value={filterCondition} onValueChange={setFilterCondition}>
                  <SelectTrigger className="bg-white/20 border-white/40 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Conditions</SelectItem>
                    <SelectItem value="T2D">Type 2 Diabetes</SelectItem>
                    <SelectItem value="GLP1">GLP-1 Patients</SelectItem>
                    <SelectItem value="CARDIAC">Cardiac-Diabetic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm text-white mb-2">Filter by Preset</label>
                <Select value={filterPreset} onValueChange={setFilterPreset}>
                  <SelectTrigger className="bg-white/20 border-white/40 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Presets</SelectItem>
                    {DIABETIC_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Patient List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-12 text-center">
                <Activity className="h-16 w-16 mx-auto mb-4 text-white/40 animate-pulse" />
                <p className="text-white/80 text-lg">Loading patients...</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-12 text-center">
                <User className="h-16 w-16 mx-auto mb-4 text-white/40" />
                <p className="text-white/80 text-lg">No patients found</p>
                <p className="text-white/60 text-sm mt-2">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <Card className="bg-zinc-900/80 border-white/10 p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-white">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3">Patient</th>
                        <th className="text-left p-3">Latest Glucose</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Preset</th>
                        <th className="text-left p-3">Carb Limit</th>
                        <th className="text-left p-3">Last Updated</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((patient) => {
                        const glucoseStatus = getGlucoseStatus(patient.latestGlucose);

                        return (
                          <tr key={patient.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="p-3">
                              <div>
                                <div className="font-medium">{patient.name}</div>
                                <div className="text-xs text-white/60">{patient.email}</div>
                              </div>
                            </td>
                            <td className="p-3">
                              {patient.latestGlucose ?? "—"}
                              {patient.latestGlucose && " mg/dL"}
                            </td>
                            <td className="p-3">
                              {glucoseStatus.text === "No data" ? (
                                <span className="text-white/40">No data</span>
                              ) : glucoseStatus.text === "In range" ? (
                                <span className="text-green-400">✅ In Range</span>
                              ) : (
                                <span className="text-red-400">⚠️ Out of Range</span>
                              )}
                            </td>
                            <td className="p-3">{patient.preset ?? "—"}</td>
                            <td className="p-3">{patient.carbLimit ?? "—"}g</td>
                            <td className="p-3 text-white/60 text-xs">
                              {patient.lastUpdatedReadable ? patient.lastUpdatedReadable : "—"}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  onClick={() => {
                                    toast({ title: "View feature coming soon" });
                                  }}
                                  className="bg-blue-500/30 hover:bg-blue-500/50 text-white border border-white/20"
                                  size="sm"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => {
                                    toast({ title: "History feature coming soon" });
                                  }}
                                  className="bg-orange-500/30 hover:bg-orange-500/50 text-white border border-white/20"
                                  size="sm"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid md:grid-cols-4 gap-4 mt-8">
            <div className="bg-black/30 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-white mb-2">{patients.length}</div>
              <div className="text-sm text-white/70">Total Patients</div>
            </div>
            <div className="bg-black/30 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-green-300 mb-2">
                {patients.filter(p => p.inRange === true).length}
              </div>
              <div className="text-sm text-white/70">In Range</div>
            </div>
            <div className="bg-black/30 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-yellow-300 mb-2">
                {patients.filter(p => p.inRange === false).length}
              </div>
              <div className="text-sm text-white/70">Out of Range</div>
            </div>
            <div className="bg-black/30 backdrop-blur-lg rounded-xl p-6 border border-white/20 text-center">
              <div className="text-3xl font-bold text-blue-300 mb-2">
                {DIABETIC_PRESETS.length}
              </div>
              <div className="text-sm text-white/70">Active Presets</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}