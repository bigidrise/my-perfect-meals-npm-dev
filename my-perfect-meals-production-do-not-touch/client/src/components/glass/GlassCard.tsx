import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card
      {...props}
      className={cn(
        "bg-black/30 border border-white/20 backdrop-blur-lg",
        "rounded-2xl shadow-xl text-white",
        className
      )}
    >
      {children}
    </Card>
  );
}

export function GlassCardHeader({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CardHeader>) {
  return (
    <CardHeader
      {...props}
      className={cn(
        "flex items-center justify-between",
        "bg-white/5 rounded-t-2xl border-b border-white/15",
        className
      )}
    >
      {children}
    </CardHeader>
  );
}

export function GlassCardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CardTitle>) {
  return (
    <CardTitle
      {...props}
      className={cn("text-white font-semibold tracking-tight", className)}
    >
      {children}
    </CardTitle>
  );
}

export function GlassCardContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return (
    <CardContent
      {...props}
      className={cn("text-white/90", className)}
    >
      {children}
    </CardContent>
  );
}