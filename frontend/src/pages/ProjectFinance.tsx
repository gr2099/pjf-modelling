import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runProjectModel, exportProjectXlsx } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { DataTable } from "@/components/charts/DataTable";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, Download, AlertTriangle } from "lucide-react";

const DEFAULT = {
  name: "Wind Farm 200MW",
  timeline: { start_year: 2024, forecast_years: 20, terminal_growth_rate: 0.0, discount_rate: 0.08 },
  phases: { construction_years: 2, operating_years: 20, decommissioning_years: 1 },
  revenue: { capacity_mw: 200, capacity_factor: 0.38, price_per_unit: 55, price_escalation: 0.015, ramp_up_years: 1, annual_degradation: 0.005 },
  costs: { construction_cost: 300_000_000, equity_pct: 0.30, opex_per_year: 8_000_000, opex_escalation: 0.02, opex_variable_pct: 0.0, development_costs: 5_000_000, cost_overrun_pct: 0.0 },
  debt: { interest_rate: 0.055, amortization_years: 18, debt_service_reserve_months: 6, grace_period_years: 0, use_sculpting: false, target_dscr: 1.30, upfront_fees_pct: 0.01, commitment_fee_pct: 0.005, idc_rate: 0.0 },
  tax: { tax_rate: 0.25, nol_carryforward: 0, nol_expiry_years: 20, accelerated_depreciation_pct: 0 },
  maintenance_reserve: { enabled: false, events: [], funding_rate_pct_revenue: 0 },
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
  const km = result?.key_metrics ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opData = years.map((y: number, i: number) => ({
    year: y,
    Revenue: result?.operating.revenue[i],
    OpEx: result?.operating.opex[i],
    EBITDA: result?.operating.ebitda[i],
    CFADS: result?.operating.cfads[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coverageData = years.map((y: number, i: number) => ({
    year: y,
    DSCR: result?.debt_schedule.dscr[i],
    LLCR: result?.debt_schedule.llcr[i],
    PLCR: result?.debt_schedule.plcr ? result.debt_schedule.plcr[i] : null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debtData = years.map((y: number, i: number) => ({
    year: y,
    "Debt Balance": result?.debt_schedule.closing_balance[i],
    "DSRA Balance": result?.debt_schedule.dsra_closing[i],
    "MRA Balance": result?.debt_schedule.mra_balance[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waterfallData = years.map((y: number, i: number) => ({
    year: y,
    EBITDA: result?.operating.ebitda[i],
    "Debt Service": result?.debt_schedule.debt_service ? -(result.debt_schedule.debt_service[i]) : 0,
    "DSRA Top-up": result?.debt_schedule.dsra_topup ? -(result.debt_schedule.dsra_topup[i]) : 0,
    "Equity Dist.": result?.debt_schedule.equity_distributions[i],
  }));

  const nBreaches = km?.n_covenant_breaches ?? 0;

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Project Assumptions</h2>
          <div className="flex gap-2">
            {result && (
              <Button variant="outline" onClick={() => exportProjectXlsx(form)}>
                <Download className="h-4 w-4" />Export Excel
              </Button>
            )}
            <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Model
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Construction & Capital Structure</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Construction Cost ($)" type="number" value={form.costs.construction_cost}
              onChange={(e) => update("costs.construction_cost", +e.target.value)} />
            <Input label="Development Costs ($)" type="number" value={form.costs.development_costs}
              onChange={(e) => update("costs.development_costs", +e.target.value)} />
            <Input label="Cost Overrun %" type="number" value={form.costs.cost_overrun_pct}
              onChange={(e) => update("costs.cost_overrun_pct", +e.target.value)} step={0.01} />
            <Input label="Equity %" type="number" value={form.costs.equity_pct}
              onChange={(e) => update("costs.equity_pct", +e.target.value)} step={0.01} />
            <Input label="Construction Years" type="number" value={form.phases.construction_years}
              onChange={(e) => update("phases.construction_years", +e.target.value)} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Capacity (MW)" type="number" value={form.revenue.capacity_mw ?? ""}
              onChange={(e) => update("revenue.capacity_mw", +e.target.value)} />
            <Input label="Capacity Factor" type="number" value={form.revenue.capacity_factor}
              onChange={(e) => update("revenue.capacity_factor", +e.target.value)} step={0.01} />
            <Input label="Price ($/MWh)" type="number" value={form.revenue.price_per_unit}
              onChange={(e) => update("revenue.price_per_unit", +e.target.value)} />
            <Input label="Price Escalation" type="number" value={form.revenue.price_escalation}
              onChange={(e) => update("revenue.price_escalation", +e.target.value)} step={0.005} />
            <Input label="Annual Degradation" type="number" value={form.revenue.annual_degradation}
              onChange={(e) => update("revenue.annual_degradation", +e.target.value)} step={0.001} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operating Costs</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Annual O&M ($)" type="number" value={form.costs.opex_per_year}
              onChange={(e) => update("costs.opex_per_year", +e.target.value)} />
            <Input label="O&M Escalation" type="number" value={form.costs.opex_escalation}
              onChange={(e) => update("costs.opex_escalation", +e.target.value)} step={0.005} />
            <Input label="Variable O&M % Rev." type="number" value={form.costs.opex_variable_pct}
              onChange={(e) => update("costs.opex_variable_pct", +e.target.value)} step={0.01} />
            <Input label="Operating Years" type="number" value={form.phases.operating_years}
              onChange={(e) => update("phases.operating_years", +e.target.value)} />
            <Input label="Tax Rate" type="number" value={form.tax.tax_rate}
              onChange={(e) => update("tax.tax_rate", +e.target.value)} step={0.01} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Debt Structure & Reserves</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Interest Rate" type="number" value={form.debt.interest_rate}
              onChange={(e) => update("debt.interest_rate", +e.target.value)} step={0.005} />
            <Input label="Amortization Years" type="number" value={form.debt.amortization_years}
              onChange={(e) => update("debt.amortization_years", +e.target.value)} />
            <Input label="Grace Period Yrs" type="number" value={form.debt.grace_period_years}
              onChange={(e) => update("debt.grace_period_years", +e.target.value)} />
            <Input label="DSRA (months)" type="number" value={form.debt.debt_service_reserve_months}
              onChange={(e) => update("debt.debt_service_reserve_months", +e.target.value)} />
            <Input label="Target DSCR (sculpting)" type="number" value={form.debt.target_dscr}
              onChange={(e) => update("debt.target_dscr", +e.target.value)} step={0.05} />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.debt.use_sculpting}
                onChange={(e) => update("debt.use_sculpting", e.target.checked)}
                className="rounded" />
              Use Debt Sculpting (target DSCR: {form.debt.target_dscr}×)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.maintenance_reserve.enabled}
                onChange={(e) => update("maintenance_reserve.enabled", e.target.checked)}
                className="rounded" />
              Enable Maintenance Reserve Account
            </label>
          </div>
        </div>

        {mut.isError && (
          <p className="mt-3 text-xs text-destructive">Error: {(mut.error as Error)?.message ?? "Model failed"}</p>
        )}
      </div>

      {result && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: "Total Project Cost", value: fmt(result.construction_cost, { style: "currency" }) },
              { label: "Total Debt", value: fmt(result.total_debt, { style: "currency" }) },
              { label: "Project IRR", value: fmt(km.project_irr, { style: "percent" }), variant: (km.project_irr ?? 0) > 0.08 ? "positive" as const : "warning" as const },
              { label: "Equity IRR", value: fmt(km.equity_irr, { style: "percent" }), variant: (km.equity_irr ?? 0) > 0.12 ? "positive" as const : "warning" as const },
              { label: "Min DSCR", value: fmt(km.min_dscr, { style: "decimal", decimals: 2 }), variant: (km.min_dscr ?? 0) > 1.2 ? "positive" as const : "negative" as const },
              { label: "Min LLCR", value: fmt(km.min_llcr, { style: "decimal", decimals: 2 }), variant: (km.min_llcr ?? 0) > 1.3 ? "positive" as const : "warning" as const },
            ].map(({ label, value, variant = "default" as const }) => (
              <Card key={label} className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <Badge variant={variant}>{value}</Badge>
              </Card>
            ))}
          </div>

          {nBreaches > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{nBreaches} covenant breach{nBreaches > 1 ? "es" : ""} detected (DSCR &lt; 1.20×). Review debt structure.</span>
            </div>
          )}

          {/* Construction Summary */}
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Sources & Uses — Financial Close</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Base Const. Cost</p><p className="font-mono font-semibold">{fmt(result.construction_summary?.base_construction_cost, { style: "currency" })}</p></div>
              <div><p className="text-muted-foreground text-xs">Development Costs</p><p className="font-mono font-semibold">{fmt(result.construction_summary?.development_costs, { style: "currency" })}</p></div>
              <div><p className="text-muted-foreground text-xs">Debt ({fmt(result.construction_summary?.debt_pct, { style: "percent" })})</p><p className="font-mono font-semibold">{fmt(result.total_debt, { style: "currency" })}</p></div>
              <div><p className="text-muted-foreground text-xs">Equity ({fmt(result.construction_summary?.equity_pct, { style: "percent" })})</p><p className="font-mono font-semibold">{fmt(result.equity_investment, { style: "currency" })}</p></div>
              <div><p className="text-muted-foreground text-xs">Upfront Fees</p><p className="font-mono">{fmt(result.construction_summary?.upfront_fees, { style: "currency" })}</p></div>
              <div><p className="text-muted-foreground text-xs">IDC (estimate)</p><p className="font-mono">{fmt(result.construction_summary?.idc_estimate, { style: "currency" })}</p></div>
              <div><p className="text-muted-foreground text-xs">Avg DSCR</p><p className="font-mono font-semibold">{fmt(km.avg_dscr, { style: "decimal", decimals: 2 })}×</p></div>
              <div><p className="text-muted-foreground text-xs">Avg LLCR</p><p className="font-mono font-semibold">{fmt(km.avg_llcr, { style: "decimal", decimals: 2 })}×</p></div>
            </div>
          </Card>

          <Tabs defaultValue="charts">
            <TabsList>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="waterfall">Cash Flow Waterfall</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="debt">Debt Schedule</TabsTrigger>
              <TabsTrigger value="coverage">Coverage Ratios</TabsTrigger>
            </TabsList>

            <TabsContent value="charts">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Revenue, OpEx & EBITDA</CardTitle></CardHeader>
                  <FinancialChart data={opData} xKey="year"
                    series={[
                      { key: "Revenue", label: "Revenue", type: "bar" },
                      { key: "OpEx", label: "OpEx", type: "bar" },
                      { key: "EBITDA", label: "EBITDA", type: "line" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Coverage Ratios (DSCR / LLCR)</CardTitle></CardHeader>
                  <FinancialChart data={coverageData} xKey="year"
                    series={[
                      { key: "DSCR", label: "DSCR", type: "line" },
                      { key: "LLCR", label: "LLCR", type: "line" },
                    ]}
                    currency={false}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Debt & Reserve Balances</CardTitle></CardHeader>
                  <FinancialChart data={debtData} xKey="year"
                    series={[
                      { key: "Debt Balance", label: "Senior Debt", type: "area" },
                      { key: "DSRA Balance", label: "DSRA", type: "bar" },
                      { key: "MRA Balance", label: "MRA", type: "bar" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Cash Flow Waterfall</CardTitle></CardHeader>
                  <FinancialChart data={waterfallData} xKey="year"
                    series={[
                      { key: "EBITDA", label: "EBITDA", type: "bar" },
                      { key: "Debt Service", label: "Debt Service", type: "bar" },
                      { key: "Equity Dist.", label: "Equity Dist.", type: "line" },
                    ]}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="waterfall">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Revenue", values: result.operating.revenue, bold: true },
                  { label: "OpEx", values: result.operating.opex.map((v: number) => -v) },
                  { label: "EBITDA (CFADS pre-tax)", values: result.operating.ebitda, bold: true },
                  { label: "Cash Taxes", values: result.tax.cash_taxes.map((v: number) => -v) },
                  { label: "CFADS (after tax)", values: result.operating.cfads, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Interest", values: result.debt_schedule.interest.map((v: number) => -v) },
                  { label: "Principal", values: result.debt_schedule.principal.map((v: number) => -v) },
                  { label: "Total Debt Service", values: result.debt_schedule.debt_service.map((v: number) => -v), bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "DSRA Top-up", values: result.debt_schedule.dsra_topup.map((v: number) => -v) },
                  { label: "MRA Funding", values: result.debt_schedule.mra_funding.map((v: number) => -v) },
                  { label: "Equity Distributions", values: result.debt_schedule.equity_distributions, bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="operations">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Revenue", values: result.operating.revenue, bold: true },
                  { label: "EBITDA Margin", values: result.operating.ebitda_margin },
                  { label: "OpEx", values: result.operating.opex.map((v: number) => -v) },
                  { label: "EBITDA", values: result.operating.ebitda, bold: true },
                  { label: "Depreciation", values: result.operating.depreciation.map((v: number) => -v) },
                  { label: "EBIT", values: result.operating.ebit, bold: true },
                  { label: "Cash Taxes", values: result.tax.cash_taxes.map((v: number) => -v) },
                  { label: "CFADS", values: result.operating.cfads, bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="debt">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Opening Balance", values: result.debt_schedule.opening_balance },
                  { label: "Interest", values: result.debt_schedule.interest.map((v: number) => -v) },
                  { label: "Principal", values: result.debt_schedule.principal.map((v: number) => -v) },
                  { label: "Closing Balance", values: result.debt_schedule.closing_balance, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "DSRA Opening", values: result.debt_schedule.dsra_opening },
                  { label: "DSRA Top-up", values: result.debt_schedule.dsra_topup.map((v: number) => -v) },
                  { label: "DSRA Release", values: result.debt_schedule.dsra_release },
                  { label: "DSRA Closing", values: result.debt_schedule.dsra_closing, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "MRA Funding", values: result.debt_schedule.mra_funding.map((v: number) => -v) },
                  { label: "MRA Draw", values: result.debt_schedule.mra_draw },
                  { label: "MRA Balance", values: result.debt_schedule.mra_balance, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Equity Distributions", values: result.debt_schedule.equity_distributions, bold: true },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="coverage">
              <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle>DSCR per Year</CardTitle></CardHeader>
                    <FinancialChart data={coverageData} xKey="year"
                      series={[{ key: "DSCR", label: "DSCR", type: "line" }]}
                      currency={false}
                    />
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>LLCR per Year</CardTitle></CardHeader>
                    <FinancialChart data={coverageData} xKey="year"
                      series={[{ key: "LLCR", label: "LLCR", type: "line" }]}
                      currency={false}
                    />
                  </Card>
                </div>
                <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                  rows={[
                    { label: "CFADS (net)", values: result.debt_schedule.cfads_net, bold: true },
                    { label: "Debt Service", values: result.debt_schedule.debt_service.map((v: number) => -v) },
                    { label: "DSCR", values: result.debt_schedule.dscr, bold: true },
                    { label: "LLCR", values: result.debt_schedule.llcr },
                    { label: "PLCR", values: result.debt_schedule.plcr },
                    { label: "Covenant Breach?", values: result.debt_schedule.covenant_breach?.map((v: boolean) => v ? 1 : 0) },
                  ]}
                  yearLabels={years}
                />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!result && !mut.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 space-y-2">
          <Play className="h-10 w-10" />
          <p className="text-sm">Configure project assumptions and press Run Model</p>
        </div>
      )}
    </div>
  );
}
