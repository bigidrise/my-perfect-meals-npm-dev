import { saveDraft, MacroDraft } from "@/lib/macrosDraft";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

type Props = { 
  draft: MacroDraft; 
  label?: string;
  className?: string;
};

export default function QuickLogMacrosButton({ 
  draft, 
  label = "Add to Biometrics",
  className = "bg-emerald-600 hover:bg-emerald-700 text-white"
}: Props) {
  const [, setLocation] = useLocation();

  function handleClick() {
    const clean: MacroDraft = {
      protein_g: Math.max(0, Math.round(draft.protein_g)),
      carbs_g: Math.max(0, Math.round(draft.carbs_g)),
      fat_g: Math.max(0, Math.round(draft.fat_g)),
      calories: draft.calories && draft.calories > 0 ? Math.round(draft.calories) : undefined,
      dateISO: draft.dateISO,
      mealSlot: draft.mealSlot,
    };
    saveDraft(clean);
    setLocation("/my-biometrics?draft=1");
  }

  return (
    <Button
      data-testid="button-quick-log-macros"
      onClick={handleClick}
      className={className}
      size="sm"
    >
      {label}
    </Button>
  );
}
