import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { GlassCard, GlassCardContent } from "@/components/glass";

interface VariantSelectorProps {
  value: "A" | "B" | "AUTO";
  onChange: (variant: "A" | "B" | "AUTO") => void;
}

export function VariantSelector({ value, onChange }: VariantSelectorProps) {
  return (
    <GlassCard>
      <GlassCardContent className="p-4">
        <p className="text-white font-semibold mb-3">Planning System</p>
        <RadioGroup 
          value={value} 
          onValueChange={(variant) => onChange(variant as "A" | "B" | "AUTO")} 
          className="grid grid-cols-3 gap-3"
        >
          <div className="flex items-center space-x-2 rounded-xl p-3 bg-white/5 hover:bg-white/10 transition-colors">
            <RadioGroupItem id="auto" value="AUTO" />
            <Label htmlFor="auto" className="text-white/90 cursor-pointer">Auto</Label>
          </div>
          <div className="flex items-center space-x-2 rounded-xl p-3 bg-white/5 hover:bg-white/10 transition-colors">
            <RadioGroupItem id="a" value="A" />
            <Label htmlFor="a" className="text-white/90 cursor-pointer">Option A</Label>
          </div>
          <div className="flex items-center space-x-2 rounded-xl p-3 bg-white/5 hover:bg-white/10 transition-colors">
            <RadioGroupItem id="b" value="B" />
            <Label htmlFor="b" className="text-white/90 cursor-pointer">Option B</Label>
          </div>
        </RadioGroup>
        <p className="text-white/60 text-sm mt-3">
          Auto splits A/B without users thinking about it.
        </p>
        
        {/* Detailed descriptions */}
        <div className="mt-4 space-y-2 text-xs text-white/70">
          <div className="flex gap-2">
            <span className="font-medium text-blue-300">Option A:</span>
            <span>Curated templates with reliable nutrition and simple grocery lists</span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-emerald-300">Option B:</span>
            <span>Dynamic AI generation with high variety and precise macro targeting</span>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}