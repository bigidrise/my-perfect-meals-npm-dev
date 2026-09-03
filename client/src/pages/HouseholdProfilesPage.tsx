import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Pencil, Trash2, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useHousehold, type HouseholdProfile } from "@/contexts/HouseholdContext";
import { useToast } from "@/hooks/use-toast";
import { getMaxHouseholdProfiles } from "@shared/planFeatures";
import { useAuth } from "@/contexts/AuthContext";

const AVATAR_EMOJIS = ["👤", "👦", "👧", "👨", "👩", "👴", "👵", "🧒", "🧑", "🧓", "🏃", "🧘", "💪", "🍽️", "⭐"];

const DIET_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Paleo",
  "Halal", "Kosher", "Low-Carb", "Low-Sodium",
];

const ALLERGY_OPTIONS = [
  "Peanuts", "Tree Nuts", "Milk", "Eggs", "Fish", "Shellfish", "Wheat", "Soy", "Sesame",
];

const GOAL_OPTIONS = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "maintenance", label: "Maintenance" },
  { value: "endurance", label: "Endurance" },
];

interface ProfileFormData {
  displayName: string;
  avatarEmoji: string;
  age: string;
  dietaryRestrictions: string[];
  allergies: string[];
  fitnessGoal: string;
}

const DEFAULT_FORM: ProfileFormData = {
  displayName: "",
  avatarEmoji: "👤",
  age: "",
  dietaryRestrictions: [],
  allergies: [],
  fitnessGoal: "",
};

function ProfileForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: ProfileFormData;
  onSave: (data: ProfileFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProfileFormData>(initial ?? DEFAULT_FORM);

  function togglePill<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-white/80 text-sm">Name</Label>
        <Input
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          placeholder="e.g. Mom, Tyler, Baby Emma"
          className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-orange-500"
          maxLength={60}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/80 text-sm">Avatar</Label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setForm((f) => ({ ...f, avatarEmoji: emoji }))}
              className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                form.avatarEmoji === emoji
                  ? "bg-orange-600 ring-2 ring-orange-400"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/80 text-sm">Age (optional)</Label>
        <Input
          type="number"
          value={form.age}
          onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
          placeholder="e.g. 12"
          className="bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-orange-500 w-28"
          min={0}
          max={120}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/80 text-sm">Dietary Restrictions</Label>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  dietaryRestrictions: togglePill(f.dietaryRestrictions, opt.toLowerCase().replace(/ /g, "_")),
                }))
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                form.dietaryRestrictions.includes(opt.toLowerCase().replace(/ /g, "_"))
                  ? "bg-orange-600 text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/80 text-sm">Allergies</Label>
        <div className="flex flex-wrap gap-2">
          {ALLERGY_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  allergies: togglePill(f.allergies, opt.toLowerCase()),
                }))
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                form.allergies.includes(opt.toLowerCase())
                  ? "bg-red-600 text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/80 text-sm">Wellness Goal</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  fitnessGoal: f.fitnessGoal === g.value ? "" : g.value,
                }))
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                form.fitnessGoal === g.value
                  ? "bg-orange-600 text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.displayName.trim()}
          className="flex-1 bg-orange-600 text-white font-semibold h-11"
        >
          {saving ? "Saving…" : "Save Profile"}
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          className="flex-1 bg-white/10 text-white h-11"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function profileToForm(p: HouseholdProfile): ProfileFormData {
  return {
    displayName: p.displayName,
    avatarEmoji: p.avatarEmoji ?? "👤",
    age: p.age != null ? String(p.age) : "",
    dietaryRestrictions: p.dietaryRestrictions ?? [],
    allergies: p.allergies ?? [],
    fitnessGoal: p.fitnessGoal ?? "",
  };
}

