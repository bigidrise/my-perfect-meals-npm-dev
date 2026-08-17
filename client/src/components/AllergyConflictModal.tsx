/**
 * AllergyConflictModal
 *
 * Shown when a meal request conflicts with the user's allergy profile.
 * Instead of a hard block, it offers a clear three-way choice:
 *
 *  "Make it safe for me"  — DAL path: Chef adapts the dish (no PIN needed)
 *  "Make the original"    — Safety PIN path: user overrides with PIN
 *  "Cancel"               — user backs out
 *
 * For identity-collapse conflicts (the allergen IS the dish), the "Make it safe"
 * option is replaced with a clearer "Find me something similar" message.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChefHat, ShieldAlert, X } from "lucide-react";

export interface AllergyConflictPayload {
  type: "conflict_adaptable" | "conflict_identity_collapse";
  allergens: string[];
  matchedTerms: string[];
  dishName: string;
}

interface AllergyConflictModalProps {
  conflict: AllergyConflictPayload | null;
  onMakeSafe: () => void;
  onMakeOriginal: () => void;
  onCancel: () => void;
}

function formatAllergenList(allergens: string[]): string {
  if (allergens.length === 0) return "an allergen";
  if (allergens.length === 1) return allergens[0];
  if (allergens.length === 2) return `${allergens[0]} and ${allergens[1]}`;
  return `${allergens.slice(0, -1).join(", ")}, and ${allergens[allergens.length - 1]}`;
}

export function AllergyConflictModal({
  conflict,
  onMakeSafe,
  onMakeOriginal,
  onCancel,
}: AllergyConflictModalProps) {
  if (!conflict) return null;

  const isIdentityCollapse = conflict.type === "conflict_identity_collapse";
  const allergenLabel = formatAllergenList(conflict.allergens);
  const dishLabel = conflict.dishName || "this dish";

  return (
    <Dialog open={!!conflict} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-base">Allergy Conflict Detected</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            {isIdentityCollapse ? (
              <>
                <strong className="text-foreground capitalize">{dishLabel}</strong> is
                built around <strong className="text-foreground">{allergenLabel}</strong>,
                which conflicts with your allergy profile. Removing it would fundamentally
                change what this dish is.
              </>
            ) : (
              <>
                <strong className="text-foreground capitalize">{dishLabel}</strong>{" "}
                traditionally contains <strong className="text-foreground">{allergenLabel}</strong>,
                which is on your allergy profile. Chef can adapt it to be safe for you, or
                you can override with your Safety PIN to make the original.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {!isIdentityCollapse && (
            <Button
              onClick={onMakeSafe}
              className="w-full justify-start gap-3 bg-green-600 hover:bg-green-700 text-white"
            >
              <ChefHat className="h-4 w-4 shrink-0" />
              <span className="text-left">
                <span className="font-semibold block">Make it safe for me</span>
                <span className="text-xs opacity-90 font-normal">
                  Chef adapts the recipe — no PIN required
                </span>
              </span>
            </Button>
          )}

          <Button
            onClick={onMakeOriginal}
            variant="outline"
            className="w-full justify-start gap-3 border-amber-300 hover:bg-amber-50"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-left">
              <span className="font-semibold block">
                {isIdentityCollapse ? "Make the original (Safety PIN)" : "Make the original"}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Override with your Safety PIN — consume at your own risk
              </span>
            </span>
          </Button>

          <Button
            onClick={onCancel}
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
