import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock, Calendar, Eye } from "lucide-react";
import { formatDateLocal } from "@/utils/midnight";

interface LockedDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateISO: string;
  onViewOnly: () => void;
  onCreateNewDay: () => void;
}

export function LockedDayDialog({
  open,
  onOpenChange,
  dateISO,
  onViewOnly,
  onCreateNewDay,
}: LockedDayDialogProps) {
  const formattedDate = formatDateLocal(dateISO, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-black/90 border-orange-500/30 backdrop-blur-xl max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-orange-400" />
            </div>
            <AlertDialogTitle className="text-white text-lg">
              Day is Locked
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-white/70 text-sm">
            <span className="font-medium text-orange-300">{formattedDate}</span> has been saved to Biometrics and is now locked. 
            Your meals are safe! You can view this day or switch to today's plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel
            onClick={onCreateNewDay}
            className="flex-1 bg-black/40 border-white/20 text-white hover:bg-black/60 hover:text-white"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Switch to Today
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onViewOnly}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            Stay Here
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
