import { Trash2 } from "lucide-react";
import React, { useState } from "react";
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

export default function TrashButton({
  onClick,
  ariaLabel = "Delete",
  title = "Delete",
  size = "md",
  confirm = false,
  confirmMessage = "Delete this item?",
  disabled = false,
  className = "",
  "data-testid": testId = "button-delete",
}: {
  onClick: () => void | Promise<void>;
  ariaLabel?: string;
  title?: string;
  size?: "sm" | "md" | "lg";
  confirm?: boolean;
  confirmMessage?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const sizeMap = {
    sm: "h-8 w-8 p-1.5 rounded-xl",     // 32px - compact for meal cards
    md: "h-9 w-9 p-2 rounded-xl",       // 36px
    lg: "h-10 w-10 p-2.5 rounded-2xl",  // 40px
  }[size];

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (disabled) return;
    
    if (confirm) {
      setShowConfirm(true);
    } else {
      await onClick();
    }
  }

  async function handleConfirm() {
    setShowConfirm(false);
    await onClick();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        data-testid={testId}
        className={`inline-flex items-center justify-center border border-white/15 bg-black/60 hover:bg-black text-white/90 hover:text-white shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30 !leading-none !text-[14px] ${sizeMap} ${className}`}
      >
        <Trash2 className="!h-4 !w-4 shrink-0" />
      </button>
      
      {confirm && (
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="bg-zinc-900 border-zinc-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Confirm Delete</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {confirmMessage}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-600 hover:bg-zinc-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirm}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
