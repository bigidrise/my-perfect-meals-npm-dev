import { useState } from "react";
import { useTargetsStore, type Onboarding } from "@/state/targets.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Target, User } from "lucide-react";

export function TargetsBar() {
  const { onboarding, targets, setOnboarding, isConfigured } = useTargetsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Onboarding>>({
    sex: "male",
    goal: "maintenance",
    desiredWeightLb: 180,
    mealsPerDay: 3,
    snacksPerDay: 1,
    dietArchetype: "Balanced",
  });

  const handleApplyTargets = () => {
    if (formData.sex && formData.goal && formData.desiredWeightLb && formData.mealsPerDay !== undefined && formData.snacksPerDay !== undefined) {
      setOnboarding(formData as Onboarding);
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    if (onboarding) {
      setFormData(onboarding);
    }
    setIsEditing(true);
  };

  if (!isConfigured() || isEditing) {
    return (
      <Card className="bg-black/40 backdrop-blur-sm border-white/20 mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Set Your Nutrition Targets</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="sex" className="text-white/80">Sex</Label>
              <Select value={formData.sex} onValueChange={(value: "male" | "female") => setFormData(prev => ({ ...prev, sex: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="goal" className="text-white/80">Goal</Label>
              <Select value={formData.goal} onValueChange={(value: "loss" | "maintenance" | "gain") => setFormData(prev => ({ ...prev, goal: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loss">Weight Loss</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="gain">Weight Gain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="weight" className="text-white/80">Target Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                value={formData.desiredWeightLb || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, desiredWeightLb: parseInt(e.target.value) || 0 }))}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>

            <div>
              <Label htmlFor="meals" className="text-white/80">Meals/Day</Label>
              <Select value={formData.mealsPerDay?.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, mealsPerDay: parseInt(value) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Meals</SelectItem>
                  <SelectItem value="4">4 Meals</SelectItem>
                  <SelectItem value="5">5 Meals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="snacks" className="text-white/80">Snacks/Day</Label>
              <Select value={formData.snacksPerDay?.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, snacksPerDay: parseInt(value) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Snacks</SelectItem>
                  <SelectItem value="1">1 Snack</SelectItem>
                  <SelectItem value="2">2 Snacks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleApplyTargets} className="bg-blue-600 hover:bg-blue-700">
              Apply Targets
            </Button>
            {isConfigured() && (
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 backdrop-blur-sm border-white/20 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-400" />
              <span className="text-white/80">
                {onboarding?.sex === "male" ? "Male" : "Female"}, {onboarding?.goal}, {onboarding?.desiredWeightLb} lbs, {onboarding?.mealsPerDay} meals/day
              </span>
            </div>
            
            {targets && (
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-600/20 text-green-400 border-green-600/30">
                  {Math.round(targets.proteinPerMeal_g)}g protein/meal
                </Badge>
                <Badge variant="outline" className="bg-orange-600/20 text-orange-400 border-orange-600/30">
                  {targets.starchyCarbsPerDay_g_min}-{targets.starchyCarbsPerDay_g_max}g carbs/day
                </Badge>
                <Badge variant="outline" className="bg-purple-600/20 text-purple-400 border-purple-600/30">
                  {targets.vegCupsPerMeal_min}-{targets.vegCupsPerMeal_max} cups veg/meal
                </Badge>
              </div>
            )}
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleEdit} className="text-white hover:text-white/90">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mt-2 text-sm text-white/60">
          Sized to your targets from onboarding. We set protein, carbs, and veg. You pick the foods; we keep it safe.
        </div>
      </CardContent>
    </Card>
  );
}