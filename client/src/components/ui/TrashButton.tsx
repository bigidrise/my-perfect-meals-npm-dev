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
  appearance = "default",
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
  appearance?: "default" | "meal-card";
  "data-testid"?: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const sizeMap = {
    sm: "h-8 w-8 p-1.5 rounded-xl",     // 32px - compact for meal cards
    md: "h-9 w-9 p-2 rounded-xl",       // 36px
    lg: "h-10 w-10 p-2.5 rounded-2xl",  // 40px
  }[size];
  const appearanceClass = appearance === "meal-card"
    ? "relative min-h-[44px] min-w-[44px] border-transparent bg-transparent text-red-400 shadow-none before:pointer-events-none before:absolute before:inset-1.5 before:rounded-lg before:border before:border-white/20 before:bg-black/20 before:content-[''] hover:before:border-red-400/50 hover:before:bg-red-500/10 hover:text-red-300 focus:ring-red-400/40"
    : "border-red-500/60 bg-red-600 text-white shadow-sm hover:bg-red-700 focus:ring-red-400/40";

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
        data-appearance={appearance}
        className={`inline-flex items-center justify-center border active:scale-[0.98] focus:outline-none focus:ring-2 !leading-none !text-[14px] ${appearanceClass} ${sizeMap} ${className}`}
      >
        <Trash2 className="relative z-[1] !h-4 !w-4 shrink-0" />
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
