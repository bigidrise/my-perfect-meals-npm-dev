import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logMeal, skipMeal, replaceAndOptionalLog } from '@/lib/api/mealActions';

export function useMealActions() {
  const qc = useQueryClient();
  const invalidateDay = () => {
    // Invalidate queries commonly used on dashboard/board
    qc.invalidateQueries({ queryKey: ['weekly-meal-board'] });
    qc.invalidateQueries({ queryKey: ['day-nutrition-totals'] });
    qc.invalidateQueries({ queryKey: ['compliance'] });
    qc.invalidateQueries({ queryKey: ['proClientCompliance'] });
    qc.invalidateQueries({ queryKey: ['meal-instances'] });
    window.dispatchEvent(new CustomEvent('mpm:nutritionActivityUpdated'));
  };

  const logMutation = useMutation({ 
    mutationFn: ({ id, body }: { id: string; body?: any }) => logMeal(id, body), 
    onSuccess: invalidateDay 
  });
  
  const skipMutation = useMutation({ 
    mutationFn: (id: string) => skipMeal(id), 
    onSuccess: invalidateDay 
  });
  
  const replaceMutation = useMutation({ 
    mutationFn: ({ id, body }: { id: string; body: any }) => replaceAndOptionalLog(id, body), 
    onSuccess: invalidateDay 
  });

  return { logMutation, skipMutation, replaceMutation };
}