import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useMealActions } from '@/hooks/useMealActions';
import { setReplaceCtx } from '@/lib/replacementContext';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function MealCardButtons({ mealInstanceId }: { mealInstanceId: string }) {
  const [, setLocation] = useLocation();
  const { logMutation, skipMutation } = useMealActions();

  const handleReplaceFromCraving = () => {
    console.log("🔧 OLD COMPONENT: Replace from Craving clicked for meal:", mealInstanceId);
    setReplaceCtx({ weekKey: "current", mealId: mealInstanceId, dayIndex: 0, mealType: "meal" });
    setLocation("/craving-creator");
  };

  const handleReplaceFromFridge = () => {
    console.log("🔧 OLD COMPONENT: Replace from Fridge clicked for meal:", mealInstanceId);
    setReplaceCtx({ weekKey: "current", mealId: mealInstanceId, dayIndex: 0, mealType: "meal" });
    setLocation("/fridge-rescue");
  };

  return (
    <div className="flex gap-2 flex-wrap pt-2">
      <Button 
        size="sm" 
        className="rounded-2xl" 
        onClick={() => logMutation.mutate({ id: mealInstanceId })} 
        disabled={logMutation.isPending}
      >
        Log Meal
      </Button>
      <Button 
        size="sm" 
        variant="secondary" 
        className="rounded-2xl" 
        onClick={() => skipMutation.mutate(mealInstanceId)} 
        disabled={skipMutation.isPending}
      >
        Don't Log
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-2xl"
          >
            Replace <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleReplaceFromCraving}>
            Replace from Craving Creator
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReplaceFromFridge}>
            Replace from Fridge Rescue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}