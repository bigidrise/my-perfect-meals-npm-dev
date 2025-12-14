import { Button } from "@/components/ui/button";

interface SaveButtonProps {
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SaveButton({ 
  isPending, 
  isError, 
  isSuccess, 
  onClick, 
  disabled, 
  className = "",
  children = "Save"
}: SaveButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <Button 
        disabled={isPending || disabled} 
        onClick={onClick} 
        className={`${className}`}
      >
        {isPending ? "Saving…" : children}
      </Button>
      {isSuccess && (
        <span className="text-xs opacity-70">
          Saved • {new Date().toLocaleTimeString()}
        </span>
      )}
      {isError && (
        <span className="text-xs text-red-400">
          Save failed. Auto-retrying…
        </span>
      )}
    </div>
  );
}