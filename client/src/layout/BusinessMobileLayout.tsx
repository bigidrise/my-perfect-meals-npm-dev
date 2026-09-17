import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  CircleGauge,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

type ActiveWorkspace = {
  organizationName?: string;
  locationName?: string;
};

const MOBILE_BUSINESS_NAV = [
  { path: "/business-center", label: "Suite", icon: LayoutDashboard, exact: true },
  { path: "/business-organizations", label: "Organizations", icon: Building2 },
  { path: "/business-dashboard", label: "Dashboard", icon: CircleGauge },
  { path: "/org-success-center", label: "Success", icon: Handshake },
  { path: "/business-center/academy", label: "Academy", icon: GraduationCap },
] as const;

function titleForRoute(path: string): string {
  if (path === "/business-organizations") return "Organization Hub";
  if (path === "/business-dashboard" || path === "/business/dashboard") {
    return "Organization Dashboard";
  }
  if (path === "/org-success-center") return "Success Center";
  if (path.startsWith("/business-center/academy")) return "Academy";
  if (path.startsWith("/business-center/partners")) return "Partner Programs";
  if (path.startsWith("/business-center/promotions")) return "Promotions";
  if (path.startsWith("/business-center/affiliate")) return "Partner & Revenue";
  if (path === "/business-center") return "Business Suite";
  return "Business Suite";
}

export default function BusinessMobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [location] = useLocation();
  const [workspace, setWorkspace] = useState<ActiveWorkspace | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/business/workspace/active", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active) setWorkspace(payload?.workspace ?? null);
      })
      .catch(() => {
        if (active) setWorkspace(null);
      });
    return () => {
      active = false;
    };
  }, [location]);

  const contextLabel = useMemo(() => {
    if (!workspace?.organizationName) return "Business workspace";
    return workspace.locationName
      ? `${workspace.organizationName} · ${workspace.locationName}`
      : workspace.organizationName;
  }, [workspace]);

  return (
    <div
      className="business-mobile-shell min-h-screen bg-neutral-950 text-white"
      data-testid="business-mobile-layout"
      style={{
        "--business-safe-top": "env(safe-area-inset-top, 0px)",
      } as CSSProperties}
    >
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl"
        style={{ paddingTop: "var(--business-safe-top)" }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <Link
            href="/business-organizations"
            className="rounded-lg p-2 text-orange-400 transition-colors active:bg-white/10"
            aria-label="Switch organization workspace"
          >
            <Building2 className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{titleForRoute(location)}</h1>
            <p className="truncate text-[11px] text-white/50">{contextLabel}</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-semibold text-white/70 transition-colors active:bg-white/10"
            aria-label="Exit to Personal Space"
          >
            <LogOut className="h-4 w-4" />
            Personal Space
          </Link>
        </div>
      </header>

      <main
        className="min-h-screen"
        style={{
          paddingTop: "calc(var(--business-safe-top) + 3.5rem)",
          paddingBottom: "calc(var(--safe-bottom) + 4.75rem)",
        }}
        data-testid="business-mobile-content"
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-xl"
        style={{ paddingBottom: "var(--safe-bottom)" }}
        aria-label="Business workspace navigation"
        data-testid="business-mobile-navigation"
      >
        <div className="grid h-16 grid-cols-5">
          {MOBILE_BUSINESS_NAV.map(({ path, label, icon: Icon, exact }) => {
            const active = exact
              ? location === path
              : location === path || location.startsWith(`${path}/`);
            return (
              <Link
                key={path}
                href={path}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors ${
                  active ? "text-orange-400" : "text-white/50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}