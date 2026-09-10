import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PillButton, type PillButtonVariant } from "@/components/ui/pill-button";

interface IconPillOptionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: string;
  active?: boolean;
  variant?: PillButtonVariant;
  wrapperClassName?: string;
}

export function IconPillOption({
  icon,
  label,
  active = false,
  variant = "amber",
  wrapperClassName,
  className,
  ...buttonProps
}: IconPillOptionProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", wrapperClassName)}>
      <span aria-hidden="true" className="h-6 flex items-center justify-center text-lg leading-none">
        {icon}
      </span>
      <PillButton
        active={active}
        variant={variant}
        className={cn("normal-case tracking-normal text-[10px] px-3", className)}
        {...buttonProps}
      >
        {label}
      </PillButton>
    </div>
  );
}