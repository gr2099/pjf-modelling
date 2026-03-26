import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runProjectModel } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { DataTable } from "@/components/charts/DataTable";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2 } from "lucide-react";

const DEFAULT = {
  name: "Wind Farm 200MW",
  timeline: { start_year: 2024, forecast_years: 20, terminal_growth_rate: 0.0, discount_rate: 0.08 },
  phases: { construction_years: 2, operating_years: 20, decommissioning_years: 1 },
  revenue: { capacity_mw: 200, capacity_factor: 0.38, price_per_unit: 55, price_escalation: 0.015 },
  costs: { construction_cost: 300_000_000, equity_pct: 0.30, opex_per_year: 8_000_000, opex_escalation: 0.02 },
  debt: { interest_rate: 0.055, amortization_years: 18, debt_service_reserve_months: 6, grace_period_years: 0 },
  tax: { tax_rate: 0.25, nol_carryforward: 0, nol_expiry_years: 20 },
};

export default function ProjectFinance() {
  const [form, setForm] = useState(DEFAULT);
  const mut = useMutation({ mutationFn: runProjectModel });

  const update = (path: string, value: unknown) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts.at(-1)!] = value;
      return next;
    });
  };

  const result = mut.data;
  const years = result?.years_operating ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opChartData = years.map((y: number, i: number) => ({
    year: y,
    Revenue: result?.operating.revenue[i],
    OpEx: result?.operating.opex[i],
    EBITDA: result?.operating.ebitda[i],
    FCF: result?.operating.fcf[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debtData = years.map((y: number, i: number) => ({
    year: y,
    "Debt Balance": result?.debt_schedule.closing_balance[i],
    DSCR: result?.debt_schedule.dscr[i],
  }));

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Inputs */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Project Assumptions</h2>
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Model
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Input label="Construction Cost ($)" type="number" value={form.costs.construction_cost}
            onChange={(e) => update("costs.construction_cost", +e.target.value)} />
          <Input label="Equity %" type="number" value={form.costs.equity_pct}
            onChange={(e) => update("costs.equity_pct", +e.target.value)} step={0.01} />
          <Input label="Capacity (MW)" type="number" value={form.revenue.capacity_mw ?? ""}
            onChange={(e) => update("revenue.capacity_mw", +e.target.value)} />
          <Input label="Capacity Factor" type="number" value={form.revenue.capacity_factor}
            onChange={(e) => update("revenue.capacity_factor", +e.target.value)} step={0.01} />
          <Input label="Price ($/MWh)" type="number" value={form.revenue.price_per_unit}
            onChange={(e) => update("revenue.price_per_unit", +e.target.value)} />
          <Input label="Annual O&M ($)" type="number" value={form.costs.opex_per_year}
            onChange={(e) => update("costs.opex_per_year", +e.target.value)} />
          <Input label="Debt Interest Rate" type="number" value={form.debt.interest_rate}
            onChange={(e) => update("debt.interest_rate", +e.target.value)} step={0.005} />
          <Input label="Amortization Years" type="number" value={form.debt.amortization_years}
            onChange={(e) => update("debt.amortization_years", +e.target.value)} />
          <Input label="Construction Years" type="number" value={form.phases.construction_years}
            onChange={(e) => update("phases.construction_years", +e.target.value)} />
          <Input label="Operating Years" type="number" value={form.phases.operating_years}
            onChange={(e) => update("phases.operating_years", +e.target.value)} />
        </div>
      </div>

      {result && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: "Construction Cost", value: fmt(result.construction_cost, { style: "currency" }) },
              { label: "Total Debt", value: fmt(result.total_debt, { style: "currency" }) },
              { label: "Equity Investment", value: fmt(result.equity_investment, { style: "currency" }) },
              { label: "Project IRR", value: fmt(result.key_metrics.project_irr, { style: "percent" }), variant: "neutral" as const },
              { label: "Equity IRR", value: fmt(result.key_metrics.equity_irr, { style: "percent" }), variant: (result.key_metrics.equity_irr ?? 0) > 0.12 ? "positive" as const : "warning" as const },
              { label: "Min DSCR", value: fmt(result.key_metrics.min_dscr, { style: "decimal", decimals: 2 }), variant: (result.key_metrics.min_dscr ?? 0) > 1.2 ? "positive" as const : "negative" as const },
            ].map(({ label, value, variant = "default" as const }) => (
              <Card key={label} className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <Badge variant={variant}>{value}</Badge>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="charts">
            <TabsList>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="debt">Debt Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="charts">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Revenue, OpEx & EBITDA</CardTitle></CardHeader>
                  <FinancialChart data={opChartData} xKey="year"
                    series={[
                      { key: "Revenue", label: "Revenue", type: "bar" },
                      { key: "OpEx", label: "OpEx", type: "bar" },
                      { key: "EBITDA", label: "EBITDA", type: "line" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Debt Balance & DSCR</CardTitle></CardHeader>
                  <FinancialChart data={debtData} xKey="year"
                    series={[
                      { key: "Debt Balance", label: "Debt Balance", type: "area" },
                      { key: "DSCR", label: "DSCR", type: "line" },
                    ]}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="operations">
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Revenue", values: result.operating.revenue, bold: true },
                  { label: "OpEx", values: result.operating.opex.map((v: number) => -v) },
                  { label: "EBITDA", values: result.operating.ebitda, bold: true },
                  { label: "EBITDA Margin", values: result.operating.ebitda_margin },
                  { separator: true, label: "", values: [] },
                  { label: "Depreciation", values: result.operating.depreciation.map((v: number) => -v) },
                  { label: "EBIT", values: result.operating.ebit, bold: true },
                  { label: "Cash Taxes", values: result.tax.cash_taxes.map((v: number) => -v) },
                  { label: "Free Cash Flow", values: result.operating.fcf, bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="debt">
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Opening Balance", values: result.debt_schedule.opening_balance, bold: false },
                  { label: "Interest", values: result.debt_schedule.interest.map((v: number) => -v) },
                  { label: "Principal", values: result.debt_schedule.principal.map((v: number) => -v) },
                  { label: "Closing Balance", values: result.debt_schedule.closing_balance, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "DSCR", values: result.debt_schedule.dscr, bold: true },
                  { label: "DSRA Balance", values: result.debt_schedule.dsra_balance },
                  { label: "Equity Distributions", values: result.debt_schedule.equity_distributions, bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {!result && !mut.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 space-y-2">
          <Play className="h-10 w-10" />
          <p className="text-sm">Configure assumptions and press Run Model</p>
        </div>
      )}
    </div>
  );
}
