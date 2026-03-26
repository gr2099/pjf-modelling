import { Building2, Zap, TrendingUp, Activity, ArrowRight, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const MODELS = [
  {
    to: "/corporate",
    icon: Building2,
    title: "Corporate Model",
    description: "Revenue forecast → EBITDA → Free cash flow → DCF valuation with NOL tracking and debt scheduling.",
    tags: ["FCF", "NPV", "IRR", "NOL"],
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    to: "/project",
    icon: Zap,
    title: "Project Finance",
    description: "Construction to decommissioning. DSCR-based debt sculpting, equity IRR, and DSRA modelling.",
    tags: ["DSCR", "Equity IRR", "DSRA", "Waterfall"],
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    to: "/acquisition",
    icon: TrendingUp,
    title: "Acquisition / LBO",
    description: "Entry multiple → hold period operations → exit proceeds. MOIC and equity IRR with synergy ramp.",
    tags: ["MOIC", "IRR", "Synergies", "Exit"],
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    to: "/valuation",
    icon: BarChart3,
    title: "DCF Valuation",
    description: "Standalone discounted cash flow with mid-year convention, terminal value and WACC calculator.",
    tags: ["DCF", "WACC", "Terminal Value", "EV"],
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    to: "/risk",
    icon: Activity,
    title: "Risk Analysis",
    description: "Tornado diagrams, sensitivity tables, break-even analysis and waterfall attribution charts.",
    tags: ["Tornado", "Sensitivity", "Break-even", "Scenario"],
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    to: "/monte-carlo",
    icon: BarChart3,
    title: "Monte Carlo",
    description: "Stochastic simulation with mean-reverting correlated variables, probability distributions.",
    tags: ["Simulation", "VaR", "P50/P90", "Correlation"],
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/20",
  },
];

export default function Dashboard() {
  return (
    <div className="p-8 space-y-8 max-w-6xl">
      {/* Hero */}
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">
          Corporate & Project Finance
          <span className="text-primary"> Modelling Engine</span>
        </h2>
        <p className="text-muted-foreground max-w-xl">
          Professional-grade financial models based on Bodmer's framework. Build, analyse,
          and stress-test corporate, project, and acquisition models with real-time calculations.
        </p>
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MODELS.map(({ to, icon: Icon, title, description, tags, color, bg }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "group glass rounded-xl p-5 border transition-all hover:scale-[1.01] hover:shadow-lg",
              "hover:border-primary/30"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn("rounded-lg p-2.5 border", bg)}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold mb-1.5">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick reference */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Framework Reference (Bodmer)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { label: "FCF Formula", value: "EBITDA − Taxes − CapEx − ΔNWC" },
            { label: "DSCR", value: "Available CF / (Interest + Principal)" },
            { label: "IRR", value: "Rate where NPV = 0" },
            { label: "Terminal Value", value: "FCF × (1+g) / (WACC − g)" },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <p className="text-muted-foreground/60 font-medium">{label}</p>
              <p className="number text-foreground/80 font-mono text-[11px]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
