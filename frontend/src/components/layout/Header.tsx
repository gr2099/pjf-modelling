import { useLocation } from "react-router-dom";

const TITLES: Record<string, { title: string; description: string }> = {
  "/": { title: "Dashboard", description: "Overview of your financial models" },
  "/corporate": { title: "Corporate Model", description: "Revenue → EBITDA → FCF → Valuation" },
  "/project": { title: "Project Finance", description: "Construction to decommissioning lifecycle" },
  "/acquisition": { title: "Acquisition / LBO", description: "Entry → Operations → Exit returns" },
  "/valuation": { title: "DCF Valuation", description: "Discounted cash flow & WACC analysis" },
  "/risk": { title: "Risk Analysis", description: "Sensitivity, scenario & break-even" },
  "/monte-carlo": { title: "Monte Carlo", description: "Stochastic simulation & probability distributions" },
};

export function Header() {
  const { pathname } = useLocation();
  const meta = TITLES[pathname] ?? { title: "PJF Modelling", description: "" };

  return (
    <header className="flex items-center justify-between border-b border-border/50 px-8 py-4 bg-card/20 backdrop-blur-sm">
      <div>
        <h1 className="text-lg font-semibold">{meta.title}</h1>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-muted-foreground">Engine online</span>
      </div>
    </header>
  );
}
