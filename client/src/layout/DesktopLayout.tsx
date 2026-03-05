import { ReactNode, useMemo } from "react";
import { Link, useLocation } from "wouter";
import DesktopHeader from "./DesktopHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calculator,
  ChefHat,
  ShoppingCart,
  Refrigerator,
  Heart,
  Activity,
  Users,
  Building2,
  CreditCard,
  Settings,
  MoreHorizontal,
} from "lucide-react";

interface Props {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: any;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const coreNavSections: NavSection[] = [
  {
    label: "HOME",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "MEAL INTELLIGENCE",
    items: [
      { path: "/macro-counter", label: "Macro Calculator", icon: Calculator },
      { path: "/select-builder", label: "Meal Builders", icon: ChefHat },
      { path: "/fridge-rescue", label: "Fridge Rescue", icon: Refrigerator },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { path: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
      { path: "/saved-meals", label: "Saved Meals", icon: Heart },
      { path: "/my-biometrics", label: "My Biometrics", icon: Activity },
    ],
  },
];

const accountItems: NavItem[] = [
  { path: "/pricing", label: "Billing", icon: CreditCard },
  { path: "/profile", label: "Settings", icon: Settings },
  { path: "/more", label: "More", icon: MoreHorizontal },
];

export default function DesktopLayout({ children }: Props) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navSections = useMemo(() => {
    const sections = [...coreNavSections];

    const role = user?.professionalRole;
    if (role === "physician" || role === "trainer") {
      const careTeamPath = role === "physician" ? "/care-team/physician" : "/care-team/trainer";
      const proPortalPath = role === "physician" ? "/pro/physician-clients" : "/pro/clients";

      sections.push({
        label: "PROFESSIONAL",
        items: [
          { path: careTeamPath, label: "Care Team", icon: Users },
          { path: proPortalPath, label: "Pro Portal", icon: Building2 },
        ],
      });
    }

    return sections;
  }, [user?.professionalRole]);

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      <aside className="w-60 shrink-0 bg-black border-r border-white/10 flex flex-col overflow-y-auto">
        <div className="px-5 pt-5 pb-2">
          <div className="text-lg font-bold tracking-tight">My Perfect Meals</div>
          <div className="text-[11px] text-white/40 mt-0.5">Coach in Your Pocket</div>
        </div>

        <nav className="flex-1 px-3 pt-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map(({ path, label, icon: Icon }) => {
                  const active = location === path || location.startsWith(path + "/");
                  return (
                    <Link
                      key={path}
                      href={path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-orange-500/15 text-orange-400 font-medium"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-0.5">
          <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
            ACCOUNT
          </div>
          {accountItems.map(({ path, label, icon: Icon }) => {
            const active = location === path || location.startsWith(path + "/");
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-orange-500/15 text-orange-400 font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <DesktopHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
