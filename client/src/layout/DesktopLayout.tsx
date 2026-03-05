import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calculator, ChefHat, ShoppingCart, Refrigerator, Briefcase, Heart, MoreHorizontal } from "lucide-react";

interface Props {
  children: ReactNode;
}

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/macro-counter", label: "Macro Calculator", icon: Calculator },
  { path: "/select-builder", label: "Meal Builders", icon: ChefHat },
  { path: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
  { path: "/fridge-rescue", label: "Fridge Rescue", icon: Refrigerator },
  { path: "/saved-meals", label: "Saved Meals", icon: Heart },
  { path: "/care-team", label: "Professional", icon: Briefcase },
  { path: "/more", label: "More", icon: MoreHorizontal },
];

export default function DesktopLayout({ children }: Props) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
      <aside className="w-64 shrink-0 bg-black border-r border-white/10 flex flex-col">
        <div className="px-5 py-5">
          <div className="text-lg font-bold tracking-tight">My Perfect Meals</div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location === path || location.startsWith(path + "/");
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
