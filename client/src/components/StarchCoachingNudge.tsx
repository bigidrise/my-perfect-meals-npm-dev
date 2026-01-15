import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StarchCoachingNudgeProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  mealName?: string;
}

export function StarchCoachingNudge({ 
  open, 
  onConfirm, 
  onCancel,
  mealName 
}: StarchCoachingNudgeProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            🟠 Quick Coaching Tip
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <p>
              You've already planned a starchy carb meal for this day.
            </p>
            <p className="text-muted-foreground text-sm">
              Most people do better having just one starch meal per day, 
              ideally earlier rather than later.
            </p>
            {mealName && (
              <p className="text-sm font-medium">
                Adding: {mealName}
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel}>
            Choose Different Meal
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Continue Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
