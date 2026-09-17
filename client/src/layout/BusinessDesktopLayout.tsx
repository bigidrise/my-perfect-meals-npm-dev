import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  CircleGauge,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Megaphone,
} from "lucide-react";
import DesktopHeader from "./DesktopHeader";

const BUSINESS_NAV = [
  {
    path: "/business-center",
    label: "Business Suite",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    path: "/business-organizations",
    label: "Organizations",
    icon: Building2,
  },
  {
    path: "/business-dashboard",
    label: "Organization Dashboard",
    icon: CircleGauge,
  },
  {
    path: "/org-success-center",
    label: "Success Center",
    icon: Handshake,
  },
  {
    path: "/business-center/academy",
    label: "Academy",
    icon: GraduationCap,
  },
  {
    path: "/business-center/partners",
    label: "Partner Programs",
    icon: Handshake,
  },
  {
    path: "/business-center/promotions",
    label: "Promotions",
    icon: Megaphone,
  },
] as const;

export default function BusinessDesktopLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-white">
      <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-black">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-lg font-bold tracking-tight">
            My Perfect Meals
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-orange-400">
            Business Suite
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {BUSINESS_NAV.map(({ path, label, icon: Icon, exact }) => {
            const active = exact
              ? location === path
              : location === path || location.startsWith(`${path}/`);
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-orange-500/15 font-medium text-orange-400"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Personal Space
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DesktopHeader />
        <main className="relative flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}