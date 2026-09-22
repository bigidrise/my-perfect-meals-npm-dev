import { cn } from "@/lib/utils";

interface BouncingDotsProps {
  className?: string;
  dotClassName?: string;
}

export function BouncingDots({ className, dotClassName }: BouncingDotsProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          data-testid="bouncing-dot"
          className={cn("h-2.5 w-2.5 rounded-full bg-violet-300 animate-bounce", dotClassName)}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}