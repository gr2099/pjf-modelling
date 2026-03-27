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
  costs: { cogs_pct: 0.42, sga_pct: 0.18, rd_pct: 0.05, fixed_costs: 0 },
  capex: { maintenance_capex_pct: 0.03, growth_capex: [5e6, 8e6, 10e6, 8e6, 5e6, 4e6, 3e6, 2e6], depreciation_years: 8, depreciation_method: "straight_line", declining_balance_rate: 0.2, half_year_convention: true },
  working_capital: { dso_days: 45, dpo_days: 30, dio_days: 50, other_current_assets_pct: 0, other_current_liabilities_pct: 0 },
  debt: { initial_debt: 30_000_000, interest_rate: 0.06, amortization_years: 7, new_debt_schedule: [] },
  tax: { tax_rate: 0.25, nol_carryforward: 0, nol_expiry_years: 20, accelerated_depreciation_pct: 0 },
  roic: { opening_invested_capital: 50_000_000, shares_outstanding: 10_000_000, wacc: 0.10 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KPIRow({ result }: { result: any }) {
  const val = result.valuation;
  const irr = result.equity_irr;
  const km = result.key_metrics;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {[
        { label: "Enterprise Value", value: fmt(val.enterprise_value, { style: "currency" }), variant: "neutral" as const },
        { label: "Equity Value", value: fmt(val.equity_value, { style: "currency" }), variant: "positive" as const },
        { label: "Equity IRR", value: fmt(irr, { style: "percent" }), variant: (irr ?? 0) > 0.15 ? "positive" as const : "warning" as const },
        { label: "TV % of EV", value: fmt(val.terminal_value_pct / 100, { style: "percent" }), variant: "default" as const },
        { label: "Peak EBITDA Margin", value: fmt(Math.max(...result.income_statement.ebitda_margin), { style: "percent" }), variant: "default" as const },
        { label: "Avg ROIC Spread", value: fmt(km.avg_roic_spread, { style: "percent" }), variant: km.avg_roic_spread > 0 ? "positive" as const : "negative" as const },
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
    "Net Income": result?.balance_sheet ? result?.balance_sheet.total_equity[i] - (result?.balance_sheet.total_equity[i - 1] ?? 0) : 0,
    FCF: result?.cash_flow_statement.fcf_aftertax[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roicData = years.map((y: number, i: number) => ({
    year: y,
    ROIC: result?.roic_analysis.roic[i] ? result.roic_analysis.roic[i] * 100 : 0,
    WACC: result?.roic_analysis.wacc[i] ? result.roic_analysis.wacc[i] * 100 : 0,
    Spread: result?.roic_analysis.roic_spread[i] ? result.roic_analysis.roic_spread[i] * 100 : 0,
    "Economic Profit": result?.roic_analysis.economic_profit[i],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marginData = years.map((y: number, i: number) => ({
    year: y,
    "EBITDA Margin": result?.income_statement.ebitda_margin[i] ? result.income_statement.ebitda_margin[i] * 100 : 0,
    "EBIT Margin": result?.income_statement.ebit_margin[i] ? result.income_statement.ebit_margin[i] * 100 : 0,
    "Net Margin": result?.income_statement.net_margin ? result.income_statement.net_margin[i] * 100 : 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bsData = years.map((y: number, i: number) => ({
    year: y,
    "Total Assets": result?.balance_sheet.total_assets[i],
    "Total Equity": result?.balance_sheet.total_equity[i],
    "Total Debt": result?.balance_sheet.long_term_debt[i],
  }));

  // Football field data
  const ffData = result?.key_metrics?.football_field?.methods
    ? Object.entries(result.key_metrics.football_field.methods).map(([key, v]: [string, any]) => ({
        method: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        EV: v.ev,
        "Equity Value": v.equity_value,
      }))
    : [];

  const tableIS = result ? [
    { label: "Revenue", values: result.income_statement.revenue, bold: true },
    { label: "COGS", values: result.income_statement.cogs.map((v: number) => -v) },
    { label: "Gross Profit", values: result.income_statement.gross_profit, bold: true },
    { label: "SG&A", values: result.income_statement.sga.map((v: number) => -v) },
    { label: "R&D", values: result.income_statement.rd.map((v: number) => -v) },
    { label: "EBITDA", values: result.income_statement.ebitda, bold: true },
    { label: "EBITDA Margin", values: result.income_statement.ebitda_margin },
    { separator: true, label: "", values: [] },
    { label: "Depreciation", values: result.income_statement.depreciation.map((v: number) => -v) },
    { label: "EBIT", values: result.income_statement.ebit, bold: true },
    { label: "Interest", values: result.income_statement.interest.map((v: number) => -v) },
    { label: "EBT", values: result.income_statement.ebt, bold: false },
    { label: "Cash Taxes", values: result.income_statement.cash_taxes.map((v: number) => -v) },
    { label: "Net Income", values: result.income_statement.net_income, bold: true },
    { label: "Net Margin", values: result.income_statement.net_margin },
  ] : [];

  const tableCF = result ? [
    { label: "Net Income", values: result.cash_flow_statement.net_income, bold: false },
    { label: "Add: Depreciation", values: result.cash_flow_statement.depreciation },
    { label: "ΔWorking Capital", values: result.cash_flow_statement.delta_nwc.map((v: number) => -v) },
    { label: "Operating Cash Flow", values: result.cash_flow_statement.operating_cash_flow, bold: true },
    { separator: true, label: "", values: [] },
    { label: "CapEx", values: result.cash_flow_statement.investing_cash_flow },
    { separator: true, label: "", values: [] },
    { label: "New Debt", values: result.cash_flow_statement.new_debt },
    { label: "Principal Repayment", values: result.cash_flow_statement.principal_repayment.map((v: number) => -v) },
    { label: "Interest", values: result.income_statement.interest.map((v: number) => -v) },
    { label: "Financing Cash Flow", values: result.cash_flow_statement.financing_cash_flow, bold: true },
    { separator: true, label: "", values: [] },
    { label: "Free Cash Flow (Unlevered)", values: result.cash_flow_statement.fcf_aftertax, bold: true },
  ] : [];

  const tableBS = result ? [
    { label: "Cash", values: result.balance_sheet.cash },
    { label: "Accounts Receivable", values: result.balance_sheet.accounts_receivable },
    { label: "Inventory", values: result.balance_sheet.inventory },
    { label: "Total Current Assets", values: result.balance_sheet.total_current_assets, bold: true },
    { label: "Net PP&E", values: result.balance_sheet.net_ppe },
    { label: "Total Assets", values: result.balance_sheet.total_assets, bold: true },
    { separator: true, label: "", values: [] },
    { label: "Accounts Payable", values: result.balance_sheet.accounts_payable.map((v: number) => -v) },
    { label: "Long-Term Debt", values: result.balance_sheet.long_term_debt.map((v: number) => -v) },
    { label: "Total Liabilities", values: result.balance_sheet.total_liabilities.map((v: number) => -v), bold: true },
    { separator: true, label: "", values: [] },
    { label: "Total Equity", values: result.balance_sheet.total_equity, bold: true },
  ] : [];

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Inputs */}
      <div className="glass rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assumptions</h2>
          <div className="flex gap-2">
            {result && (
              <Button variant="outline" onClick={() => exportCorporateXlsx(form)}>
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue & Growth</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Base Revenue ($)" type="number" value={form.revenue.base_revenue}
              onChange={(e) => update("revenue.base_revenue", +e.target.value)} />
            <Input label="Forecast Years" type="number" value={form.timeline.forecast_years}
              onChange={(e) => update("timeline.forecast_years", +e.target.value)} min={1} max={20} />
            <Input label="Discount Rate (WACC)" type="number" value={form.timeline.discount_rate}
              onChange={(e) => update("timeline.discount_rate", +e.target.value)} step={0.005} />
            <Input label="Terminal Growth Rate" type="number" value={form.timeline.terminal_growth_rate}
              onChange={(e) => update("timeline.terminal_growth_rate", +e.target.value)} step={0.005} />
            <Input label="Start Year" type="number" value={form.timeline.start_year}
              onChange={(e) => update("timeline.start_year", +e.target.value)} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Structure</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="COGS %" type="number" value={form.costs.cogs_pct}
              onChange={(e) => update("costs.cogs_pct", +e.target.value)} step={0.01} />
            <Input label="SG&A %" type="number" value={form.costs.sga_pct}
              onChange={(e) => update("costs.sga_pct", +e.target.value)} step={0.01} />
            <Input label="R&D %" type="number" value={form.costs.rd_pct}
              onChange={(e) => update("costs.rd_pct", +e.target.value)} step={0.01} />
            <Input label="Tax Rate" type="number" value={form.tax.tax_rate}
              onChange={(e) => update("tax.tax_rate", +e.target.value)} step={0.01} />
            <Input label="NOL Carryforward ($)" type="number" value={form.tax.nol_carryforward}
              onChange={(e) => update("tax.nol_carryforward", +e.target.value)} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CapEx & Working Capital</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Maint. CapEx % Rev." type="number" value={form.capex.maintenance_capex_pct}
              onChange={(e) => update("capex.maintenance_capex_pct", +e.target.value)} step={0.005} />
            <Input label="Depreciation Years" type="number" value={form.capex.depreciation_years}
              onChange={(e) => update("capex.depreciation_years", +e.target.value)} />
            <Input label="DSO (days)" type="number" value={form.working_capital.dso_days}
              onChange={(e) => update("working_capital.dso_days", +e.target.value)} />
            <Input label="DIO (days)" type="number" value={form.working_capital.dio_days}
              onChange={(e) => update("working_capital.dio_days", +e.target.value)} />
            <Input label="DPO (days)" type="number" value={form.working_capital.dpo_days}
              onChange={(e) => update("working_capital.dpo_days", +e.target.value)} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Debt & ROIC</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <Input label="Initial Debt ($)" type="number" value={form.debt.initial_debt}
              onChange={(e) => update("debt.initial_debt", +e.target.value)} />
            <Input label="Interest Rate" type="number" value={form.debt.interest_rate}
              onChange={(e) => update("debt.interest_rate", +e.target.value)} step={0.005} />
            <Input label="Amort. Years" type="number" value={form.debt.amortization_years}
              onChange={(e) => update("debt.amortization_years", +e.target.value)} />
            <Input label="Opening Invested Capital ($)" type="number" value={form.roic.opening_invested_capital}
              onChange={(e) => update("roic.opening_invested_capital", +e.target.value)} />
            <Input label="WACC (for ROIC spread)" type="number" value={form.roic.wacc}
              onChange={(e) => update("roic.wacc", +e.target.value)} step={0.005} />
          </div>
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
              <TabsTrigger value="income">Income Statement</TabsTrigger>
              <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
              <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
              <TabsTrigger value="roic">ROIC Analysis</TabsTrigger>
              <TabsTrigger value="debt">Debt Schedule</TabsTrigger>
              <TabsTrigger value="tax">Tax Detail</TabsTrigger>
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
            </TabsList>

            <TabsContent value="charts">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Revenue, EBITDA & FCF</CardTitle></CardHeader>
                  <FinancialChart data={chartData} xKey="year"
                    series={[
                      { key: "Revenue", label: "Revenue", type: "bar" },
                      { key: "EBITDA", label: "EBITDA", type: "bar" },
                      { key: "FCF", label: "Free Cash Flow", type: "line" },
                    ]}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Margin Analysis</CardTitle></CardHeader>
                  <FinancialChart data={marginData} xKey="year"
                    series={[
                      { key: "EBITDA Margin", label: "EBITDA %", type: "line" },
                      { key: "EBIT Margin", label: "EBIT %", type: "line" },
                      { key: "Net Margin", label: "Net %", type: "area" },
                    ]}
                    currency={false}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>ROIC vs WACC Spread</CardTitle></CardHeader>
                  <FinancialChart data={roicData} xKey="year"
                    series={[
                      { key: "ROIC", label: "ROIC %", type: "line" },
                      { key: "WACC", label: "WACC %", type: "line" },
                      { key: "Spread", label: "ROIC Spread %", type: "area" },
                    ]}
                    currency={false}
                  />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
                  <FinancialChart data={bsData} xKey="year"
                    series={[
                      { key: "Total Assets", label: "Total Assets", type: "bar" },
                      { key: "Total Equity", label: "Equity", type: "bar" },
                      { key: "Total Debt", label: "Net Debt", type: "line" },
                    ]}
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="income">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={tableIS} yearLabels={years} />
            </TabsContent>

            <TabsContent value="cashflow">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={tableCF} yearLabels={years} />
            </TabsContent>

            <TabsContent value="balance">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={tableBS} yearLabels={years} />
            </TabsContent>

            <TabsContent value="roic">
              <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle>ROIC vs WACC (%)</CardTitle></CardHeader>
                    <FinancialChart data={roicData} xKey="year"
                      series={[
                        { key: "ROIC", label: "ROIC", type: "line" },
                        { key: "WACC", label: "WACC", type: "line" },
                      ]}
                      currency={false}
                    />
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Economic Profit ($)</CardTitle></CardHeader>
                    <FinancialChart data={roicData} xKey="year"
                      series={[{ key: "Economic Profit", label: "Economic Profit", type: "bar" }]}
                    />
                  </Card>
                </div>
                <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                  rows={[
                    { label: "Invested Capital", values: result.roic_analysis.invested_capital, bold: true },
                    { label: "Avg Invested Capital", values: result.roic_analysis.avg_invested_capital },
                    { label: "NOPAT", values: result.roic_analysis.nopat, bold: false },
                    { label: "ROIC", values: result.roic_analysis.roic },
                    { label: "WACC", values: result.roic_analysis.wacc },
                    { label: "ROIC Spread", values: result.roic_analysis.roic_spread, bold: true },
                    { label: "Economic Profit", values: result.roic_analysis.economic_profit, bold: true },
                  ]}
                  yearLabels={years}
                />
              </div>
            </TabsContent>

            <TabsContent value="debt">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "Opening Balance", values: result.debt_schedule.opening_balance },
                  { label: "New Debt", values: result.debt_schedule.new_debt },
                  { label: "Interest", values: result.debt_schedule.interest.map((v: number) => -v) },
                  { label: "Principal", values: result.debt_schedule.principal.map((v: number) => -v) },
                  { label: "Closing Balance", values: result.debt_schedule.closing_balance, bold: true },
                  { separator: true, label: "", values: [] },
                  { label: "Equity FCF", values: result.debt_schedule.equity_fcf, bold: true },
                  { label: "DSCR", values: result.debt_schedule.dscr },
                  { label: "Interest Coverage", values: result.debt_schedule.interest_coverage },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="tax">
              <DataTable columns={[{ key: "val", label: "Value", format: "currency" }]}
                rows={[
                  { label: "EBIT", values: result.tax.ebit, bold: true },
                  { label: "NOL Generated", values: result.tax.nol_generated },
                  { label: "NOL Used", values: result.tax.nol_used },
                  { label: "NOL Balance", values: result.tax.nol_balance },
                  { label: "Taxable Income", values: result.tax.taxable_income, bold: true },
                  { label: "Cash Taxes", values: result.tax.cash_taxes.map((v: number) => -v) },
                  { label: "Book Taxes", values: result.tax.book_taxes.map((v: number) => -v) },
                  { label: "Deferred Tax Change", values: result.tax.deferred_tax_change },
                  { label: "Effective Tax Rate", values: result.tax.effective_tax_rate },
                ]}
                yearLabels={years}
              />
            </TabsContent>

            <TabsContent value="valuation">
              <div className="space-y-4">
                {/* Football Field */}
                {ffData.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Football Field — Terminal Value Methods</CardTitle></CardHeader>
                    <FinancialChart data={ffData} xKey="method"
                      series={[
                        { key: "EV", label: "Enterprise Value", type: "bar" },
                        { key: "Equity Value", label: "Equity Value", type: "bar" },
                      ]}
                    />
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.key_metrics?.football_field?.methods &&
                    Object.entries(result.key_metrics.football_field.methods).map(([key, v]: [string, any]) => (
                      <Card key={key} className="p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{key.replace(/_/g, " ")}</p>
                        <div className="flex justify-between text-sm">
                          <span>Enterprise Value</span><Badge variant="neutral">{fmt(v.ev, { style: "currency" })}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Equity Value</span><Badge variant="positive">{fmt(v.equity_value, { style: "currency" })}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>TV % of EV</span><span className="font-mono">{v.tv_pct?.toFixed(1)}%</span>
                        </div>
                        {v.implied_multiple != null && (
                          <div className="flex justify-between text-sm">
                            <span>Implied EV/EBITDA</span><span className="font-mono">{v.implied_multiple?.toFixed(1)}×</span>
                          </div>
                        )}
                      </Card>
                    ))
                  }
                </div>
              </div>
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
