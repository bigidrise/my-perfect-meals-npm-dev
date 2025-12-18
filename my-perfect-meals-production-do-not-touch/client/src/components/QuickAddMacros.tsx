import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logMacrosToBiometrics } from "@/lib/macrosApi";

export default function QuickAddMacros({ userId }: { userId: string }) {
  const [kcal, setKcal] = useState<string>(""); const [p, setP] = useState<string>("");
  const [c, setC] = useState<string>(""); const [f, setF] = useState<string>("");
  const [mealType, setMealType] = useState<"breakfast"|"lunch"|"dinner"|"snack"|"">("");

  async function save() {
    if (!kcal || !p || !c || !f) return;
    await logMacrosToBiometrics({
      mealType: mealType || undefined,
      calories: Number(kcal), protein: Number(p), carbs: Number(c), fat: Number(f),
    });
    setKcal(""); setP(""); setC(""); setF(""); setMealType("");
    // toast.success("Macros logged");
  }

  return (
    <div className="rounded-xl p-4 bg-white/5 border border-white/20">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Input placeholder="Calories" inputMode="numeric" value={kcal} onChange={e=>setKcal(e.target.value)} className="bg-black/30 border-white/30" />
        <Input placeholder="Protein grams" inputMode="numeric" value={p} onChange={e=>setP(e.target.value)} className="bg-black/30 border-white/30" />
        <Input placeholder="Carb grams" inputMode="numeric" value={c} onChange={e=>setC(e.target.value)} className="bg-black/30 border-white/30" />
        <Input placeholder="Fat grams" inputMode="numeric" value={f} onChange={e=>setF(e.target.value)} className="bg-black/30 border-white/30" />
        <Input placeholder="Meal Type (optional)" value={mealType} onChange={e=>setMealType(e.target.value as any)} className="bg-black/30 border-white/30" />
      </div>
      <div className="mt-3">
        <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Quick-Add Macros</Button>
      </div>
    </div>
  );
}
