import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock } from "lucide-react";
import { formatDateDisplay } from "@/utils/midnight";

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
}: LockedDayDialogProps) {
  const formattedDate = dateISO
    ? formatDateDisplay(dateISO, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

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
            <span className="font-medium text-orange-300">{formattedDate}</span> has been saved to Biometrics and is now locked. Your meals are safe.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogAction
            onClick={onViewOnly}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
          >
            Got it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
