import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MacroProfile,
  MACRO_PROFILES,
  computeMacrosFromProfile,
  getProfileById,
} from "@/lib/macroProfiles";
import { Meal } from "@/components/MealCard";
import { v4 as uuidv4 } from "uuid";

interface AdditionalMacrosModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (meal: Meal) => void;
  proteinDeficit?: number;
  carbsDeficit?: number;
}

export default function AdditionalMacrosModal({
  open,
  onClose,
  onAdd,
  proteinDeficit = 0,
  carbsDeficit = 0,
}: AdditionalMacrosModalProps) {
  const [proteinInput, setProteinInput] = useState("");
  const [carbsInput, setCarbsInput] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<MacroProfile>("chicken");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const protein = parseInt(proteinInput) || 0;
    const carbs = parseInt(carbsInput) || 0;

    if (protein === 0 && carbs === 0) {
      setError("Enter an amount to add");
      return;
    }

    setError("");

    const computed = computeMacrosFromProfile(protein, carbs, 0, selectedProfile);
    const profileInfo = getProfileById(selectedProfile);

    const meal: Meal = {
      id: uuidv4(),
      title: `Quick Add – ${profileInfo?.label || selectedProfile}`,
      description: `${protein > 0 ? `${protein}g protein` : ""}${protein > 0 && carbs > 0 ? " + " : ""}${carbs > 0 ? `${carbs}g carbs` : ""} from ${profileInfo?.label || selectedProfile}`,
      nutrition: {
        calories: computed.calories,
        protein: computed.protein,
        carbs: computed.carbs,
        fat: computed.fat,
      },
      entryType: "quick",
      ingredients: [`${profileInfo?.label || selectedProfile}`],
      instructions: ["Quick macro addition"],
    };

    onAdd(meal);
    
    setProteinInput("");
    setCarbsInput("");
    setSelectedProfile("chicken");
    onClose();
  };

  const handleClose = () => {
    setProteinInput("");
    setCarbsInput("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-neutral-900 border border-white/20 text-white max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Quick Add Protein/Carbs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-white/70 text-center">
            Need more protein or carbs? Enter the amount you want and pick a source.
          </p>

          {(proteinDeficit > 0 || carbsDeficit > 0) && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-white/80">
                {proteinDeficit > 0 && <span>You're short <strong>{proteinDeficit}g protein</strong></span>}
                {proteinDeficit > 0 && carbsDeficit > 0 && <span> and </span>}
                {carbsDeficit > 0 && <span><strong>{carbsDeficit}g carbs</strong></span>}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/80 font-medium mb-1 block">
                Protein (g)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={proteinInput}
                onChange={(e) => setProteinInput(e.target.value)}
                className="bg-black/30 border-white/20 text-white text-lg h-12"
                aria-label="Protein in grams"
              />
            </div>
            <div>
              <label className="text-xs text-white/80 font-medium mb-1 block">
                Carbs (g)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={carbsInput}
                onChange={(e) => setCarbsInput(e.target.value)}
                className="bg-black/30 border-white/20 text-white text-lg h-12"
                aria-label="Carbs in grams"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/80 font-medium mb-1 block">
              Pick a source
            </label>
            <Select
              value={selectedProfile}
              onValueChange={(v) => setSelectedProfile(v as MacroProfile)}
            >
              <SelectTrigger 
                className="w-full bg-black/30 border-white/20 text-white h-12"
                aria-label="Select food source"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/20">
                {MACRO_PROFILES.map((profile) => (
                  <SelectItem
                    key={profile.id}
                    value={profile.id}
                    className="text-white hover:bg-white/10"
                  >
                    {profile.label} ({profile.hint})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 h-12 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              aria-label="Add to today"
            >
              Add to Today
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
