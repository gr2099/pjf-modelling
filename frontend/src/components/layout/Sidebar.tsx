import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Zap,
  TrendingUp,
  BarChart3,
  Activity,
  Calculator,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/corporate", label: "Corporate", icon: Building2 },
  { to: "/project", label: "Project Finance", icon: Zap },
  { to: "/acquisition", label: "Acquisition / LBO", icon: TrendingUp },
  { to: "/valuation", label: "Valuation (DCF)", icon: Calculator },
  { to: "/risk", label: "Risk Analysis", icon: Activity },
  { to: "/monte-carlo", label: "Monte Carlo", icon: BarChart3 },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-border/50 bg-card/30 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">PJF Modelling</p>
          <p className="text-[10px] text-muted-foreground">Finance Engine</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Models
        </p>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 px-5 py-4">
        <p className="text-[10px] text-muted-foreground/50">
          Based on Bodmer — Corporate & Project Finance Modeling
        </p>
      </div>
    </aside>
  );
}
