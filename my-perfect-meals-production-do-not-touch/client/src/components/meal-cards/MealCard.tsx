import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MealCardButtons from '@/components/meal-calendar/MealCardButtons';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import MealPremadePicker from '@/components/pickers/MealPremadePicker';

interface MealCardProps {
  meal: {
    id: string;
    title: string;
    description?: string;
    calories?: number;
    protein?: number;
    status?: string;
    slot?: string;
  };
  mealType?: string; // Added mealType prop
  handleCreateAI?: () => void; // Added handleCreateAI prop
}

export default function MealCard({ meal, mealType, handleCreateAI }: MealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPremadePicker, setShowPremadePicker] = useState(false);

  return (
    <Card className="p-4 rounded-2xl shadow space-y-3 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{meal.title}</CardTitle>
        {meal.description && (
          <p className="text-sm text-gray-600">{meal.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {(meal.calories || meal.protein) && (
          <div className="flex gap-4 text-sm text-gray-700 mb-3">
            {meal.calories && <span>Calories: {meal.calories}</span>}
            {meal.protein && <span>Protein: {meal.protein}g</span>}
          </div>
        )}
        <div className="flex gap-2"> {/* Container for buttons */}
          {/* Create AI Button */}
          <button
            onClick={handleCreateAI}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl animate-pulse"
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Create AI
            </span>
          </button>

          {/* AI Premades Button - Only for Breakfast, Lunch, Dinner */}
          {(mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') && (
            <button
              onClick={() => {
                console.log("AI Premades Clicked");
                setShowPremadePicker(true);
              }}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl animate-pulse"
            >
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Premades
              </span>
            </button>
          )}
        </div>

        {/* MealCardButtons component remains unchanged */}
        <MealCardButtons mealInstanceId={meal.id} />
      </CardContent>

      {/* Meal Premade Picker Modal */}
      {(mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') && (
        <MealPremadePicker
          open={showPremadePicker}
          onClose={() => setShowPremadePicker(false)}
          mealType={mealType as 'breakfast' | 'lunch' | 'dinner'}
        />
      )}
    </Card>
  );
}