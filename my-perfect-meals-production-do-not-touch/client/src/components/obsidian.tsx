import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronUp } from "lucide-react";

export type ObsidianAccent =
  | "emerald"
  | "red"
  | "purple"
  | "blue"
  | "orange"
  | "indigo"
  | "amber"
  | "rose"
  | "teal"
  | "slate";

const ACCENT_MAP: Record<
  ObsidianAccent,
  {
    gradient: string;
    border: string;
    borderSoft: string;
    glow: string;
    icon: string;
    navBtn: string;
  }
> = {
  emerald: {
    gradient: "from-emerald-950 via-emerald-900 to-black",
    border: "border-emerald-400/70",
    borderSoft: "border-emerald-400/40",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    icon: "text-emerald-300",
    navBtn:
      "bg-emerald-900/40 backdrop-blur-none border border-emerald-400/60 hover:bg-emerald-800/50",
  },
  red: {
    gradient: "from-red-950 via-red-900 to-black",
    border: "border-red-400/70",
    borderSoft: "border-red-400/40",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    icon: "text-red-300",
    navBtn: "bg-red-900/40 backdrop-blur-none border border-red-400/60 hover:bg-red-800/50",
  },
  purple: {
    gradient: "from-purple-950 via-purple-900 to-black",
    border: "border-purple-400/70",
    borderSoft: "border-purple-400/40",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    icon: "text-purple-300",
    navBtn:
      "bg-purple-900/40 backdrop-blur-none border border-purple-400/60 hover:bg-purple-800/50",
  },
  blue: {
    gradient: "from-blue-950 via-blue-900 to-black",
    border: "border-blue-400/70",
    borderSoft: "border-blue-400/40",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    icon: "text-blue-300",
    navBtn:
      "bg-blue-900/40 backdrop-blur-none border border-blue-400/60 hover:bg-blue-800/50",
  },
  orange: {
    gradient: "from-orange-950 via-orange-900 to-black",
    border: "border-orange-400/70",
    borderSoft: "border-orange-400/40",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
    icon: "text-orange-300",
    navBtn:
      "bg-orange-900/40 backdrop-blur-none border border-orange-400/60 hover:bg-orange-800/50",
  },
  indigo: {
    gradient: "from-indigo-950 via-indigo-900 to-black",
    border: "border-indigo-400/70",
    borderSoft: "border-indigo-400/40",
    glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    icon: "text-indigo-300",
    navBtn:
      "bg-indigo-900/40 backdrop-blur-none border border-indigo-400/60 hover:bg-indigo-800/50",
  },
  amber: {
    gradient: "from-amber-950 via-amber-900 to-black",
    border: "border-amber-400/70",
    borderSoft: "border-amber-400/40",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    icon: "text-amber-300",
    navBtn:
      "bg-amber-900/40 backdrop-blur-none border border-amber-400/60 hover:bg-amber-800/50",
  },
  rose: {
    gradient: "from-rose-950 via-rose-900 to-black",
    border: "border-rose-400/70",
    borderSoft: "border-rose-400/40",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
    icon: "text-rose-300",
    navBtn:
      "bg-rose-900/40 backdrop-blur-none border border-rose-400/60 hover:bg-rose-800/50",
  },
  teal: {
    gradient: "from-teal-950 via-teal-900 to-black",
    border: "border-teal-400/70",
    borderSoft: "border-teal-400/40",
    glow: "shadow-[0_0_20px_rgba(20,184,166,0.15)]",
    icon: "text-teal-300",
    navBtn:
      "bg-teal-900/40 backdrop-blur-none border border-teal-400/60 hover:bg-teal-800/50",
  },
  slate: {
    gradient: "from-slate-950 via-slate-900 to-black",
    border: "border-slate-400/70",
    borderSoft: "border-slate-400/40",
    glow: "shadow-[0_0_20px_rgba(148,163,184,0.15)]",
    icon: "text-slate-300",
    navBtn:
      "bg-slate-900/40 backdrop-blur-none border border-slate-400/60 hover:bg-slate-800/50",
  },
};

export function ObsidianPage({
  accent,
  children,
}: {
  accent: ObsidianAccent;
  children: React.ReactNode;
}) {
  const a = ACCENT_MAP[accent];
  return (
    <div className={`min-h-screen bg-gradient-to-br ${a.gradient} p-6`}>
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

export function ObsidianBackButton({
  onClick,
  className = "",
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`fixed top-2 left-2 sm:top-4 sm:left-4 z-50 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 font-semibold text-sm sm:text-base transition-all ${className}`}
    >
      {children}
    </button>
  );
}

export function ObsidianHeader({
  accent,
  icon,
  title,
  subtitle,
}: {
  accent: ObsidianAccent;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const a = ACCENT_MAP[accent];
  return (
    <div
      className={`bg-black/50 backdrop-blur-lg ${a.border} rounded-2xl p-8 text-center mb-8 mt-14 ${a.glow}`}
    >
      {!!icon && <div className={`flex items-center justify-center gap-3 mb-4 ${a.icon}`}>{icon}</div>}
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-white/90 mt-2">{subtitle}</p>}
    </div>
  );
}

export function ObsidianCard({
  accent,
  title,
  children,
  className = "",
}: {
  accent: ObsidianAccent;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const a = ACCENT_MAP[accent];
  return (
    <Card className={`bg-black/50 ${a.border} ${a.glow} ${className}`}>
      {title ? (
        <>
          <CardHeader>
            <CardTitle className="text-white">{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-white">{children}</CardContent>
        </>
      ) : (
        <CardContent className="text-white">{children}</CardContent>
      )}
    </Card>
  );
}

export function navButtonClass(accent: ObsidianAccent) {
  return `${ACCENT_MAP[accent].navBtn} text-white rounded-xl shadow-lg font-semibold text-sm sm:text-base transition-all`;
}

export function useShowBackToTop(threshold = 300) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow((window.scrollY || 0) > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return show;
}

export function BackToTopButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center mt-12">
      <Button
        onClick={onClick}
        className="!rounded-full bg-black/30 backdrop-blur-lg border border-black/50 hover:bg-black/40 text-white px-6 py-3"
      >
        <ChevronUp className="h-4 w-4 mr-2" />
        Back to Top
      </Button>
    </div>
  );
}
