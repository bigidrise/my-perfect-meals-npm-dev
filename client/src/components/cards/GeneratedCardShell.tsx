import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ReactNode } from "react";

interface GeneratedCardShellProps {
  title: string;
  icon?: ReactNode;
  description?: string;
  imageUrl?: string | null;
  imagePlaceholder?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function GeneratedCardShell({
  title,
  icon,
  description,
  imageUrl,
  imagePlaceholder,
  headerActions,
  children,
  actions,
  className = "",
}: GeneratedCardShellProps) {
  return (
    <Card className={`shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            {icon}
            {title}
          </CardTitle>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
        {description && <p className="text-sm text-white/70 mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {imageUrl ? (
          <div className="relative w-full aspect-square rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : imagePlaceholder ? (
          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/20 flex items-center justify-center border border-white/10">
            {imagePlaceholder}
          </div>
        ) : null}

        {children}

        {actions && <div className="space-y-2 pt-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}