export default function HouseholdProfilesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { profiles, activeProfileId, setActive, createProfile, updateProfile, deleteProfile, loading } =
    useHousehold();
  const { toast } = useToast();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const maxProfiles = getMaxHouseholdProfiles(user?.planLookupKey ?? null);
  const canAddMore = profiles.length < maxProfiles;

  async function handleCreate(data: ProfileFormData) {
    setSaving(true);
    try {
      await createProfile({
        displayName: data.displayName,
        avatarEmoji: data.avatarEmoji,
        age: data.age ? parseInt(data.age) : null,
        dietaryRestrictions: data.dietaryRestrictions,
        allergies: data.allergies,
        fitnessGoal: data.fitnessGoal || null,
      });
      setShowNewForm(false);
      toast({ title: "Profile created", description: `${data.displayName} has been added to your household.` });
    } catch (err: any) {
      toast({ title: "Could not create profile", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, data: ProfileFormData) {
    setSaving(true);
    try {
      await updateProfile(id, {
        displayName: data.displayName,
        avatarEmoji: data.avatarEmoji,
        age: data.age ? parseInt(data.age) : null,
        dietaryRestrictions: data.dietaryRestrictions,
        allergies: data.allergies,
        fitnessGoal: data.fitnessGoal || null,
      });
      setEditingId(null);
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Could not update profile", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteProfile(id);
      toast({ title: "Profile removed" });
    } catch (err: any) {
      toast({ title: "Could not remove profile", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSwitch(id: string | null) {
    try {
      await setActive(id);
      const label = id ? (profiles.find((p) => p.id === id)?.displayName ?? "profile") : "your own profile";
      toast({ title: `Now generating for ${label}` });
    } catch {
      toast({ title: "Could not switch profile", variant: "destructive" });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              onClick={() => setLocation("/more")}
              className="bg-black/20 text-white rounded-xl border border-white/10 flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <Users className="h-5 w-5 text-orange-400" />
              <h1 className="text-lg font-bold text-white">Household Profiles</h1>
            </div>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-4 space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <p className="text-white/70 text-sm leading-relaxed">
          Switch between household profiles so meals are generated with that person's dietary preferences, allergies, and wellness goals. Your own preferences are always available too.
        </p>

        {/* Active: Owner (self) */}
        <Card
          className={`bg-black/30 backdrop-blur-lg border transition-all ${
            activeProfileId === null
              ? "border-orange-500/60 ring-1 ring-orange-500/30"
              : "border-white/15"
          }`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-xl flex-shrink-0">
              {user?.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} className="w-full h-full rounded-full object-cover" alt="" />
              ) : "👤"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {user?.firstName ?? user?.name ?? "Me"}
                <span className="ml-1.5 text-orange-400 text-xs font-normal">(You)</span>
              </p>
              <p className="text-white/50 text-xs">Your personal preferences</p>
            </div>
            {activeProfileId === null ? (
              <Badge className="bg-orange-600/80 text-white text-xs border-0 flex-shrink-0">
                <Check className="w-3 h-3 mr-1" /> Active
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => handleSwitch(null)}
                className="bg-white/10 text-white text-xs h-8 px-3 flex-shrink-0"
              >
                Switch
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Household member profiles */}
        {loading && profiles.length === 0 && (
          <div className="text-white/40 text-sm text-center py-4">Loading profiles…</div>
        )}

        <AnimatePresence>
          {profiles.map((profile) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {editingId === profile.id ? (
                <Card className="bg-black/40 backdrop-blur-lg border border-orange-500/40 text-white">
                  <CardContent className="p-4">
                    <p className="text-white/70 text-sm mb-4 font-medium">Edit {profile.displayName}</p>
                    <ProfileForm
                      initial={profileToForm(profile)}
                      onSave={(data) => handleUpdate(profile.id, data)}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card
                  className={`bg-black/30 backdrop-blur-lg border transition-all ${
                    activeProfileId === profile.id
                      ? "border-orange-500/60 ring-1 ring-orange-500/30"
                      : "border-white/15"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl flex-shrink-0">
                        {profile.avatarEmoji ?? "👤"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{profile.displayName}</p>
                        <p className="text-white/50 text-xs">
                          {[
                            profile.age ? `Age ${profile.age}` : null,
                            profile.dietaryRestrictions?.length
                              ? profile.dietaryRestrictions.slice(0, 2).join(", ")
                              : null,
                            profile.allergies?.length
                              ? `${profile.allergies.length} allergy${profile.allergies.length > 1 ? " items" : ""}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No preferences set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {activeProfileId === profile.id ? (
                          <Badge className="bg-orange-600/80 text-white text-xs border-0">
                            <Check className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSwitch(profile.id)}
                            className="bg-white/10 text-white text-xs h-8 px-3"
                          >
                            Switch
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(profile.id)}
                          className="text-white/60 hover:text-white h-8 w-8 p-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {!profile.isOwnerProfile && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(profile.id)}
                            disabled={deletingId === profile.id}
                            className="text-white/40 hover:text-red-400 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add new profile */}
        {!showNewForm && canAddMore && (
          <Button
            onClick={() => setShowNewForm(true)}
            className="w-full bg-white/10 border border-white/20 text-white h-12 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Household Member ({profiles.length}/{maxProfiles})
          </Button>
        )}

        {!showNewForm && !canAddMore && (
          <p className="text-white/40 text-xs text-center">
            Your plan supports up to {maxProfiles} household profiles.
          </p>
        )}

        {showNewForm && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-black/40 backdrop-blur-lg border border-orange-500/40 text-white">
              <CardContent className="p-4">
                <p className="text-white/70 text-sm mb-4 font-medium">New Household Member</p>
                <ProfileForm
                  onSave={handleCreate}
                  onCancel={() => setShowNewForm(false)}
                  saving={saving}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Active profile notice */}
        {activeProfileId && (
          <div className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-3 text-center">
            <p className="text-orange-300 text-xs">
              Meals are being generated for{" "}
              <span className="font-semibold">
                {profiles.find((p) => p.id === activeProfileId)?.displayName ?? "a household member"}
              </span>
              . Switch to "You" to generate for yourself.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
