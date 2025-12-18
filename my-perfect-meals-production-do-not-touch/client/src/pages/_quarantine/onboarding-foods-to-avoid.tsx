import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FoodSelector } from "@/components/FoodSelector";
import { OnboardingFooter } from "@/components/OnboardingFooter";
import { useGetPreferences, useUpdatePreferences } from "@/hooks/useUserPreferences";
import { toast } from "@/hooks/use-toast";
import { Shield, AlertTriangle } from "lucide-react";

export function FoodsToAvoid() {
  const [, setLocation] = useLocation();
  const userId = import.meta.env.VITE_DEMO_USER_ID || "1";
  
  const { data: preferences, isLoading } = useGetPreferences(userId);
  const updateMutation = useUpdatePreferences(userId);
  
  const [avoidedFoods, setAvoidedFoods] = useState<string[]>([]);

  // Load existing preferences
  useEffect(() => {
    if (preferences?.avoidedFoods) {
      setAvoidedFoods(preferences.avoidedFoods);
    }
  }, [preferences]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ avoidedFoods });
      
      toast({
        title: "Foods to Avoid Saved",
        description: "Your food restrictions have been saved successfully.",
      });
      
      // Navigate to next step (complete onboarding or continue flow)
      setLocation("/onboarding"); // or wherever the next step should be
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save your food restrictions. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    setLocation("/onboarding"); // Navigate back to previous step
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-orange-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Foods to Avoid
          </h1>
          <p className="text-gray-600">
            Tell us about any foods you need to avoid for health, allergies, or personal reasons.
          </p>
        </div>

        {/* Main Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-orange-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Food Restrictions
            </CardTitle>
            <CardDescription>
              We'll never include these ingredients in your meals. This ensures your safety and preferences are always respected.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Food Selector */}
            <FoodSelector
              selectedFoods={avoidedFoods}
              onFoodsChange={setAvoidedFoods}
              placeholder="Search for foods to avoid..."
              helperText="We'll never include these ingredients in your meals."
              allowCustom={true}
            />

            {/* Information Box */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-medium text-orange-800 mb-2">Important Information:</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• These restrictions are hard constraints - we will never suggest meals containing these foods</li>
                <li>• Include both the food name and common variants (e.g., "dairy" and "milk")</li>
                <li>• You can always update this list later in your settings</li>
                <li>• Our AI will check ingredients and suggest alternatives when needed</li>
              </ul>
            </div>

            {/* Progress indicator */}
            {avoidedFoods.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  ✓ {avoidedFoods.length} food{avoidedFoods.length !== 1 ? 's' : ''} marked to avoid
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8">
          <OnboardingFooter
            isSaving={updateMutation.isPending}
            onSave={handleSave}
            onBack={handleBack}
            nextLabel="Save & Continue"
            backLabel="Back"
            showBack={true}
          />
        </div>

        {/* Skip option */}
        <div className="text-center mt-4">
          <button
            onClick={() => setLocation("/onboarding")}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip for now - I'll add restrictions later
          </button>
        </div>
      </div>
    </div>
  );
}