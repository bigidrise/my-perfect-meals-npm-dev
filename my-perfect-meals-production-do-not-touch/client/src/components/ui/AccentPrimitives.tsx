import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCENTS, Accent } from "@/lib/accents";

export function AccentButton({
  accent = "emerald",
  className,
  ...props
}: React.ComponentProps<typeof Button> & { accent?: Accent }) {
  const ui = ACCENTS[accent];
  return (
    <Button
      {...props}
      className={cn(ui.button, ui.buttonHover, ui.buttonText, className)}
    />
  );
}

export function AccentBorder({
  accent = "emerald",
  as: As = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { accent?: Accent; as?: any }) {
  const ui = ACCENTS[accent];
  return (
    <As
      {...props}
      className={cn("border", ui.cardBorder, ui.hoverCardBorder, className)}
    />
  );
}
