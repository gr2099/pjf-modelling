import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runCorporateModel, exportCorporateXlsx } from "@/lib/api";
import { fmt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinancialChart } from "@/components/charts/FinancialChart";
import { DataTable } from "@/components/charts/DataTable";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, Download } from "lucide-react";

const DEFAULT_PAYLOAD = {
  name: "Tech Corp",
  timeline: { start_year: 2024, forecast_years: 8, terminal_growth_rate: 0.03, discount_rate: 0.10 },
  revenue: { base_revenue: 100_000_000, growth_rates: [0.12, 0.15, 0.18, 0.15, 0.12, 0.10, 0.08, 0.06], inflation_rate: 0.02 },
  costs: { cogs_pct: 0.42, sga_pct: 0.18 },
  capex: { maintenance_capex_pct: 0.03, growth_capex: [5e6, 8e6, 10e6, 8e6, 5e6, 4e6, 3e6, 2e6], depreciation_years: 8 },
  working_capital: { dso_days: 45, dpo_days: 30, dio_days: 50 },
  debt: { initial_debt: 30_000_000, interest_rate: 0.06, amortization_years: 7, new_debt_schedule: [] },
  tax: { tax_rate: 0.25, nol_carryforward: 0, nol_expiry_years: 20 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KPIRow({ result }: { result: any }) {
  const irr = result.equity_irr;
  const val = result.valuation;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {[
        { label: "Enterprise Value", value: fmt(val.enterprise_value, { style: "currency" }), variant: "neutral" as const },
        { label: "Equity Value", value: fmt(val.equity_value, { style: "currency" }), variant: "positive" as const },
        { label: "Equity IRR", value: fmt(irr, { style: "percent" }), variant: irr > 0.15 ? "positive" as const : "warning" as const },
        { label: "TV % of EV", value: fmt(val.terminal_value_pct / 100, { style: "percent" }), variant: "default" as const },
        { label: "Peak EBITDA", value: fmt(Math.max(...result.income_statement.ebitda), { style: "currency" }), variant: "default" as const },
        { label: "Net Debt (Exit)", value: fmt(result.debt_schedule.closing_balance.at(-1), { style: "currency" }), variant: "default" as const },
      ].map(({ label, value, variant }) => (
        <Card key={label} className="py-3 px-4">
          <CardTitle className="mb-1">{label}</CardTitle>
          <CardValue className="text-lg"><Badge variant={variant}>{value}</Badge></CardValue>
        </Card>
      ))}
    </div>
  );
}

export default function CorporateModel() {
  const [form, setForm] = useState(DEFAULT_PAYLOAD);
  const mut = useMutation({ mutationFn: runCorporateModel });

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
  const years = result?.years ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = years.map((y: number, i: number) => ({
    year: y,
    Revenue: result?.income_statement.revenue[i],
    EBITDA: result?.income_statement.ebitda[i],
    FCF: result?.cash_flow.fcf_aftertax[i],
    "EBITDA Margin": result?.income_statement.ebitda_margin[i],
  }));

  const debtData = years.map((y: number, i: number) => ({
    year: y,
    "Opening Balance": result?.debt_schedule.opening_balance[i],
    "Closing Balance": result?.debt_schedule.closing_balance[i],
    DSCR: result?.debt_schedule.dscr[i],
  }));

  const tableRows = result
    ? [
        { label: "Revenue", values: result.income_statement.revenue, bold: true },
        { label: "COGS", values: result.income_statement.cogs.map((v: number) => -v) },
        { label: "Gross Profit", values: result.income_statement.gross_profit, bold: true },
        { label: "SG&A", values: result.income_statement.sga.map((v: number) => -v) },
        { label: "EBITDA", values: result.income_statement.ebitda, bold: true },
        { label: "EBITDA Margin %", values: result.income_statement.ebitda_margin, bold: false },
        { separator: true, label: "", values: [] },
        { label: "Depreciation", values: result.income_statement.depreciation.map((v: number) => -v) },
        { label: "EBIT", values: result.income_statement.ebit, bold: true },
        { label: "Cash Taxes", values: result.tax.cash_taxes.map((v: number) => -v) },
        { separator: true, label: "", values: [] },
        { label: "CapEx", values: result.cash_flow.capex.map((v: number) => -v) },
        { label: "ΔNWC", values: result.cash_flow.delta_nwc.map((v: number) => -v) },
        { label: "Free Cash Flow", values: result.cash_flow.fcf_aftertax, bold: true },
        { separator: true, label: "", values: [] },
        { label: "Interest", values: result.debt_schedule.interest.map((v: number) => -v) },
        { label: "Principal", values: result.debt_schedule.principal.map((v: number) => -v) },
        { label: "Equity FCF", values: result.debt_schedule.equity_fcf, bold: true },
        { label: "DSCR", values: result.debt_schedule.dscr },
      ]
    : [];

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Inputs */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assumptions</h2>
          <div className="flex gap-2">
            {result && (
              <Button variant="outline" onClick={() => exportCorporateXlsx(form)}>
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
            )}
            <Button onClick={() => mut.mutate(form)} disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Model
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <Input label="Base Revenue ($)" type="number" value={form.revenue.base_revenue}
            onChange={(e) => update("revenue.base_revenue", +e.target.value)} />
          <Input label="Forecast Years" type="number" value={form.timeline.forecast_years}
            onChange={(e) => update("timeline.forecast_years", +e.target.value)} min={1} max={20} />
          <Input label="Discount Rate" type="number" value={form.timeline.discount_rate}
            onChange={(e) => update("timeline.discount_rate", +e.target.value)} step={0.005} />
          <Input label="Terminal Growth" type="number" value={form.timeline.terminal_growth_rate}
            onChange={(e) => update("timeline.terminal_growth_rate", +e.target.value)} step={0.005} />
          <Input label="Tax Rate" type="number" value={form.tax.tax_rate}
            onChange={(e) => update("tax.tax_rate", +e.target.value)} step={0.01} />
          <Input label="COGS %" type="number" value={form.costs.cogs_pct}
            onChange={(e) => update("costs.cogs_pct", +e.target.value)} step={0.01} />
          <Input label="SG&A %" type="number" value={form.costs.sga_pct}
            onChange={(e) => update("costs.sga_pct", +e.target.value)} step={0.01} />
          <Input label="Initial Debt ($)" type="number" value={form.debt.initial_debt}
            onChange={(e) => update("debt.initial_debt", +e.target.value)} />
          <Input label="Interest Rate" type="number" value={form.debt.interest_rate}
            onChange={(e) => update("debt.interest_rate", +e.target.value)} step={0.005} />
          <Input label="Debt Amort. Years" type="number" value={form.debt.amortization_years}
            onChange={(e) => update("debt.amortization_years", +e.target.value)} />
        </div>

        {mut.isError && (
          <p className="mt-3 text-xs text-destructive">
            Error: {(mut.error as Error)?.message ?? "Model failed to run"}
          </p>
        )}
      </div>

      {result && (
        <>
          <KPIRow result={result} />

          <Tabs defaultValue="charts">
            <TabsList>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="table">Income Statement</TabsTrigger>
              <TabsTrigger value="debt">Debt Schedule</TabsTrigger>
              <TabsTrigger value="tax">Tax Detail</TabsTrigger>
            </TabsList>

            <TabsContent value="charts">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Revenue, EBITDA & FCF</CardTitle></CardHeader>
                  <FinancialChart
                    data={chartData}
                    xKey="year"
                    series={[
                      { key: "Revenue", label: "Revenue", type: "bar" },
                      { key: "EBITDA", label: "EBITDA", type: "bar" },
                      { key: "FCF", label: "Free Cash Flow", type: "line" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>EBITDA Margin %</CardTitle></CardHeader>
                  <FinancialChart
                    data={chartData}
                    xKey="year"
                    series={[{ key: "EBITDA Margin", label: "EBITDA Margin", type: "area" }]}
                    pct
                    currency={false}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Debt Balance</CardTitle></CardHeader>
                  <FinancialChart
                    data={debtData}
                    xKey="year"
                    series={[
                      { key: "Opening Balance", label: "Opening", type: "bar" },
                      { key: "Closing Balance", label: "Closing", type: "bar" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>DSCR</CardTitle></CardHeader>
                  <FinancialChart
                    data={debtData}
                    xKey="year"
                    series={[{ key: "DSCR", label: "DSCR", type: "line" }]}
                    currency={false}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="table">
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={tableRows}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="debt">
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Opening Balance", values: result.debt_schedule.opening_balance, bold: false },
                  { label: "New Debt", values: result.debt_schedule.new_debt },
                  { label: "Interest", values: result.debt_schedule.interest.map((v: number) => -v) },
                  { label: "Principal", values: result.debt_schedule.principal.map((v: number) => -v) },
                  { label: "Closing Balance", values: result.debt_schedule.closing_balance, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Equity FCF", values: result.debt_schedule.equity_fcf, bold: true },
                  { label: "DSCR", values: result.debt_schedule.dscr },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="tax">
              <DataTable
                columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "EBIT", values: result.tax.ebit, bold: true },
                  { label: "NOL Generated", values: result.tax.nol_generated },
                  { label: "NOL Used", values: result.tax.nol_used },
                  { label: "NOL Balance", values: result.tax.nol_balance, bold: false },
                  { label: "Taxable Income", values: result.tax.taxable_income, bold: true },
                  { label: "Cash Taxes", values: result.tax.cash_taxes.map((v: number) => -v) },
                  { label: "Book Taxes", values: result.tax.book_taxes.map((v: number) => -v) },
                  { label: "Effective Tax Rate", values: result.tax.effective_tax_rate },
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
          <p className="text-sm">Press Run Model to compute results</p>
        </div>
      )}
    </div>
  );
}
