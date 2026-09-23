import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { UniversalDialog, ModalFooter } from "@/components/ui/universal-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BouncingDots } from "@/components/ui/bouncing-dots";
import { CREATOR_CUISINE_OPTIONS, CREATOR_DIET_OPTIONS } from "@/utils/getEffectiveDietPreference";
import type {
  OneTouchCreator,
  OneTouchCuisine,
  OneTouchEatingStyle,
} from "@/lib/oneTouchCreate";

interface OneTouchCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: OneTouchCreator;
  defaultServings: number;
  savedCuisine?: string | null;
  savedDiet?: string | string[] | null;
  busy?: boolean;
  onSubmit: (request: {
    servings: number;
    cuisine: OneTouchCuisine;
    eatingStyle: OneTouchEatingStyle;
  }) => void;
}

export default function OneTouchCreateModal({
  open,
  onOpenChange,
  creator,
  defaultServings,
  savedCuisine,
  savedDiet,
  busy = false,
  onSubmit,
}: OneTouchCreateModalProps) {
  const [servings, setServings] = useState(() => Math.min(10, Math.max(1, defaultServings)));
  const [cuisineMode, setCuisineMode] = useState<"profile" | "surprise" | "explicit">("profile");
  const [cuisineValue, setCuisineValue] = useState("");
  const [dietMode, setDietMode] = useState<"profile" | "explicit">("profile");
  const [dietValue, setDietValue] = useState("");
  const profileCuisine = savedCuisine?.trim() || "your preferences";
  const profileDiet = useMemo(() => {
    const value = Array.isArray(savedDiet) ? savedDiet.join(", ") : savedDiet;
    return value?.trim() || "your profile";
  }, [savedDiet]);

  useEffect(() => {
    if (!open) return;
    setServings(Math.min(10, Math.max(1, defaultServings)));
    setCuisineMode("profile");
    setCuisineValue("");
    setDietMode("profile");
    setDietValue("");
  }, [open, defaultServings]);

  const submit = () => {
    onSubmit({
      servings,
      cuisine: cuisineMode === "explicit"
        ? { mode: "explicit", value: cuisineValue }
        : { mode: cuisineMode },
      eatingStyle: dietMode === "explicit"
        ? { mode: "explicit", value: dietValue }
        : { mode: "profile" },
    });
  };

  return (
    <UniversalDialog
      open={open}
      onOpenChange={onOpenChange}
      title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-orange-300" /> {creator === "create_a_dish" ? "Create a Dish Menu" : "Craving Menu"}</span>}
      description="Let My Perfect Meals create a menu of ideas for you. Change anything below only if you want to."
      className="border-orange-300/20 bg-slate-950"
      footer={
        <ModalFooter className="border-t-0 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/70 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy || (cuisineMode === "explicit" && !cuisineValue) || (dietMode === "explicit" && !dietValue)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-black text-white disabled:opacity-50">
            {busy ? <><BouncingDots dotClassName="h-1.5 w-1.5" /> Creating…</> : "✨ Create 3 Ideas"}
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-5 py-1">
        <div>
          <label htmlFor={`one-touch-servings-${creator}`} className="text-sm font-bold text-white">Servings</label>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" aria-label="Decrease servings" onClick={() => setServings((value) => Math.max(1, value - 1))} disabled={servings <= 1 || busy} className="h-10 w-10 rounded-xl border border-white/15 text-lg text-white disabled:opacity-40">−</button>
            <output id={`one-touch-servings-${creator}`} className="min-w-12 text-center text-lg font-black text-white">{servings}</output>
            <button type="button" aria-label="Increase servings" onClick={() => setServings((value) => Math.min(10, value + 1))} disabled={servings >= 10 || busy} className="h-10 w-10 rounded-xl border border-white/15 text-lg text-white disabled:opacity-40">+</button>
          </div>
          <p className="mt-1 text-xs text-white/50">Recipe quantity only; your authenticated profile remains the source of nutrition and safety context.</p>
        </div>

        <div>
          <label className="text-sm font-bold text-white">Cuisine</label>
          <Select value={cuisineMode === "explicit" ? `explicit:${cuisineValue}` : cuisineMode} onValueChange={(value) => {
            if (value === "profile" || value === "surprise") setCuisineMode(value);
            else {
              setCuisineMode("explicit");
              setCuisineValue(value.slice("explicit:".length));
            }
          }}>
            <SelectTrigger className="mt-2 border-white/15 bg-white/5 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="profile">Use My Preferences ({profileCuisine})</SelectItem>
              <SelectItem value="surprise">Surprise Me</SelectItem>
              {CREATOR_CUISINE_OPTIONS.map((option) => <SelectItem key={option.value} value={`explicit:${option.value}`}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-bold text-white">Dietary Preference</label>
          <Select value={dietMode === "explicit" ? `explicit:${dietValue}` : "profile"} onValueChange={(value) => {
            if (value === "profile") setDietMode("profile");
            else {
              setDietMode("explicit");
              setDietValue(value.slice("explicit:".length));
            }
          }}>
            <SelectTrigger className="mt-2 border-white/15 bg-white/5 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="profile">Use My Profile ({profileDiet})</SelectItem>
              {CREATOR_DIET_OPTIONS.map((option) => <SelectItem key={option.value} value={`explicit:${option.value}`}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs leading-relaxed text-white/55">Your existing allergies, food preferences, nutrition, and clinical settings are automatically considered.</p>
      </div>
    </UniversalDialog>
  );
}