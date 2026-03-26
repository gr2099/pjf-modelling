import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runMonteCarlo } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Histogram, FinancialChart } from "@/components/charts/FinancialChart";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2 } from "lucide-react";

const DEFAULT = {
  base_revenue: 100_000_000,
  revenue_volatility: 0.15,
  base_opex: 60_000_000,
  opex_volatility: 0.10,
  discount_rate: 0.10,
  terminal_growth_rate: 0.025,
  forecast_years: 10,
  n_simulations: 2000,
  mean_reversion_speed: 0.3,
  correlation_rev_opex: 0.3,
};

export default function MonteCarlo() {
  const [form, setForm] = useState(DEFAULT);
  const mut = useMutation({ mutationFn: runMonteCarlo });
  const result = mut.data;

  const update = (key: keyof typeof DEFAULT, value: number) =>
    setForm((p) => ({ ...p, [key]: value }));

  const pcts = result?.percentiles ?? {};
  const p5 = pcts.p5;
  const p95 = pcts.p95;

  // Sample paths chart (first 5)
  const pathData = result?.sample_revenue_paths?.[0]
    ? result.sample_revenue_paths.slice(0, 8).map((path: number[], simIdx: number) =>
        path.map((v: number, t: number) => ({ t: `Y${t + 1}`, [`S${simIdx + 1}`]: v }))
      ).reduce((merged: Record<string, unknown>[], pathArr: Record<string, unknown>[]) => {
        return pathArr.map((item, i) => ({ ...merged[i], ...item }));
      })
    : [];

  const pathSeries = result?.sample_revenue_paths?.slice(0, 8).map((_: unknown, i: number) => ({
    key: `S${i + 1}`,
    label: `Path ${i + 1}`,
    type: "line" as const,
  })) ?? [];

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Inputs */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Simulation Parameters</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mean-reverting Ornstein-Uhlenbeck process with Cholesky-correlated variables
            </p>
          </div>
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {mut.isPending ? "Running…" : `Run ${form.n_simulations.toLocaleString()} Simulations`}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Input label="Base Revenue ($)" type="number" value={form.base_revenue}
            onChange={(e) => update("base_revenue", +e.target.value)} />
          <Input label="Revenue Volatility" type="number" value={form.revenue_volatility}
            onChange={(e) => update("revenue_volatility", +e.target.value)} step={0.01} hint="Annual std dev (e.g. 0.15 = 15%)" />
          <Input label="Base OpEx ($)" type="number" value={form.base_opex}
            onChange={(e) => update("base_opex", +e.target.value)} />
          <Input label="OpEx Volatility" type="number" value={form.opex_volatility}
            onChange={(e) => update("opex_volatility", +e.target.value)} step={0.01} />
          <Input label="Discount Rate" type="number" value={form.discount_rate}
            onChange={(e) => update("discount_rate", +e.target.value)} step={0.005} />
          <Input label="Terminal Growth" type="number" value={form.terminal_growth_rate}
            onChange={(e) => update("terminal_growth_rate", +e.target.value)} step={0.005} />
          <Input label="Forecast Years" type="number" value={form.forecast_years}
            onChange={(e) => update("forecast_years", +e.target.value)} min={1} max={30} />
          <Input label="N Simulations" type="number" value={form.n_simulations}
            onChange={(e) => update("n_simulations", +e.target.value)} min={100} max={10000} />
          <Input label="Mean Reversion Speed" type="number" value={form.mean_reversion_speed}
            onChange={(e) => update("mean_reversion_speed", +e.target.value)} step={0.05} hint="0 = random walk, 1 = strong reversion" />
          <Input label="Rev/OpEx Correlation" type="number" value={form.correlation_rev_opex}
            onChange={(e) => update("correlation_rev_opex", +e.target.value)} step={0.05} hint="-1 to 1" />
        </div>
      </div>

      {result && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {[
              { label: "Mean EV", value: fmt(result.mean_ev, { style: "currency" }), variant: "neutral" as const },
              { label: "Std Dev", value: fmt(result.std_ev, { style: "currency" }) },
              { label: "P5 (Downside)", value: fmt(p5, { style: "currency" }), variant: "negative" as const },
              { label: "P50 (Median)", value: fmt(pcts.p50, { style: "currency" }), variant: "neutral" as const },
              { label: "P95 (Upside)", value: fmt(p95, { style: "currency" }), variant: "positive" as const },
              { label: "Prob. Positive", value: fmt(result.probability_positive, { style: "percent" }), variant: result.probability_positive > 0.8 ? "positive" as const : "warning" as const },
            ].map(({ label, value, variant = "default" as const }) => (
              <Card key={label} className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <Badge variant={variant}>{value}</Badge>
              </Card>
            ))}
          </div>

          {/* Percentile Table */}
          <div className="glass rounded-xl p-5 border border-border/50">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Percentile Distribution
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3">
              {[1, 5, 10, 25, 50, 75, 90, 95, 99].map((p) => (
                <div key={p} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">P{p}</p>
                  <p className="number text-xs font-medium">{fmt(pcts[`p${p}`], { style: "compact" })}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Histogram */}
            <Card>
              <CardHeader>
                <CardTitle>Enterprise Value Distribution ({result.n_simulations.toLocaleString()} simulations)</CardTitle>
              </CardHeader>
              <Histogram
                binCenters={result.histogram.bin_centers}
                counts={result.histogram.counts}
                p5={p5}
                p95={p95}
              />
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-8 rounded bg-sky-500/30 inline-block" /> Outside P5–P95
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-8 rounded bg-sky-500/80 inline-block" /> P5–P95 range
                </span>
              </div>
            </Card>

            {/* Sample Revenue Paths */}
            {pathSeries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Revenue Paths (8 of {result.n_simulations.toLocaleString()})</CardTitle>
                </CardHeader>
                <FinancialChart
                  data={pathData}
                  xKey="t"
                  series={pathSeries}
                  height={260}
                />
              </Card>
            )}
          </div>
        </>
      )}

      {!result && !mut.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 space-y-2">
          <BarChart3 className="h-10 w-10" />
          <p className="text-sm">Configure parameters and run the simulation</p>
        </div>
      )}
    </div>
  );
}
